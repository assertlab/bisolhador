import ReactGA from 'react-ga4';
import { supabase } from './supabase.js';

const analytics = {
  initialize() {
    ReactGA.initialize(import.meta.env.VITE_GA_ID);
  },

  trackPageView(path) {
    ReactGA.send({ hitType: "pageview", page: path });
  },

  async saveSearch(data, fullData = null) {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
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
        p_health_score: parseFloat(data.healthScore) || 0,
        p_last_push_at: data.lastPush || null,
        p_full_report: fullData && typeof fullData === 'object' && Object.keys(fullData).length > 0 ? (() => {
          try {
            return JSON.stringify(fullData);
          } catch (e) {
            console.warn('[Analytics] Failed to serialize fullData:', e.message);
            return null;
          }
        })() : null
      };

      const { data: result, error } = await supabase.rpc('registrar_busca', rpcPayload);
      if (error) {
        throw error;
      }

      // Retorna o ID numérico
      return result;
    } catch (error) {
      console.warn('[Analytics] Failed to save search:', error.message);
      return null;
    }
  },

  trackSearch(data) {
    ReactGA.event({ category: "Search", action: "Analyze Repo", label: data.name });

    // Send to Supabase if available (fire and forget to not block UI)
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      // TODO: Implementar Retry Logic (v3.0) - Adicionar tentativa de reenvio em caso de falha temporária
      (async () => {
        try {
          const rpcPayload = {
            p_repo_name: data.name,
            p_owner_type: data.ownerType,
            p_language: data.language || null,
            p_stars: parseInt(data.stars) || 0,
            p_forks: parseInt(data.forks) || 0,
            p_issues: parseInt(data.issues) || 0,
            p_subscribers: parseInt(data.subscribers) || 0,
            p_health_score: parseFloat(data.healthScore) || 0,
            p_last_push_at: data.lastPush || null
          };
          const { error } = await supabase.rpc('registrar_busca', rpcPayload);
          if (error) {
            throw error;
          }
        } catch (error) {
          console.warn('[Analytics] Failed to track search:', error.message);
        }
      })();
    }
  },

  async getSnapshot(id) {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('obter_snapshot', { p_id: parseInt(id) });
      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.warn('[Analytics] Failed to get snapshot:', error.message);
      return null;
    }
  },

  async getSnapshotByDate(repoName, dateString) {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('buscar_snapshot_por_data', {
        p_repo_name: repoName,
        p_date: dateString
      });
      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.warn('[Analytics] Failed to get snapshot by date:', error.message);
      return null;
    }
  },

  trackExport() {
    ReactGA.event({ category: "Engagement", action: "Download PDF" });
  },
};

export default analytics;
