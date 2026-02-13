import { useState, useEffect } from 'react';
import { getItem, setItem } from '../utils/storage.js';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setItem('theme', newTheme);
  };

  return { theme, toggleTheme };
}

export default useTheme;
