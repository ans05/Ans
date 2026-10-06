"use client";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

import { Icon } from "../ui/Icon";

const apply = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the attribute still applies.
  }
};

/**
 * Renders both icons and lets CSS pick one, so the server output matches the
 * client regardless of the viewer's theme.
 */
export function ThemeToggle() {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    apply(current === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="grid size-9 place-items-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
    >
      <Icon name="moon" size={16} className="dark:hidden" />
      <Icon name="sun" size={16} className="hidden dark:block" />
    </button>
  );
}
