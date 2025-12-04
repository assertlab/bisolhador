import ReactGA from 'react-ga4';

const analytics = {
  initialize() {
    ReactGA.initialize(import.meta.env.VITE_GA_ID);
  },

  trackPageView(path) {
    ReactGA.send({ hitType: "pageview", page: path });
  },

  trackSearch(repoName) {
    ReactGA.event({ category: "Search", action: "Analyze Repo", label: repoName });
  },

  trackExport() {
    ReactGA.event({ category: "Engagement", action: "Download PDF" });
  },
};

export default analytics;
