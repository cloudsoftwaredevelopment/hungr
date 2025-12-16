import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';

// Define API URL here or import from a config file
const API_URL = '/api';
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for idle timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkIdle = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      if (timeSinceActivity >= IDLE_TIMEOUT_MS) {
        console.log('[AuthContext] Idle timeout - logging out');
        logout();
        alert('You have been logged out due to inactivity.');
      }
    };

    // Check every 30 seconds
    idleTimerRef.current = setInterval(checkIdle, 30000);

    // Listen for user activity
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true });
    });

    return () => {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [isAuthenticated, resetIdleTimer]);

  // Restore session on mount
  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    const savedUser = sessionStorage.getItem('user');

    console.log("[AuthContext] Checking session...", { tokenPresent: !!token, userPresent: !!savedUser });

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log("[AuthContext] Session restored for:", parsedUser.email);
        setUser(parsedUser);
        setIsAuthenticated(true);
        lastActivityRef.current = Date.now();
      } catch (e) {
        console.error("[AuthContext] Failed to parse user data:", e);
        sessionStorage.clear();
      }
    } else {
      console.log("[AuthContext] No session found.");
    }

    setLoading(false);
  }, []);

  const login = async (email, password, rememberMe = false) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        // Save session data
        sessionStorage.setItem('accessToken', data.data.accessToken);
        sessionStorage.setItem('user', JSON.stringify(data.data));
        setUser(data.data);
        setIsAuthenticated(true);
        lastActivityRef.current = Date.now();

        // Save to localStorage if Remember Me is checked
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberMe');
        }

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
    if (idleTimerRef.current) clearInterval(idleTimerRef.current);
  };

  // Get remembered credentials
  const getRememberedCredentials = () => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const email = localStorage.getItem('rememberedEmail') || '';
    return { rememberMe, email };
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading, getRememberedCredentials }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

