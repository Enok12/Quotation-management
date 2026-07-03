"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "montra-theme";

// Toggles the `dark` class on <html> and persists the choice. A blocking
// inline script in the root layout applies the stored/system preference
// before first paint, so this component just needs to reflect + flip it.
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* localStorage unavailable — theme just won't persist */
    }
  };

  // Avoid a hydration mismatch: render the same markup as SSR until mounted,
  // then swap to reflect the real (possibly system-preferred) theme.
  const dark = mounted && isDark;

  return (
    <button
      onClick={toggle}
      disabled={!mounted}
      className="nav-item w-full"
      aria-label="Toggle dark mode"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
