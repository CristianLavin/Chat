const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
);

export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || API_URL
);

export const resolveMediaUrl = (value) => {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
};
