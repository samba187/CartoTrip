import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || "Erreur de connexion");
        return;
      }
      if (!data.access_token) {
        setErr("Réponse invalide du serveur");
        return;
      }
      login(data.access_token);
      nav("/"); // va à la carte
    } catch (e2) {
      setErr("Réseau indisponible");
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={onSubmit} className="auth-form">
        <h1>Se connecter</h1>

        {err && <div className="auth-error">{err}</div>}

        <label>Email</label>
        <input
          type="email"
          placeholder="ex: demo@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="auth-input"
        />

        <label>Mot de passe</label>
        <input
          type="password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="auth-input"
        />

        <button type="submit" className="auth-button">Se connecter</button>

        <p className="auth-link">Pas de compte ? <Link to="/register">Créer un compte</Link></p>
      </form>
    </div>
  );
}
