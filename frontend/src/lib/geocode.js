// src/lib/geocode.js
const KEY = process.env.REACT_APP_MAPTILER_KEY;
console.log('🔑 MapTiler Key:', KEY ? 'FOUND' : 'MISSING');
const BASE = 'https://api.maptiler.com/geocoding/';

// Mets à false quand tout est OK
const DEBUG_GEOCODE = false;
function log(...args) { if (DEBUG_GEOCODE) console.log('[geocode]', ...args); }

// types MapTiler pour "ville" - priorité aux grandes villes
const TYPES_CITY = 'place,locality';

// Suggestions manuelles pour les grandes villes principales - PARIS EN PREMIER !
const MAJOR_CITIES = {
  'paris': { name: 'Paris', country: 'France', cc: 'FR', lat: 48.8566, lng: 2.3522, type: 'place', priority: 1 },
  'lyon': { name: 'Lyon', country: 'France', cc: 'FR', lat: 45.764, lng: 4.8357, type: 'place', priority: 2 },
  'marseille': { name: 'Marseille', country: 'France', cc: 'FR', lat: 43.2965, lng: 5.3698, type: 'place', priority: 3 },
  'toulouse': { name: 'Toulouse', country: 'France', cc: 'FR', lat: 43.6047, lng: 1.4442, type: 'place', priority: 4 },
  'nice': { name: 'Nice', country: 'France', cc: 'FR', lat: 43.7102, lng: 7.2620, type: 'place', priority: 5 },
  'nantes': { name: 'Nantes', country: 'France', cc: 'FR', lat: 47.2184, lng: -1.5536, type: 'place', priority: 6 },
  'montpellier': { name: 'Montpellier', country: 'France', cc: 'FR', lat: 43.6110, lng: 3.8767, type: 'place', priority: 7 },
  'strasbourg': { name: 'Strasbourg', country: 'France', cc: 'FR', lat: 48.5734, lng: 7.7521, type: 'place', priority: 8 },
  'bordeaux': { name: 'Bordeaux', country: 'France', cc: 'FR', lat: 44.8378, lng: -0.5792, type: 'place', priority: 9 },
  'lille': { name: 'Lille', country: 'France', cc: 'FR', lat: 50.6292, lng: 3.0573, type: 'place', priority: 10 }
};

// Normalisation (sans accents, lower-case)
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function toPlace(f) {
  const [lng, lat] = f.center || f.geometry?.coordinates || [null, null];
  const type = f.place_type?.[0] || f.properties?.type || f.type;
  const cc =
    f.properties?.country_code ||
    f.context?.find((c) => c.id?.startsWith('country'))?.short_code;

  const shortName =
    f.text || f.properties?.name || f.properties?.name_fr || f.properties?.name_en;
  const label =
    f.place_name || f.properties?.label || shortName;

  // population peut être dans properties.population, ou osm:tags.population (string)
  const popRaw = f.properties?.population || f.properties?.['osm:tags']?.population;
  const population = popRaw ? Number(String(popRaw).replace(/[^\d]/g, '')) : undefined;

  return {
    id: f.id,
    name: label || shortName,
    shortName,
    lat, lng,
    type,                                 // "place" / "locality"
    osmPlaceType: f.properties?.['osm:place_type'], // "city" / "town" / "village" / ...
    country_code: cc ? cc.toUpperCase() : undefined,
    relevance: typeof f.relevance === 'number' ? f.relevance : undefined,
    population,
  };
}

async function fetchJSON(url) {
  const r = await fetch(url);
  const t = await r.text();
  if (!r.ok) {
    log('HTTP error', r.status, t?.slice(0, 160));
    throw new Error(`geocoding ${r.status}`);
  }
  try { return JSON.parse(t); } catch {
    log('JSON parse failed', t?.slice(0, 160));
    throw new Error('invalid JSON');
  }
}

