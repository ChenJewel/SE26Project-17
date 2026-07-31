/**
 * Runtime configuration for Web, Capacitor Android and future deployed builds.
 *
 * Keep server addresses here instead of scattering `localhost` or server IPs
 * through pages/hooks. Android WebView treats localhost as the phone itself.
 */
export type AppTarget = "web" | "capacitor" | "android";

const fallbackApiBaseUrl = "http://10.119.5.83/api";
const fallbackWsUrl = "ws://10.119.5.83";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export const runtimeConfig = {
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl),
  wsUrl: trimTrailingSlash(import.meta.env.VITE_WS_URL || fallbackWsUrl),
  appTarget: (import.meta.env.VITE_APP_TARGET || "web") as AppTarget,
  isPackagedApp: ["capacitor", "android"].includes(import.meta.env.VITE_APP_TARGET || ""),
};

export function isLocalApiUrl(url = runtimeConfig.apiBaseUrl) {
  return /\/\/(localhost|127\.0\.0\.1)(:\d+)?($|\/)/.test(url);
}
