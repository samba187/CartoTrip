// frontend/src/App.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Plus,
  Globe,
  X,
  Calendar,
  MapPin,
  Navigation,
  Trash2,
} from 'lucide-react';
import './App.css';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Si tu utilises AuthContext (fourni précédemment)
import { useAuth } from './AuthContext';
import { searchPlaces, geocodeCountry } from './lib/geocode';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY || 'YOUR_MAPTILER_KEY';

// Styles MapTiler (tu peux changer pour d'autres)
const LIGHT_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const SATELLITE_STYLE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;

// =====================================================
// Helpers
// =====================================================
function formatDate(d) {
  if (!d) return '—';
  try {
    // d est 'YYYY-MM-DD' (backend)
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return d;
  }
}

function meanCenter(cities = []) {
  const pts = cities.filter(
    (c) =>
      typeof c.latitude === 'number' &&
      typeof c.longitude === 'number'
  );
  if (!pts.length) return { lat: 48.8566, lng: 2.3522 };
  const lat =
    pts.reduce((s, c) => s + Number(c.latitude), 0) / pts.length;
  const lng =
    pts.reduce((s, c) => s + Number(c.longitude), 0) / pts.length;
  return { lat, lng };
}

function flyTo(map, lng, lat, zoom = 6) {
  if (!map) return;
  map.easeTo({ center: [Number(lng), Number(lat)], zoom, duration: 600 });
}

// (popup HTML util supprimé car non utilisé)

