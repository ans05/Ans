export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nimbus.theme";

/**
 * Runs inline in <head> before first paint so there is no flash of the wrong
 * theme. Prefers a saved choice, then the OS setting.
 */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
