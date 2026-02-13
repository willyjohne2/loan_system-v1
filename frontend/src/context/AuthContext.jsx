import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('loan_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [activeRole, setActiveRole] = useState(() => {
    const savedActive = localStorage.getItem('active_role_view');
    if (savedActive) return savedActive;
    const savedUser = localStorage.getItem('loan_user');
    return savedUser ? JSON.parse(savedUser).role : null;
  });

  useEffect(() => {
    if (user && !activeRole) {
      setActiveRole(user.role);
    }
  }, [user, activeRole]);

  const login = (userData) => {
    setUser(userData);
    setActiveRole(userData.role);
    localStorage.setItem('loan_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setActiveRole(null);
    localStorage.removeItem('loan_user');
    localStorage.removeItem('active_role_view');
  };

  const updateUser = (updatedData) => {
    setUser(prev => {
      const newUser = { ...prev, ...updatedData };
      localStorage.setItem('loan_user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const switchActiveRole = (role) => {
    setActiveRole(role);
    // Optionally persist the active view preference
    localStorage.setItem('active_role_view', role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, activeRole, switchActiveRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