// =====================================================
// App
// =====================================================
export default function App() {
  const { authFetch } = useAuth(); // fourni par AuthContext
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const [travels, setTravels] = useState([]);
  const [selectedTravel, setSelectedTravel] = useState(null);
  const [mapStyle, setMapStyle] = useState('light'); // 'light' | 'sat'
  const [isLoading, setIsLoading] = useState(false);

  const currentStyleUrl = useMemo(
    () => (mapStyle === 'light' ? LIGHT_STYLE : SATELLITE_STYLE),
    [mapStyle]
  );

  // -------------------------------
  // Init map
  // -------------------------------
  useEffect(() => {
    const map = new maplibregl.Map({
      container: 'map',
      style: currentStyleUrl,
      center: [2.3522, 48.8566],
      zoom: 3,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
    });

    mapInstance.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init une seule fois

  // Changer de style (hybrid/sombre) tout en gardant le centre/zoom
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();

    map.setStyle(currentStyleUrl);
    map.once('styledata', () => {
      map.jumpTo({ center, zoom });
      // Reposer les marqueurs après changement de style
      updateMapMarkers(travels);
    });
  }, [currentStyleUrl]); // eslint-disable-line

  // -------------------------------
  // Charger les voyages
  // -------------------------------
  const loadTravels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${API_URL}/travels`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTravels(data);
    } catch (e) {
      console.error('Erreur chargement voyages:', e);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadTravels();
  }, [loadTravels]);

  // Écouter l'événement d'ouverture du modal depuis la navigation mobile
  useEffect(() => {
    const handleOpenAddModal = () => {
      setShowAddModal(true);
    };

    window.addEventListener('openAddModal', handleOpenAddModal);
    return () => window.removeEventListener('openAddModal', handleOpenAddModal);
  }, []);

  // Ouvre un voyage si travelId est présent dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('travelId');
    if (tid) {
      openTravel(Number(tid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTravel = useCallback(async (travelId) => {
    try {
      const res = await authFetch(`${API_URL}/travels/${travelId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSelectedTravel(data);
    } catch (e) {
      console.error('Erreur détail voyage:', e);
      alert('Impossible de charger les détails du voyage');
    }
  }, [authFetch]);

  // -------------------------------
  // Marqueurs
  // -------------------------------
  const updateMapMarkers = useCallback(
    (list = []) => {
      const map = mapRef.current;
      if (!map) return;

      // enlever anciens
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // on place un marker par VILLE (pas juste par pays)
      list.forEach((t) => {
        (t.cities || []).forEach((c) => {
          if (c.latitude == null || c.longitude == null) return;

          const el = document.createElement('div');
          el.className = 'tt-marker';
          const popupNode = document.createElement('div');
          popupNode.style.minWidth = '240px';
          popupNode.style.padding = '4px 4px 8px 4px';
          const title = document.createElement('div');
          title.style.cssText = 'font-weight:700;margin:6px 0 4px 0;color:#0f172a';
          title.textContent = c.name;
          const meta = document.createElement('div');
          meta.style.cssText = 'font-size:.88rem;opacity:.8;margin-bottom:.5rem';
          meta.textContent = `${t.country} · ${formatDate(c.arrival_date)} → ${formatDate(c.departure_date)}`;
          const btn = document.createElement('button');
          btn.textContent = 'Voir le voyage';
          btn.style.cssText = 'cursor:pointer;display:inline-flex;align-items:center;gap:.5rem;background:#3b82f6;color:#fff;padding:.5rem .8rem;border-radius:.6rem;font-size:.9rem;border:none';
          btn.addEventListener('click', (ev) => { ev.stopPropagation(); openTravel(t.id); });
          popupNode.appendChild(title);
          popupNode.appendChild(meta);
          popupNode.appendChild(btn);

          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([Number(c.longitude), Number(c.latitude)])
            .setPopup(new maplibregl.Popup({ offset: 28, closeOnClick: true }).setDOMContent(popupNode))
            .addTo(map);

          // au clic sur le Marker => centre
          marker.getElement().addEventListener('click', () => {
            flyTo(map, c.longitude, c.latitude, 6);
          });

          // gestion du bouton dans la popup (déféré le temps que la popup s'ouvre)
          marker.on('click', () => {
            setTimeout(() => {
              const btn = document.getElementById(`open-travel-${t.id}`);
              if (btn) {
                btn.onclick = () => openTravel(t.id);
              }
            }, 50);
          });

          markersRef.current.push(marker);
        });
      });
    },
    [openTravel] // dépend de openTravel
  );

  useEffect(() => {
    updateMapMarkers(travels);
  }, [travels, updateMapMarkers]);

  // -------------------------------
  // Ajouter un voyage (modal)
  // -------------------------------
  const [showAddModal, setShowAddModal] = useState(false);

  const handleCreateTravel = async (payload) => {
    // payload = { country, notes, cities: [{name, arrival_date, departure_date, latitude, longitude}] }
    try {
      if (!payload.cities?.length) {
        alert('Ajoute au moins une ville.');
        return;
      }
      // centre = moyenne villes
      const { lat, lng } = meanCenter(payload.cities);
      const body = {
        country: payload.country,
        notes: payload.notes || '',
        start_date:
          payload.cities
            .map((c) => c.arrival_date)
            .filter(Boolean)
            .sort()[0] || null,
        end_date:
          payload.cities
            .map((c) => c.departure_date)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null,
        latitude: lat,
        longitude: lng,
        cities: payload.cities.map((c) => ({
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          arrival_date: c.arrival_date || null,
          departure_date: c.departure_date || null,
        })),
      };

      const res = await authFetch(`${API_URL}/travels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('Create travel error:', txt);
        alert("Impossible d'ajouter le voyage (géocodage ou réseau).");
        return;
      }
      const j = await res.json().catch(() => ({}));
      setShowAddModal(false);
      
      // Upload automatique des photos preview
      if (j?.id && j?.cities?.length && payload.cities?.some(c => c._localPhotos?.length)) {
        console.log('📸 Uploading preview photos for travel', j.id);
        try {
          for (let i = 0; i < payload.cities.length; i++) {
            const cityData = payload.cities[i];
            const cityId = j.cities[i]?.id;
            if (cityId && cityData._localPhotos?.length) {
              for (const photoData of cityData._localPhotos) {
                if (photoData.file) {
                  const fd = new FormData();
                  fd.append('photo', photoData.file);
                  if (photoData.caption) fd.append('caption', photoData.caption);
                  
                  const uploadRes = await authFetch(`${API_URL}/cities/${cityId}/photos`, {
                    method: 'POST',
                    body: fd
                  });
                  if (uploadRes.ok) {
                    console.log('✅ Photo uploaded for city', cityData.name);
                  } else {
                    console.warn('⚠️ Photo upload failed for city', cityData.name);
                  }
                }
              }
            }
          }
        } catch (uploadError) {
          console.error('❌ Photo upload error:', uploadError);
        }
      }
      
      await loadTravels();
      if (j?.id) {
        openTravel(j.id);
      }
    } catch (e) {
      console.error(e);
      alert("Impossible d'ajouter le voyage (géocodage ou réseau).");
    }
  };

  return (
    <div className="app app-container">
      <div id="map" className="map" />

      {/* barre d'actions flottante */}
      <div className="controls">
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={20} />
          Ajouter un voyage
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setMapStyle((s) => (s === 'dark' ? 'sat' : 'dark'))}
        >
          <Globe size={20} />
            {mapStyle === 'light' ? 'Vue satellite' : 'Vue claire'}
        </button>
      </div>

      {showAddModal && (
        <AddTravelModal onClose={() => setShowAddModal(false)} onSubmit={handleCreateTravel} />
      )}

      {selectedTravel && (
        <TravelPopup
          travel={selectedTravel}
          onClose={() => setSelectedTravel(null)}
          onZoomTo={(c) => flyTo(mapRef.current, c.longitude, c.latitude, 7)}
          authFetch={authFetch}
          onDeleted={async () => {
            setSelectedTravel(null);
            await loadTravels();
          }}
          onReload={() => openTravel(selectedTravel.id)}
        />
      )}

      {/* petit état de chargement */}
      {isLoading && <div className="loading-badge">Chargement…</div>}
      
      {/* Bouton d'installation PWA */}
      <PWAInstallPrompt />
    </div>
  );
}

// =====================================================
// Composants
// =====================================================

function TravelPopup({ travel, onClose, onZoomTo, authFetch, onDeleted, onReload }) {
  const [busy, setBusy] = useState(false);
  const [activeCityId, setActiveCityId] = useState(() => travel?.cities?.[0]?.id || null);
  const [caption, setCaption] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteRating, setNoteRating] = useState(0);
  const [noteCategory, setNoteCategory] = useState("");
  const [noteFavorite, setNoteFavorite] = useState(false);

  // Réinitialise la ville active quand on ouvre un autre voyage
  useEffect(() => {
    setActiveCityId(travel?.cities?.[0]?.id || null);
  }, [travel]);

  const deleteTravel = async () => {
    if (!travel?.id) return;
    if (!window.confirm('Supprimer ce voyage ?')) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/travels/${travel.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.();
      } else {
        alert("Suppression impossible");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="travel-popup">
      <div className="popup-header">
        <h3>{travel.country}</h3>
        <button onClick={onClose} className="close-btn">
          <X size={20} />
        </button>
      </div>

      <div className="popup-dates">
        <Calendar size={16} />
        <span>
          {formatDate(travel.start_date)} - {formatDate(travel.end_date)}
        </span>
      </div>

      {travel.notes && <p className="popup-notes">{travel.notes}</p>}

      <div className="cities-section">
        <h4>Itinéraire</h4>
        <ol style={{ listStyle:'none', margin:0, padding:0 }}>
          {(travel.cities || []).map((city, idx) => (
            <li key={city.id || city.name} style={{ position:'relative', paddingLeft:24, marginBottom:8 }}>
              <span
                style={{
                  position:'absolute', left:0, top:6, width:10, height:10,
                  borderRadius:'50%', background:'#3b82f6', boxShadow:'0 0 0 3px rgba(59,130,246,.25)'
                }}
              />
              <div
                className="city-item"
                onClick={() => { setActiveCityId(city.id || null); onZoomTo(city); }}
                style={{ borderColor: activeCityId === city.id ? 'rgba(59,130,246,.45)' : undefined }}
              >
            <div className="city-info">
              <h5>
                    <MapPin size={14} /> {idx + 1}. {city.name}
              </h5>
              <div className="city-stats">
                <span>
                  <Calendar size={14} /> {formatDate(city.arrival_date)} → {formatDate(city.departure_date)}
                </span>
              </div>
            </div>
            <Navigation size={16} />
          </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Photos */}
      {activeCityId && (
        <div className="photos-section">
          <h3>Photos</h3>
          <div className="photo-grid">
            {(travel.cities?.find(c => c.id === activeCityId)?.photos || []).map(p => (
              <div key={p.id} className="photo-item">
                <img alt={p.caption || ''} src={`${API_URL}/photos/${p.id}/raw`} />
                {p.caption && <div className="photo-caption">{p.caption}</div>}
                <button
                  className="btn btn-secondary"
                  style={{ position:'absolute', top:8, right:8, padding:'6px 10px' }}
                  onClick={async () => {
                    if (!window.confirm('Supprimer cette photo ?')) return;
                    await authFetch(`${API_URL}/photos/${p.id}`, { method:'DELETE' });
                    onReload?.();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <form
            className="upload-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const fileInput = e.currentTarget.querySelector('input[type=file]');
              const file = fileInput?.files?.[0];
              if (!file) { alert('Veuillez sélectionner une photo'); return; }
              setBusy(true);
              try {
                // Vérifie la ville active avec diagnostic
                let cityId = activeCityId;
                console.log('🔍 Initial state - activeCityId:', activeCityId, 'travel.cities:', travel?.cities?.map(c => ({id: c.id, name: c.name})));
                
                // Vérification stricte de l'existence de la ville
                const cityExists = travel?.cities?.find(c => c.id === activeCityId);
                if (!cityExists) {
                  console.warn('⚠️ Active city not found in current travel data, using first city');
                  cityId = travel?.cities?.[0]?.id || null;
                  setActiveCityId(cityId);
                  console.log('🔍 Fallback to first city ID:', cityId);
                } else {
                  console.log('✅ Using valid active city:', cityExists);
                }
                
                if (!cityId) { 
                  console.error('❌ No city available for upload');
                  alert('Aucune ville sélectionnée'); 
                  return; 
                }
                
                // Double vérification avec les données actuelles
                const finalCityCheck = travel?.cities?.find(c => c.id === cityId);
                if (!finalCityCheck) {
                  console.error('❌ City ID does not exist in travel data:', cityId);
                  alert('Erreur: ville introuvable. Rechargez la page.');
                  return;
                }
                
                const fd = new FormData();
                fd.append('photo', file);
                if (caption.trim()) fd.append('caption', caption.trim());
                
                console.log('🔄 Upload photo to city', cityId, 'file:', file.name, 'size:', file.size);
                let resUp = await authFetch(`${API_URL}/cities/${cityId}/photos`, { method:'POST', body: fd });
                
                if (!resUp.ok) {
                  let errorText = 'Unknown error';
                  try {
                    errorText = await resUp.text();
                  } catch (e) {
                    errorText = `HTTP ${resUp.status}`;
                  }
                  console.error('❌ Upload failed:', resUp.status, errorText);
                  
                  // Recharger les détails et réessayer avec id rafraîchi (évite 404 si id périmé)
                  try {
                    console.log('🔄 Retrying with fresh travel data...');
                    const r = await authFetch(`${API_URL}/travels/${travel.id}`);
                    if (r.ok) {
                      const fresh = await r.json();
                      console.log('🔄 Fresh travel data:', fresh);
                      console.log('🔄 Available cities:', fresh?.cities?.map(c => ({id: c.id, name: c.name})));
                      console.log('🔄 Current activeCityId:', activeCityId, 'vs travel.id:', travel.id);
                      
                      // Chercher la ville active ou prendre la première
                      const activeCityObj = fresh?.cities?.find(c => c.id === activeCityId) || fresh?.cities?.[0];
                      console.log('🔄 Selected city for retry:', activeCityObj);
                      
                      if (activeCityObj) {
                        console.log('🔄 Retry with city ID:', activeCityObj.id, 'name:', activeCityObj.name);
                        setActiveCityId(activeCityObj.id);
                        const newFd = new FormData();
                        newFd.append('photo', file);
                        if (caption.trim()) newFd.append('caption', caption.trim());
                        resUp = await authFetch(`${API_URL}/cities/${activeCityObj.id}/photos`, { method:'POST', body: newFd });
                        console.log('🔄 Retry response status:', resUp.status);
                      } else {
                        console.error('❌ No cities found in fresh travel data');
                      }
                    } else {
                      console.error('❌ Failed to fetch fresh travel data:', r.status);
                    }
                  } catch (retryError) {
                    console.error('❌ Retry failed:', retryError);
                  }
                }
                
                if (!resUp.ok) { 
                  let finalErrorText = 'Unknown error';
                  try {
                    // Vérifier si la réponse peut encore être lue
                    if (!resUp.bodyUsed) {
                      finalErrorText = await resUp.text();
                    } else {
                      finalErrorText = `HTTP ${resUp.status}`;
                    }
                  } catch (e) {
                    finalErrorText = `HTTP ${resUp.status}`;
                  }
                  alert(`Upload impossible: ${resUp.status} - ${finalErrorText}`); 
                  return; 
                }
                
                const result = await resUp.json();
                console.log('✅ Upload success:', result);
                
                setPhotoFile(null);
                if (fileInput) fileInput.value = '';
                setCaption('');
                onReload?.();
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Ajouter une photo</h3>
            <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            <input type="text" placeholder="Légende (facultatif)" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="form-actions">
              <button className="btn btn-success" type="submit" disabled={busy}>
              {busy ? 'Upload...' : 'Uploader'}
            </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes */}
      {activeCityId && (
        <div className="notes-section">
          <h3>Notes</h3>
          {(travel.cities?.find(c => c.id === activeCityId)?.city_notes || []).map(n => (
            <div key={n.id} className="note-item">
              <div className="note-header">
                {n.title && <h4>{n.title}</h4>}
                {n.is_favorite && <span className="favorite-badge">⭐</span>}
                {n.category && <span className="category-badge">{n.category}</span>}
              </div>
              {n.rating && (
                <div className="rating">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < n.rating ? "star filled" : "star"}>★</span>
                  ))}
                </div>
              )}
              {n.content && <p>{n.content}</p>}
              {n.created_at && <div className="note-date">{new Date(n.created_at).toLocaleString('fr-FR')}</div>}
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={async () => { await authFetch(`${API_URL}/notes/${n.id}`, { method:'DELETE' }); onReload?.(); }}>Supprimer</button>
              </div>
            </div>
          ))}

          <form
            className="note-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!noteContent.trim()) { alert('Contenu requis'); return; }
              setBusy(true);
              try {
                // Vérifier que la ville existe avant l'ajout de note
                const cityExists = travel?.cities?.find(c => c.id === activeCityId);
                if (!cityExists) {
                  alert('Erreur: ville introuvable pour ajouter la note');
                  return;
                }
                
                console.log('📝 Adding note to city', activeCityId, cityExists.name);
                const res = await authFetch(`${API_URL}/cities/${activeCityId}/notes`, {
                  method:'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                  title: noteTitle.trim(), 
                  content: noteContent.trim(),
                  rating: noteRating || null,
                  category: noteCategory.trim(),
                  is_favorite: noteFavorite
                })
                });
                if (!res.ok) {
                  const errorText = await res.text();
                  console.error('❌ Note creation failed:', res.status, errorText);
                  alert(`Impossible d'ajouter la note: ${res.status}`);
                  return;
                }
                console.log('✅ Note added successfully');
                setNoteTitle('');
                setNoteContent('');
                setNoteRating(0);
                setNoteCategory('');
                setNoteFavorite(false);
                onReload?.();
              } catch (error) {
                console.error('❌ Note creation error:', error);
                alert('Erreur lors de l\'ajout de la note');
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Ajouter une note</h3>
            <input type="text" placeholder="Titre (facultatif)" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            <div className="form-row">
              <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)}>
                <option value="">Catégorie</option>
                <option value="Restaurant">🍽️ Restaurant</option>
                <option value="Visite">🏛️ Visite</option>
                <option value="Hébergement">🏨 Hébergement</option>
                <option value="Transport">🚗 Transport</option>
                <option value="Shopping">🛍️ Shopping</option>
                <option value="Autre">📝 Autre</option>
              </select>
              <div className="rating-input">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    type="button"
                    className={star <= noteRating ? "star-btn active" : "star-btn"}
                    onClick={() => setNoteRating(star === noteRating ? 0 : star)}
                  >★</button>
                ))}
              </div>
            </div>
            <textarea rows={3} placeholder="Votre note" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
            <label className="checkbox-label">
              <input type="checkbox" checked={noteFavorite} onChange={(e) => setNoteFavorite(e.target.checked)} />
              <span>⭐ Marquer comme favori</span>
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Ajout...' : 'Ajouter la note'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="action-buttons">
        <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        <button className="btn btn-secondary" onClick={() => onReload?.()} disabled={busy}>
          🔄 Recharger
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={deleteTravel}>
          <Trash2 size={16} /> Supprimer
        </button>
      </div>
    </div>
  );
}

