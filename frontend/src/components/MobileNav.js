import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, Plus, User, List } from 'lucide-react';

function MobileNav({ onAddTravel }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { 
      id: 'map', 
      path: '/', 
      icon: Map, 
      label: 'Carte',
      action: () => navigate('/')
    },
    { 
      id: 'add', 
      path: null, 
      icon: Plus, 
      label: 'Ajouter',
      action: onAddTravel,
      isSpecial: true
    },
    { 
      id: 'travels', 
      path: '/travels', 
      icon: List, 
      label: 'Voyages',
      action: () => navigate('/travels')
    },
    { 
      id: 'profile', 
      path: '/dashboard', 
      icon: User, 
      label: 'Profil',
      action: () => navigate('/dashboard')
    }
  ];

  return (
    <nav className="mobile-nav">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.path === location.pathname;
        
        return (
          <button
            key={tab.id}
            onClick={tab.action}
            className={`mobile-nav-item ${isActive ? 'active' : ''} ${tab.isSpecial ? 'special' : ''}`}
          >
            <div className="mobile-nav-icon">
              <Icon size={24} />
            </div>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileNav;
