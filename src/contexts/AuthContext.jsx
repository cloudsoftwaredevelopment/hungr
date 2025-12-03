import React, { createContext, useState, useEffect, useContext } from 'react';

// Define API URL here or import from a config file
const API_URL = '/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check browser storage for existing session
    const token = sessionStorage.getItem('accessToken');
    const savedUser = sessionStorage.getItem('user');
    
    if (token && savedUser) {
      try {
          setUser(JSON.parse(savedUser));
          setIsAuthenticated(true);
      } catch (e) {
          sessionStorage.clear();
      }
    } 
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // 2. Success! Save REAL user data from MariaDB
        sessionStorage.setItem('accessToken', data.data.accessToken);
        sessionStorage.setItem('user', JSON.stringify(data.data));
        setUser(data.data);
        setIsAuthenticated(true);
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Invalid credentials' };
      
    } catch (err) {
      console.error("Login Connection Error:", err);
      return { success: false, error: "Server connection failed. Please try again." };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