export async function searchPlaces(
  q,
  { types = TYPES_CITY, limit = 10, countryHint } = {}
) {
  if (!KEY) throw new Error('REACT_APP_MAPTILER_KEY manquante');
  
  const queryLower = norm(q);
  let manualResults = [];
  
  // 1. D'abord, chercher dans nos suggestions manuelles
  if (queryLower) {
    for (const [key, city] of Object.entries(MAJOR_CITIES)) {
      const cityName = norm(city.name);
      
      // Correspondance si la recherche correspond au début du nom ou est contenue dedans
      if (cityName.startsWith(queryLower) || cityName.includes(queryLower)) {
        // Vérifier le filtrage par pays
        if (!countryHint || city.cc?.toLowerCase() === countryHint.toLowerCase() || 
            norm(city.country || '').includes(norm(countryHint))) {
                            manualResults.push({
                    name: city.name,
                    shortName: city.name,
                    full: `${city.name}, ${city.country}`,
                    country: city.country,
                    cc: city.cc,
                    lat: city.lat,
                    lng: city.lng,
                    type: city.type,
                    priority: city.priority,
                    label: `${city.name}, ${city.country}`,
                    manual: true // Marquer comme résultat manuel
                  });
        }
      }
    }
  }
  
  // 2. Ensuite, recherche API MapTiler
                const params = new URLSearchParams({
                key: KEY,
                limit: String(Math.min(limit, 10)), // MapTiler max = 10
                types,
                language: 'fr',
                autocomplete: 'true',
              });
  
  if (countryHint && /^[A-Za-z]{2}$/.test(countryHint)) {
    params.set('country', countryHint.toLowerCase());
  }
  
  const url = `${BASE}${encodeURIComponent(q)}.json?${params.toString()}`;
  log('searchPlaces →', url);
  const j = await fetchJSON(url);
  let apiResults = (j.features || []).map(toPlace);
  
  // 3. Fusion des résultats : priorité aux manuels, puis API
  let allResults = [...manualResults, ...apiResults];
  
  // Tri intelligent
  allResults.sort((a, b) => {
    const aName = norm(a.name);
    const bName = norm(b.name);
    
            // 0. Priorité absolue aux résultats manuels (grandes villes)
        if (a.manual && !b.manual) return -1;
        if (!a.manual && b.manual) return 1;
        
        // 0.5. Priorité par ordre des grandes villes (Paris = 1, Lyon = 2, etc.)
        if (a.manual && b.manual) {
          const aPrio = a.priority || 999;
          const bPrio = b.priority || 999;
          if (aPrio !== bPrio) return aPrio - bPrio;
        }
    
    // 1. Correspondances exactes
    const aExact = aName === queryLower;
    const bExact = bName === queryLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // 2. Filtrage par pays
    if (countryHint) {
      const countryLower = countryHint.toLowerCase();
      const aCountryMatch = a.cc?.toLowerCase() === countryLower || 
                           norm(a.country || '').includes(norm(countryHint));
      const bCountryMatch = b.cc?.toLowerCase() === countryLower || 
                           norm(b.country || '').includes(norm(countryHint));
      if (aCountryMatch && !bCountryMatch) return -1;
      if (!aCountryMatch && bCountryMatch) return 1;
    }
    
    // 3. Types place > locality
    const typeOrder = { place: 0, locality: 1 };
    const aTypeScore = typeOrder[a.type] ?? 10;
    const bTypeScore = typeOrder[b.type] ?? 10;
    if (aTypeScore !== bTypeScore) return aTypeScore - bTypeScore;
    
    // 4. Commence par la recherche
    const aStarts = aName.startsWith(queryLower);
    const bStarts = bName.startsWith(queryLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    // 5. Longueur du nom
    return aName.length - bName.length;
  });
  
  // Déduplication plus simple - juste par nom normalisé
  const seen = new Set();
  allResults = allResults.filter(place => {
    const key = norm(place.name || place.shortName || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  const finalResults = allResults.slice(0, limit);
  log('searchPlaces final results:', finalResults);
  return finalResults;
}

export async function geocodeCountry(countryName) {
  if (!KEY) throw new Error('REACT_APP_MAPTILER_KEY manquante');
  const url = `${BASE}${encodeURIComponent(countryName)}.json?key=${KEY}&types=country&limit=1&language=fr`;
  log('geocodeCountry →', url);
  const j = await fetchJSON(url);
  const f = j.features?.[0];
  if (!f) return null;
  const [lng, lat] = f.center || [null, null];
  const iso2 =
    f.properties?.country_code?.toUpperCase() ||
    f.properties?.iso_a2?.toUpperCase() ||
    f.properties?.iso2?.toUpperCase();
  const res = { name: f.text || f.properties?.name || countryName, lat, lng, iso2 };
  log('geocodeCountry OK:', res);
  return res;
}

// --- Nouveau : score pour choisir la "meilleure ville"
function scorePlace(p, qCity, countryIso2) {
  const q = norm(qCity);
  const name = norm(p.shortName || p.name);
  const placeName = norm(p.name);
  let s = 0;

  // Exact match (sans accents)
  if (name === q) s += 100;
  if (placeName.includes(q)) s += 20;

  // Poids par type OSM
  const rank = { city: 60, town: 40, municipality: 35, suburb: 25, village: 10, hamlet: 5 };
  s += rank[p.osmPlaceType] || 0;

  // Pays conforme ?
  if (countryIso2 && p.country_code === countryIso2.toUpperCase()) s += 15;

  // Population
  if (p.population) s += Math.min(25, Math.log10(Math.max(1, p.population)) * 8);

  // Pertinence de l'API
  if (typeof p.relevance === 'number') s += p.relevance * 10;

  return s;
}

function pickBestCity(list, qCity, countryIso2) {
  if (!list?.length) return null;
  // Essaie d'abord un exact sur le nom (sans accents)
  const exact = list.find(p => norm(p.shortName) === norm(qCity));
  if (exact) return exact;

  // Sinon, score global
  let best = null;
  let bestScore = -Infinity;
  for (const p of list) {
    const sc = scorePlace(p, qCity, countryIso2);
    if (sc > bestScore) { bestScore = sc; best = p; }
  }
  return best;
}

/**
 * Stratégie :
 * 1) si l'utilisateur tape "Ville, Pays" → requête telle quelle (limit 10), pickBestCity
 * 2) biais pays (si possible), limit 10
 * 3) global sans biais, limit 10
 * 4) concat "Ville, Pays", limit 10
 */
export async function geocodeCity(cityText, countryName) {
  if (!KEY) throw new Error('REACT_APP_MAPTILER_KEY manquante');
  const q = (cityText || '').trim();
  if (!q) return null;

  let biasIso2;
  if (countryName) {
    try { biasIso2 = (await geocodeCountry(countryName))?.iso2; } catch { /* ignore */ }
  }

  // 1) "Ville, Pays" tel quel
  if (/,/.test(q)) {
    try {
      const list = await searchPlaces(q, { types: TYPES_CITY, limit: 10 });
      const best = pickBestCity(list, q.split(',')[0], biasIso2);
      if (best) {
        const res = { name: best.shortName || best.name, lat: best.lat, lng: best.lng, cc: best.country_code };
        log('geocodeCity exact OK:', res);
        return res;
      }
    } catch (_) { /* on continue */ }
  }

  // 2) Avec biais pays si dispo
  try {
    const list = await searchPlaces(q, { types: TYPES_CITY, limit: 10, countryHint: biasIso2 });
    const best = pickBestCity(list, q, biasIso2);
    if (best) {
      const res = { name: best.shortName || best.name, lat: best.lat, lng: best.lng, cc: best.country_code };
      log('geocodeCity biased OK:', res);
      return res;
    }
  } catch (_) { /* continue */ }

  // 3) Global sans biais
  try {
    const list = await searchPlaces(q, { types: TYPES_CITY, limit: 10 });
    const best = pickBestCity(list, q, biasIso2);
    if (best) {
      const res = { name: best.shortName || best.name, lat: best.lat, lng: best.lng, cc: best.country_code };
      log('geocodeCity global OK:', res);
      return res;
    }
  } catch (_) { /* continue */ }

  // 4) Concat "Ville, Pays"
  if (countryName) {
    try {
      const list = await searchPlaces(`${q}, ${countryName}`, { types: TYPES_CITY, limit: 10 });
      const best = pickBestCity(list, q, biasIso2);
      if (best) {
        const res = { name: best.shortName || best.name, lat: best.lat, lng: best.lng, cc: best.country_code };
        log('geocodeCity concat OK:', res);
        return res;
      }
    } catch (_) {}
  }

  log('geocodeCity → aucun résultat pour', q, 'country=', countryName);
  return null;
}
