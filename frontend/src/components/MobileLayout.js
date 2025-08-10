import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';

function MobileLayout() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTravel, setSelectedTravel] = useState(null);
  const location = useLocation();

  // Masquer la navigation sur les pages d'auth
  const hideNav = ['/login', '/register'].includes(location.pathname);

  const handleAddTravel = () => {
    // Cette fonction sera appelée par la navigation mobile
    // Nous devons trouver une façon de transmettre cela aux composants enfants
    window.dispatchEvent(new CustomEvent('openAddModal'));
  };

  const handleSelectTravel = (travel) => {
    setSelectedTravel(travel);
  };

  return (
    <>
      <div className="mobile-layout">
        <Outlet context={{ selectedTravel, onSelectTravel: handleSelectTravel }} />
      </div>
      
      {!hideNav && (
        <MobileNav onAddTravel={handleAddTravel} />
      )}

      {/* Le modal sera géré par chaque page individuellement */}
    </>
  );
}

export default MobileLayout;
