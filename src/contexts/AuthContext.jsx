/**
 * AuthContext.jsx
 * Global authentication state management
 * Stores user data, tokens, and auth functions
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Auth State
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = sessionStorage.getItem('accessToken');
      
      if (storedToken) {
        // Try to verify token by fetching profile
        try {
          logApiCall('GET', API_ENDPOINTS.USER_PROFILE);
          const response = await fetch(API_ENDPOINTS.USER_PROFILE, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            },
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setUser(data.data);
              setAccessToken(storedToken);
              setIsAuthenticated(true);
            }
          } else {
            // Token expired, try to refresh
            await refreshAccessToken();
          }
        } catch (err) {
          console.error('Auth check failed:', err);
          clearAuth();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  /**
   * Sign Up
   */
  const signup = useCallback(async (username, email, password, phone_number = '') => {
    setError(null);
    setLoading(true);

    try {
      logApiCall('POST', API_ENDPOINTS.AUTH_SIGNUP, { username, email, phone_number });

      const response = await fetch(API_ENDPOINTS.AUTH_SIGNUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, phone_number }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      if (data.success) {
        const userData = {
          id: data.data.userId,
          username: data.data.username,
          email: data.data.email,
          phone_number: data.data.phone_number || ''
        };
        setUser(userData);
        setAccessToken(data.data.accessToken);
        sessionStorage.setItem('accessToken', data.data.accessToken);
        setIsAuthenticated(true);
        console.log('✅ Signup successful:', userData);
        return { success: true };
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      console.error('Signup error:', errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Login
   */
  const login = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      logApiCall('POST', API_ENDPOINTS.AUTH_LOGIN, { email });

      const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.success) {
        setUser({
          id: data.data.userId,
          username: data.data.username,
          email: data.data.email,
          phone_number: data.data.phone_number
        });
        setAccessToken(data.data.accessToken);
        sessionStorage.setItem('accessToken', data.data.accessToken);
        setIsAuthenticated(true);
        return { success: true };
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh Access Token
   */
  const refreshAccessToken = useCallback(async () => {
    try {
      logApiCall('POST', API_ENDPOINTS.AUTH_REFRESH);

      const response = await fetch(API_ENDPOINTS.AUTH_REFRESH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // IMPORTANT: Send cookies with request
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAccessToken(data.data.accessToken);
        sessionStorage.setItem('accessToken', data.data.accessToken);
        console.log('✅ Token refreshed successfully');
        return true;
      } else {
        console.error('Token refresh failed:', data.error);
        clearAuth();
        return false;
      }
    } catch (err) {
      console.error('Token refresh error:', err);
      clearAuth();
      return false;
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      logApiCall('POST', API_ENDPOINTS.AUTH_LOGOUT);

      await fetch(API_ENDPOINTS.AUTH_LOGOUT, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuth();
    }
  }, []);

  /**
   * Clear Auth Data
   */
  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('accessToken');
    setError(null);
  }, []);

  const value = {
    user,
    accessToken,
    isAuthenticated,
    loading,
    error,
    signup,
    login,
    logout,
    refreshAccessToken,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
