import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { MapPin, Calendar, Camera, FileText, Trash2, Eye } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

function TravelsPage() {
  const { authFetch, API_URL } = useAuth();
  const [travels, setTravels] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const { onSelectTravel } = context;

  useEffect(() => {
    loadTravels();
  }, []);

  const loadTravels = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/travels`);
      if (res.ok) {
        const data = await res.json();
        setTravels(data);
      }
    } catch (e) {
      console.error('Erreur chargement voyages:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteTravel = async (travelId) => {
    if (!window.confirm('Supprimer ce voyage ?')) return;
    
    try {
      const res = await authFetch(`${API_URL}/travels/${travelId}`, { method: 'DELETE' });
      if (res.ok) {
        setTravels(prev => prev.filter(t => t.id !== travelId));
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (e) {
      console.error('Erreur suppression:', e);
      alert('Erreur réseau');
    }
  };

  const viewTravel = (travel) => {
    // Si on a une fonction de sélection, on l'utilise et on navigue vers la carte
    if (onSelectTravel) {
      onSelectTravel(travel);
      navigate('/');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="travels-page">
        <div className="travels-header">
          <h1>Mes voyages</h1>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="travels-page">
      <div className="travels-header">
        <h1>Mes voyages</h1>
        <div className="travels-stats">
          {travels.length} voyage{travels.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="travels-list">
        {travels.length === 0 ? (
          <div className="empty-state">
            <MapPin size={48} color="#9ca3af" />
            <h2>Aucun voyage</h2>
            <p>Commencez par ajouter votre premier voyage !</p>
          </div>
        ) : (
          travels.map(travel => (
            <div key={travel.id} className="travel-card">
              <div className="travel-card-header">
                <h3>{travel.country}</h3>
                <div className="travel-card-actions">
                  <button 
                    className="btn-icon"
                    onClick={() => viewTravel(travel)}
                    title="Voir sur la carte"
                  >
                    <Eye size={18} />
                  </button>
                  <button 
                    className="btn-icon danger"
                    onClick={() => deleteTravel(travel.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="travel-card-dates">
                <Calendar size={16} />
                <span>
                  {formatDate(travel.start_date)} - {formatDate(travel.end_date)}
                </span>
              </div>

              {travel.notes && (
                <p className="travel-card-notes">{travel.notes}</p>
              )}

              <div className="travel-card-cities">
                <div className="cities-count">
                  <MapPin size={16} />
                  {travel.cities?.length || 0} ville{(travel.cities?.length || 0) > 1 ? 's' : ''}
                </div>
                
                <div className="cities-list">
                  {(travel.cities || []).slice(0, 3).map((city, idx) => (
                    <span key={city.id || idx} className="city-badge">
                      {city.name}
                    </span>
                  ))}
                  {(travel.cities?.length || 0) > 3 && (
                    <span className="city-badge more">
                      +{(travel.cities?.length || 0) - 3}
                    </span>
                  )}
                </div>
              </div>

              <div className="travel-card-stats">
                <div className="stat">
                  <Camera size={16} />
                  <span>{travel.total_photos || 0}</span>
                </div>
                <div className="stat">
                  <FileText size={16} />
                  <span>{travel.total_notes || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TravelsPage;
