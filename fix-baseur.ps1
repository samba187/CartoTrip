# ==== Réglage ====
$ROOT = "C:\dev\travel-tracker-pwa\frontend"

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }
function Backup-File($p) { if (Test-Path $p) { Copy-Item $p "$p.bak" -Force } }
function Save-Text($p, $content) {
  Ensure-Dir (Split-Path $p)
  Set-Content -LiteralPath $p -Value $content -Encoding UTF8
  Write-Host "Wrote: $p"
}

# --- 0) .env ---
$envPath = Join-Path $ROOT ".env"
$apiLine = "REACT_APP_API_URL=http://localhost:5000/api"
if (Test-Path $envPath) {
  $lines = Get-Content $envPath
  $lines = $lines | Where-Object { $_ -notmatch '^\s*REACT_APP_API_URL\s*=' }
  $lines += $apiLine
  Set-Content $envPath ($lines -join "`r`n") -Encoding UTF8
  Write-Host "Updated: $envPath"
} else {
  Save-Text $envPath "$apiLine`r`n"
}

# --- 1) src/config.js ---
$configJs = @'
export const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000/api")
  .trim()
  .replace(/\/$/, "");
export const api = (path = "/") => `${API_URL}/${String(path).replace(/^\//, "")}`;
'@
Save-Text (Join-Path $ROOT "src\config.js") $configJs

# --- 2) src/fetch-patch.js ---
$fetchPatch = @'
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
  if (/^\/(auth|travels|users|cities|notes|photos|api)\b/i.test(url)) {
    url = api(url);
  }

  if (typeof input === "object" && input !== null && "clone" in input) {
    return origFetch(url, init);
  }
  return origFetch(url, init);
};
'@
Save-Text (Join-Path $ROOT "src\fetch-patch.js") $fetchPatch

# --- 3) src/index.js : prepend import './fetch-patch' si absent ---
$indexPath = Join-Path $ROOT "src\index.js"
if (Test-Path $indexPath) {
  $code = Get-Content $indexPath -Raw
  if ($code -notlike "*import './fetch-patch';*") {
    Backup-File $indexPath
    $new = "import './fetch-patch';`r`n" + $code
    Set-Content $indexPath $new -Encoding UTF8
    Write-Host "Patched: $indexPath"
  } else {
    Write-Host "No change: $indexPath (already has import)"
  }
} else {
  Write-Host "Skip (not found): $indexPath"
}

# --- 4) src/AuthContext.js : version saine ---
$authCtx = @'
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem("access_token"); } catch { return null; }
  });

  const login = useCallback((newToken) => {
    try { localStorage.setItem("access_token", newToken); } catch {}
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    try { localStorage.removeItem("access_token"); } catch {}
    setToken(null);
  }, []);

  const authFetch = useCallback((input, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, [token]);

  const value = useMemo(() => ({ token, login, logout, authFetch }), [token, login, logout, authFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
'@
$authPath = Join-Path $ROOT "src\AuthContext.js"
Backup-File $authPath
Save-Text $authPath $authCtx

Write-Host "`n✅ Terminé. Redémarre backend (5000) et frontend (3000)."
Write-Host "Vérifie dans Network: les appels doivent aller vers http://localhost:5000/api/..."
