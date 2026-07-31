/**
 * Platform helpers used by the Web prototype and Capacitor Android wrapper.
 */
export function scrollToTop() {
  if (typeof window === "undefined") return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}
