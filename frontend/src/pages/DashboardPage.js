import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import './AuthPages.css';

export default function DashboardPage() {
  const { logout, authFetch, API_URL } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ username: '', email: '' });
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await authFetch(`${API_URL}/users/me`);
      if (res.ok) {
        const p = await res.json();
        setProfile(p);
        setForm({ username: p.username || '', email: p.email || '' });
      } else if (res.status === 401) {
        logout();
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await authFetch(`${API_URL}/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const goToMap = () => {
    navigate('/');
  };

  if (!profile) return <div className="loading">Chargement...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Mon Profil</h1>
        <button onClick={logout} className="logout-button">Déconnexion</button>
      </div>

      <div className="profile-section">
        <h2>Informations</h2>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          <img
            alt="avatar"
            src={`${API_URL.replace(/\/api$/,'')}/api/users/${profile.id}/avatar?ts=${Date.now()}`}
            onError={(e)=>{ e.currentTarget.style.visibility='hidden'; }}
            style={{ width:96, height:96, objectFit:'cover', borderRadius:12, border:'1px solid rgba(255,255,255,.1)' }}
          />
          <div>
            <div className="form-group">
              <label>Nom d'utilisateur</label>
              <input className="auth-input" value={form.username} onChange={(e)=>setForm(s=>({ ...s, username:e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="auth-input" type="email" value={form.email} onChange={(e)=>setForm(s=>({ ...s, email:e.target.value }))} />
            </div>
            <button
              className="auth-button"
              onClick={async ()=>{
                await authFetch(`${API_URL}/users/me`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(form) });
                await loadProfile();
              }}
            >
              Enregistrer le profil
            </button>
          </div>
        </div>
        <div className="form-actions" style={{ marginTop:16 }}>
          <form onSubmit={async (e)=>{
            e.preventDefault();
            if (!avatarFile) return;
            const fd = new FormData();
            fd.append('avatar', avatarFile);
            await authFetch(`${API_URL}/users/me/avatar`, { method: 'POST', body: fd });
            setAvatarFile(null);
            await loadProfile();
          }}>
            <input type="file" accept="image/*" onChange={(e)=>setAvatarFile(e.target.files?.[0] || null)} />
            <button className="auth-button" type="submit" style={{ marginLeft:12 }}>Uploader l'avatar</button>
          </form>
        </div>
        <p style={{ opacity:.8, marginTop:12 }}><strong>Membre depuis:</strong> {new Date(profile.created_at).toLocaleDateString('fr-FR')}</p>
      </div>

      {stats && (
        <div className="stats-section">
          <h2>Statistiques</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{stats.total_travels}</h3>
              <p>Voyages</p>
            </div>
            <div className="stat-card">
              <h3>{stats.total_countries}</h3>
              <p>Pays</p>
            </div>
            <div className="stat-card">
              <h3>{stats.total_cities}</h3>
              <p>Villes</p>
            </div>
            <div className="stat-card">
              <h3>{stats.total_photos}</h3>
              <p>Photos</p>
            </div>
          </div>
        </div>
      )}

      <button onClick={goToMap} className="map-button">
        Voir la carte des voyages
      </button>
    </div>
  );
}
