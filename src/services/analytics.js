import ReactGA from "react-ga4";
import { supabase } from "./supabase.js";
import { withExponentialBackoff } from "../utils/retry.js";

/**
 * Classroom mode may list private repositories (in the URL, the table links
 * and the form). GA4 enhanced measurement sends those regardless of our
 * config, so GA is switched off — gtag's documented opt-out flag — from the
 * first visit to /turma until the page is closed (navigating away keeps it off:
 * the next hit would still carry /turma?repos=… as referrer).
 */
function disableIfClassroom(path) {
  const id = import.meta.env.VITE_GA_ID;
  if (id && String(path).startsWith('/turma')) window[`ga-disable-${id}`] = true;
  return Boolean(id && window[`ga-disable-${id}`]);
}

/** origin + path, never the query string or hash (see initialize). */
export const pathOnlyLocation = (path) => `${window.location.origin}${String(path).split(/[?#]/)[0]}`;

const analytics = {
  // GA4 attaches the current URL (page_location) to every hit. With the
  // default config that included the query string — ?q=owner/repo,
  // ?repos=… — so our own hits send origin + path: no automatic page_view,
  // page_location set per route. That does NOT cover GA4 enhanced
  // measurement (history page views, outbound clicks, form interactions,
  // site search read the real URL/links), hence disableIfClassroom.
  initialize() {
    disableIfClassroom(window.location.pathname);
    ReactGA.initialize(import.meta.env.VITE_GA_ID, {
      gtagOptions: { send_page_view: false, page_location: pathOnlyLocation(window.location.pathname) },
    });
  },

  trackPageView(path) {
    if (disableIfClassroom(path)) return;
    const location = pathOnlyLocation(path);
    ReactGA.gtag("set", { page_location: location });
    ReactGA.send({ hitType: "pageview", page: path, location });
  },

  async saveSearch(data, fullData = null) {
    if (
      !import.meta.env.VITE_SUPABASE_URL ||
      !import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      return null;
    }

    try {
      const rpcPayload = {
        p_repo_name: data.name,
        p_owner_type: data.ownerType,
        p_language: data.language || null,
        p_stars: parseInt(data.stars) || 0,
        p_forks: parseInt(data.forks) || 0,
        p_issues: parseInt(data.issues) || 0,
        p_subscribers: parseInt(data.subscribers) || 0,
        // null = not measured (e.g. forks have no community profile), not 0%.
        p_health_score: Number.isFinite(parseFloat(data.healthScore)) ? parseFloat(data.healthScore) : null,
        p_last_push_at: data.lastPush || null,
        p_full_report:
          fullData &&
          typeof fullData === "object" &&
          Object.keys(fullData).length > 0
            ? (() => {
                try {
                  // A plain object for the jsonb parameter. It used to be
                  // JSON.stringify'd, and supabase-js encodes the body again,
                  // so every full_report was stored as a JSON *string* inside
                  // jsonb (found in the 2026-10 audit; readers use
                  // parseFullReport, which accepts both). The round-trip drops
                  // anything non-serializable.
                  return JSON.parse(JSON.stringify(fullData));
                } catch (e) {
                  console.warn(
                    "[Analytics] Failed to serialize fullData:",
                    e.message,
                  );
                  return null;
                }
              })()
            : null,
      };

      const { data: result, error } = await supabase.rpc(
        "registrar_busca",
        rpcPayload,
      );
      if (error) {
        throw error;
      }

      // Retorna o ID numérico
      return result;
    } catch (error) {
      console.warn("[Analytics] Failed to save search:", error.message);
      return null;
    }
  },

  trackSearch(data) {
    ReactGA.event({
      category: "Search",
      action: "Analyze Repo",
      label: data.name,
    });

    // Send to Supabase if available (fire and forget with retry to not block UI)
    if (
      import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      const rpcPayload = {
        p_repo_name: data.name,
        p_owner_type: data.ownerType,
        p_language: data.language || null,
        p_stars: parseInt(data.stars) || 0,
        p_forks: parseInt(data.forks) || 0,
        p_issues: parseInt(data.issues) || 0,
        p_subscribers: parseInt(data.subscribers) || 0,
        p_health_score: parseFloat(data.healthScore) || 0,
        p_last_push_at: data.lastPush || null,
      };

      withExponentialBackoff(async () => {
        const { error } = await supabase.rpc("registrar_busca", rpcPayload);
        if (error) throw error;
      }).catch((error) => {
        console.warn(
          "[Analytics] Failed to track search after retries:",
          error.message,
        );
      });
    }
  },

  async getSnapshot(id) {
    if (
      !import.meta.env.VITE_SUPABASE_URL ||
      !import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc("obter_snapshot", {
        p_id: parseInt(id),
      });
      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.warn("[Analytics] Failed to get snapshot:", error.message);
      return null;
    }
  },

  async getSnapshotByDate(repoName, dateString) {
    if (
      !import.meta.env.VITE_SUPABASE_URL ||
      !import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      return null;
    }

    try {
      // Most recent snapshot up to the end of that day, in a fixed timezone on
      // the server (supabase-migrations/buscar_snapshot_por_data.sql): the same
      // link shows the same record in any timezone. Used to send the browser's.
      const { data, error } = await supabase.rpc("buscar_snapshot_por_data", {
        p_repo_name: repoName,
        p_date: dateString,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.warn(
        "[Analytics] Failed to get snapshot by date:",
        error.message,
      );
      return null;
    }
  },

  trackExport() {
    ReactGA.event({ category: "Engagement", action: "Download PDF" });
  },

  /**
   * Busca o histórico completo de análises de um repositório para a Timeline.
   * @param {string} repoName - Nome do repositório (ex: 'facebook/react')
   */
  async getRepoHistory(repoName) {
    if (
      !import.meta.env.VITE_SUPABASE_URL ||
      !import.meta.env.VITE_SUPABASE_ANON_KEY
    ) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc("get_repo_history", {
        p_repo_name: repoName,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.warn("[Analytics] Failed to get repo history:", error.message);
      return null;
    }
  },

  /**
   * History rows of several names of the same repo (renames: old + canonical),
   * case-insensitively deduplicated like get_repo_history's LOWER(). Throws
   * when every lookup failed, so "Supabase unavailable" doesn't read as
   * "no history".
   */
  async getMergedHistory(names) {
    const unique = [...new Set(names.filter(Boolean).map((n) => n.toLowerCase()))];
    const results = await Promise.all(unique.map((name) => this.getRepoHistory(name)));
    if (unique.length > 0 && results.every((r) => r === null)) {
      throw new Error("HISTORY_UNAVAILABLE");
    }
    return results.flat().filter(Boolean);
  },
};

export default analytics;
