import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Empêche le navigateur d'afficher automatiquement la bannière d'installation
      e.preventDefault();
      // Stocke l'événement pour l'utiliser plus tard
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA installée avec succès !');
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    // Vérifie si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setShowInstallButton(false);
    } else {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Affiche la prompt d'installation
    deferredPrompt.prompt();
    
    // Attend la réponse de l'utilisateur
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Utilisateur a accepté l\'installation');
    } else {
      console.log('Utilisateur a refusé l\'installation');
    }
    
    // Reset
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  if (!showInstallButton) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="pwa-install-btn"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        fontWeight: '500',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
        zIndex: 1000,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.target.style.background = '#2563eb';
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 6px 16px rgba(59,130,246,0.5)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = '#3b82f6';
        e.target.style.transform = 'translateY(0px)';
        e.target.style.boxShadow = '0 4px 12px rgba(59,130,246,0.4)';
      }}
    >
      <Download size={18} />
      Installer l'app
    </button>
  );
}

export default PWAInstallPrompt;
