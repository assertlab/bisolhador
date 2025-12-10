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
      supabase.from('analytics_searches')
        .insert([record])
        .then(({ error }) => {
          if (error) console.error('Supabase analytics error:', error);
        });
    }
  },

  trackExport() {
    ReactGA.event({ category: "Engagement", action: "Download PDF" });
  },
};

export default analytics;
