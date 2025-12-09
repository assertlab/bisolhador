import ReactGA from 'react-ga4';
import { supabase } from './supabase.js';

const analytics = {
  initialize() {
    ReactGA.initialize(import.meta.env.VITE_GA_ID);
  },

  trackPageView(path) {
    ReactGA.send({ hitType: "pageview", page: path });
  },

  trackSearch(repoName) {
    ReactGA.event({ category: "Search", action: "Analyze Repo", label: repoName });

    // Send to Supabase if available (fire and forget to not block UI)
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      supabase.from('analytics_searches')
        .insert([{ repo_name: repoName }])
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
