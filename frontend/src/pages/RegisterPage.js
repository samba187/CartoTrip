import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './AuthPages.css';

export default function RegisterPage() {
  const { API_URL } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      username: form.get('username'),
      email: form.get('email'),
      password: form.get('password'),
    };

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Compte créé avec succès ! Connectez-vous.');
        navigate('/login', { replace: true });
      } else if (res.status === 409) {
        alert('Cet utilisateur existe déjà');
      } else {
        alert("Erreur lors de l'inscription");
      }
    } catch (error) {
      console.error('Erreur inscription:', error);
      alert("Erreur lors de l'inscription");
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={onSubmit} className="auth-form">
        <h1>Créer un compte</h1>
        <input 
          name="username" 
          placeholder="Nom d'utilisateur" 
          required 
          className="auth-input"
        />
        <input 
          name="email" 
          type="email" 
          placeholder="Email" 
          required 
          className="auth-input"
        />
        <input 
          name="password" 
          type="password" 
          placeholder="Mot de passe" 
          required 
          className="auth-input"
        />
        <button type="submit" className="auth-button">Créer le compte</button>
        <p className="auth-link">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
