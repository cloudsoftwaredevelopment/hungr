/**
 * Hungr API Configuration
 * Centralized endpoint management for all API calls
 * Supports environment-based URL switching
 */

// Determine the base URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// API Endpoints
export const API_ENDPOINTS = {
  // Health
  HEALTH: `${API_BASE_URL}/api/health`,

  // Authentication
  AUTH_SIGNUP: `${API_BASE_URL}/api/auth/signup`,
  AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  AUTH_REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  AUTH_LOGOUT: `${API_BASE_URL}/api/auth/logout`,

  // User
  USER_PROFILE: `${API_BASE_URL}/api/users/profile`,

  // Coins
  USER_COINS: `${API_BASE_URL}/api/users/coins`,
  USER_COINS_TRANSACTIONS: `${API_BASE_URL}/api/users/coins/transactions`,

  // Wallet
  USER_WALLET: `${API_BASE_URL}/api/users/wallet`,
  USER_WALLET_TRANSACTIONS: `${API_BASE_URL}/api/users/wallet/transactions`,

  // Addresses (Phase 2B)
  USER_ADDRESSES: `${API_BASE_URL}/api/users/addresses`,
  USER_ADDRESSES_DEFAULT: (addressId) => `${API_BASE_URL}/api/users/addresses/${addressId}/default`,
  GEOCODE_SEARCH: `${API_BASE_URL}/api/geocode/search`,
  GEOCODE_REVERSE: `${API_BASE_URL}/api/geocode/reverse`,
	
  // Restaurants
  RESTAURANTS: `${API_BASE_URL}/api/restaurants`,
  RESTAURANT_MENU: (restaurantId) => `${API_BASE_URL}/api/restaurants/${restaurantId}/menu`,

  // Orders
  CREATE_ORDER: `${API_BASE_URL}/api/orders`,
};

/**
 * Standard API Response Handler
 * Handles errors and response normalization
 */
export const handleApiResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const error = new Error(errorData.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  return response.json();
};

/**
 * Standardized API Error Handler
 * Returns user-friendly error messages
 */
export const handleApiError = (error) => {
  console.error('API Error:', error);

  if (error.status === 404) {
    return 'Resource not found';
  } else if (error.status === 400) {
    return error.data?.error || 'Invalid request';
  } else if (error.status === 401) {
    return error.data?.error || 'Unauthorized - Please login';
  } else if (error.status === 403) {
    return error.data?.error || 'Access denied';
  } else if (error.status === 500) {
    return 'Server error. Please try again later.';
  } else if (error instanceof TypeError) {
    return 'Network error. Please check your connection.';
  }

  return error.message || 'Something went wrong';
};

/**
 * Debug helper - logs API calls in development
 */
export const logApiCall = (method, endpoint, data = null) => {
  if (import.meta.env.DEV) {
    console.log(`[API] ${method} ${endpoint}`, data || '');
  }
};

/**
 * Make authenticated API request
 * Automatically includes Authorization header with token
 * Handles token refresh on expiry
 */
export const fetchWithAuth = async (endpoint, options = {}, token) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Include cookies (for refresh token)
  });

  // If token expired (403), try to refresh and retry
  if (response.status === 403 && token) {
    console.warn('Token expired, attempting refresh...');
    
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          const newToken = refreshData.data.accessToken;
          sessionStorage.setItem('accessToken', newToken);
          
          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(endpoint, {
            ...options,
            headers,
            credentials: 'include'
          });
        }
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
  }

  return handleApiResponse(response);
};