// -----------------------------
// Modal - Ajout de voyage
// -----------------------------
function AddTravelModal({ onClose, onSubmit }) {
  const [country, setCountry] = useState('');
  const [countrySuggestions, setCountrySuggestions] = useState([]);
  const [selectedCountryData, setSelectedCountryData] = useState(null);
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [selectedCityData, setSelectedCityData] = useState(null);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [cities, setCities] = useState([]);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // --- Geocoding helpers (MapTiler)
  const searchCountries = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setCountrySuggestions([]);
      return;
    }
    try {
      // Normalise la requête pays (capitalisation de la première lettre)
      const norm = String(q).trim();
      const pretty = norm.charAt(0).toUpperCase() + norm.slice(1).toLowerCase();
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(pretty)}.json?key=${MAPTILER_KEY}&types=country&limit=8&language=fr`;
      const r = await fetch(url);
      const j = await r.json();
      const list =
        j?.features?.map((f) => ({
          label:
            f.place_name_fr ||
            f.place_name ||
            f.text_fr ||
            f.text ||
            pretty,
          code: f.properties?.country_code?.toUpperCase?.(),
        })) || [];
      setCountrySuggestions(list);
    } catch (e) {
      console.error(e);
      setCountrySuggestions([]);
    }
  }, []);

  const searchCities = useCallback(async (q, countryName) => {
    console.log('🔍 searchCities called with:', q, countryName);
    if (!q || q.length < 2) {
      setCitySuggestions([]);
      return;
    }
    try {
      const normQ = String(q).trim();
      console.log('🔍 Searching for:', normQ);
      let iso2;
      if (countryName) {
        try { 
          const countryResult = await geocodeCountry(countryName);
          iso2 = countryResult?.iso2; 
          console.log('🏳️ Country ISO2:', iso2);
        } catch {}
      }
      // Filtrage strict: si un pays est saisi → n'afficher que les villes de ce pays
      let list = await searchPlaces(normQ, { types: 'place,locality', limit: 10, countryHint: iso2 });
      console.log('🏙️ searchPlaces result:', list);
      
      if (iso2) list = list.filter(p => (p.country_code || '').toUpperCase() === iso2.toUpperCase());
      if (!list?.length) {
        console.log('⚠️ No results with country filter, trying global search');
        // dernier recours global
        list = await searchPlaces(normQ, { types: 'place,locality', limit: 10 });
        console.log('🌍 Global search result:', list);
        if (iso2) list = list.filter(p => (p.country_code || '').toUpperCase() === iso2.toUpperCase());
      }
      // Dédoublonnage par libellé
      const seen = new Set();
      const unique = [];
      for (const p of list) {
        const k = (p.name || p.shortName || '').toLowerCase();
        if (!seen.has(k)) { seen.add(k); unique.push({ name: p.shortName || p.name, full: p.name, lat: p.lat, lng: p.lng }); }
      }
      console.log('✅ Final suggestions:', unique);
      setCitySuggestions(unique);
    } catch (e) {
      console.error('❌ searchCities error:', e);
      setCitySuggestions([]);
    }
  }, []);

  // Recherche pays à la saisie
  useEffect(() => {
    const t = setTimeout(() => searchCountries(country), 250);
    return () => clearTimeout(t);
  }, [country, searchCountries]);

  // Recherche villes à la saisie
  useEffect(() => {
    const t = setTimeout(() => searchCities(cityQuery, country), 250);
    return () => clearTimeout(t);
  }, [cityQuery, country, searchCities]);

  const addCity = () => {
    const item = selectedCityData;
    if (!item || !arrival || !departure) {
      alert('Sélectionne une ville et ses dates.');
      return;
    }
    setCities((prev) => [
      ...prev,
      {
        name: item.name,
        full: item.full,
        arrival_date: arrival,
        departure_date: departure,
        latitude: item.lat,
        longitude: item.lng,
        _localPhotos: [],
      },
    ]);
    setCityQuery('');
    setCitySuggestions([]);
    setSelectedCityData(null);
    setArrival('');
    setDeparture('');
  };

  const removeCity = (idx) => {
    setCities((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!country.trim()) {
      alert('Sélectionne un pays.');
      return;
    }
    if (!cities.length) {
      alert('Ajoute au moins une ville.');
      return;
    }
    // Upload différé des photos: on attache seulement les villes + dates, puis on ouvrira le voyage créé
    setBusy(true);
    try {
      await onSubmit({
        country: country.trim(),
        notes,
        cities,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h2>Ajouter un nouveau voyage</h2>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Pays */}
          <div className="form-group">
            <label>Pays</label>
            <input
              type="text"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                // Si l'utilisateur tape, on réinitialise la sélection
                if (!e.target.value) {
                  setSelectedCountryData(null);
                }
              }}
              placeholder="Ex: France"
              required
              autoFocus
              style={{
                borderColor: selectedCountryData ? '#10b981' : undefined,
                boxShadow: selectedCountryData ? '0 0 0 3px rgba(16,185,129,0.1)' : undefined
              }}
            />
            {selectedCountryData && (
              <div style={{marginTop: 4, fontSize: '0.85rem', color: '#10b981', fontWeight: 500}}>
                ✓ {selectedCountryData.label} sélectionné
              </div>
            )}
            {countrySuggestions.length > 0 && (
              <div className="suggestions">
                {countrySuggestions.map((s, i) => (
                  <div
                    key={`${s.label}-${i}`}
                    className="suggestion-item"
                    onClick={() => {
                      setCountry(s.label);
                      setCountrySuggestions([]);
                      setSelectedCountryData(s);
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Villes */}
          <div className="form-group">
            <label>Ajouter une ville</label>
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value);
                // Si l'utilisateur tape, on réinitialise la sélection
                if (!e.target.value) {
                  setSelectedCityData(null);
                }
              }}
              placeholder="Ex: Paris"
              style={{
                borderColor: selectedCityData ? '#10b981' : undefined,
                boxShadow: selectedCityData ? '0 0 0 3px rgba(16,185,129,0.1)' : undefined
              }}
            />
            {selectedCityData && (
              <div style={{marginTop: 4, fontSize: '0.85rem', color: '#10b981', fontWeight: 500}}>
                ✓ {selectedCityData.full} sélectionnée
              </div>
            )}
            {citySuggestions.length > 0 && (
              <div className="suggestions">
                {citySuggestions.map((s, i) => (
                  <div
                    key={`${s.full}-${i}`}
                    className="suggestion-item"
                    onClick={() => {
                      setCityQuery(s.name || s.full);
                      setCitySuggestions([]);
                      // Stocker la suggestion sélectionnée pour l'ajout
                      setSelectedCityData(s);
                    }}
                  >
                    {s.full}
                  </div>
                ))}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Date d'arrivée (ville)</label>
                <input
                  type="date"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Date de départ (ville)</label>
                <input
                  type="date"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-add"
              onClick={() => {
                if (!selectedCityData) {
                  alert(
                    "Sélectionne une ville dans les suggestions (ex: Paris, France)."
                  );
                  return;
                }
                addCity();
              }}
            >
              <Plus size={18} />
              Ajouter la ville
            </button>

            {/* Liste des villes ajoutées */}
            {cities.length > 0 && (
              <div className="cities-selected">
                {cities.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="city-chip" style={{ flexDirection:'column', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
                      <span style={{ flex:1 }}>
                      {c.name} — {formatDate(c.arrival_date)} → {formatDate(c.departure_date)}
                    </span>
                    <button type="button" onClick={() => removeCity(i)}>
                      <X size={16} />
                    </button>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:8, width:'100%', flexWrap:'wrap' }}>
                      <input type="file" multiple accept="image/*" onChange={(e)=>{
                        const files = Array.from(e.target.files||[]);
                        if (!files.length) return;
                        const caption = pendingCaption;
                        files.forEach((f)=>{
                          const reader = new FileReader();
                          reader.onload = () => {
                            setCities(prev => prev.map((cc,idx)=> idx===i ? { ...cc, _localPhotos:[...(cc._localPhotos||[]), { src: reader.result, file: f, caption }] } : cc));
                          };
                          reader.readAsDataURL(f);
                        });
                        setPendingCaption('');
                        e.target.value = '';
                      }} />
                      <input type="text" style={{ flex:'1 1 220px' }} placeholder="Légende appliquée aux fichiers choisis" value={pendingCaption} onChange={(e)=>setPendingCaption(e.target.value)} />
                    </div>
                    {c._localPhotos?.length>0 && (
                      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                        {c._localPhotos.map((p,idx)=>(
                          <div key={idx} style={{ position:'relative' }}>
                            <img alt={p.caption||''} src={p.src} style={{ width:90, height:70, objectFit:'cover', borderRadius:8, border:'1px solid rgba(15,23,42,.12)' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>Notes (voyage)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Décrivez votre voyage…"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le voyage'}
          </button>
        </form>
      </div>
    </div>
  );
}
