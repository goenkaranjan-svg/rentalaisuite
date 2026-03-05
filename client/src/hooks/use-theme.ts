import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "propman_theme_dark_enabled";

function applyDarkClass(enabled: boolean) {
  document.documentElement.classList.toggle("dark", enabled);
}

function readInitialTheme(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return false;
}

export function initTheme() {
  if (typeof window === "undefined") return;
  applyDarkClass(readInitialTheme());
}

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(readInitialTheme);

  useEffect(() => {
    applyDarkClass(isDarkMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, String(isDarkMode));
  }, [isDarkMode]);

  return { isDarkMode, setIsDarkMode };
}
