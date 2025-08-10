import { api } from "./config";

const origFetch = window.fetch.bind(window);

function absolutize(u) {
  try {
    if (typeof u === "object" && u !== null && "url" in u) return String(u.url || "");
    return String(u || "");
  } catch { return String(u || ""); }
}

window.fetch = (input, init) => {
  let url = absolutize(input);

  // Corrige /undefined/... -> /
  if (/^\/undefined\//i.test(url)) url = url.replace(/^\/undefined\//i, "/");

  // Préfixe les endpoints relatifs vers l'API
  if (/^\/(auth|travels|users|cities|notes|photos|stats|api)\b/i.test(url)) {
    url = api(url);
  }

  if (typeof input === "object" && input !== null && "clone" in input) {
    return origFetch(url, init);
  }
  return origFetch(url, init);
};
