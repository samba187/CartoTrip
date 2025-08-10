// frontend/src/config.js
// Résolution robuste de l'URL d'API pour éviter les cas "http://api"

function getDefaultHost() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return window.location.hostname || 'localhost';
    }
  } catch {}
  return 'localhost';
}

const DEFAULT_HOST = getDefaultHost();
const DEFAULT_API = `http://${DEFAULT_HOST}:5000/api`;

function normalizeApiUrl(input) {
  const fallback = DEFAULT_API;
  try {
    const value = String(input || '').trim();
    const candidate = value || fallback;
    // Ensure it looks like a full URL
    let u;
    try { u = new URL(candidate); } catch { u = null; }
    if (!u || !u.protocol || !u.hostname) return fallback;
    // Guard against bad values like http://api
    if (!u.hostname || u.hostname.toLowerCase() === 'api') return fallback;
    // Ensure there is a path suffix /api
    const base = candidate.replace(/\/$/, '');
    return base;
  } catch {
    return fallback;
  }
}

export const API_URL = normalizeApiUrl(process.env.REACT_APP_API_URL);

// Join a relative path to API_URL, normalizing optional leading /api
export function api(path = '') {
  try {
    const p = String(path || '');
    if (/^https?:\/\//i.test(p)) return p; // already absolute
    const clean = p.replace(/^\/+/, '');
    const withoutApi = clean.replace(/^api\//i, '');
    return `${API_URL}/${withoutApi}`;
  } catch {
    return API_URL;
  }
}
