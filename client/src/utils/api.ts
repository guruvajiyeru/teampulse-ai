const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || "");
export const SOCKET_URL = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL || API_BASE_URL);

export function apiUrl(path: string) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}
