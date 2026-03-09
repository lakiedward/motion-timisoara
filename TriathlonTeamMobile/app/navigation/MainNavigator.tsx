import React from 'react';
import ParentTabsNavigator from './ParentTabsNavigator';
import CoachTabsNavigator from './CoachTabsNavigator';
import AdminTabsNavigator from './AdminTabsNavigator';
import { useAuth } from '../store/AuthContext';

const MainNavigator: React.FC = () => {
  const { roles } = useAuth();

  if (roles.includes('ADMIN')) {
    return <AdminTabsNavigator />;
  }

  if (roles.includes('COACH')) {
    return <CoachTabsNavigator />;
  }

  // Implicit, pentru moment, toți ceilalți merg în fluxul de Părinte.
  return <ParentTabsNavigator />;
};

export default MainNavigator;
