import ReactGA from 'react-ga4';
import { supabase } from './supabase.js';

const analytics = {
  initialize() {
    ReactGA.initialize(import.meta.env.VITE_GA_ID);
  },

  trackPageView(path) {
    ReactGA.send({ hitType: "pageview", page: path });
  },

  trackSearch(data) {
    ReactGA.event({ category: "Search", action: "Analyze Repo", label: data.name });

    // Send to Supabase if available (fire and forget to not block UI)
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      // TODO: Implementar Retry Logic (v3.0) - Adicionar tentativa de reenvio em caso de falha temporária
      (async () => {
        try {
          const record = {
            repo_name: data.name,
            owner_type: data.ownerType,
            language: data.language || null,
            stars: data.stars || 0,
            forks: data.forks || 0,
            issues: data.issues || 0,
            subscribers: data.subscribers || 0,
            last_push_at: data.lastPush || null,
            health_score: data.healthScore || 0,
            status: 'success'
          };
          const { error } = await supabase.from('analytics_searches').insert([record]);
          if (error) {
            throw error;
          }
        } catch (error) {
          console.warn('[Analytics] Failed to track search:', error.message);
        }
      })();
    }
  },

  trackExport() {
    ReactGA.event({ category: "Engagement", action: "Download PDF" });
  },
};

export default analytics;
