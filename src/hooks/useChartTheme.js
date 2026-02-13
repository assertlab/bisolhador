import { useState, useEffect, useMemo } from 'react';

function useChartTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    // Check initially
    checkDarkMode();

    // Listen for class changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => ({
    textColor: isDark ? '#e5e7eb' : '#1f2937', // gray-200 or gray-800
    gridColor: isDark ? '#374151' : '#e5e7eb', // gray-700 or gray-200
    tooltipBg: isDark ? '#1e293b' : '#ffffff', // slate-800 or white
    tooltipText: isDark ? '#e5e7eb' : '#1f2937', // gray-200 or gray-800
  }), [isDark]);
}

export default useChartTheme;
