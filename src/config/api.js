/**
 * Hungr API Configuration
 * Centralized endpoint management for all API calls
 * Supports environment-based URL switching
 */

// Determine the base URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// API Endpoints
export const API_ENDPOINTS = {
  // Restaurants
  RESTAURANTS: `${API_BASE_URL}/api/restaurants`,
  RESTAURANT_MENU: (restaurantId) => `${API_BASE_URL}/api/restaurants/${restaurantId}/menu`,
  
  // Orders
  CREATE_ORDER: `${API_BASE_URL}/api/orders`,
  
  // Future endpoints (for upcoming phases)
  // AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  // AUTH_SIGNUP: `${API_BASE_URL}/api/auth/signup`,
  // USER_PROFILE: `${API_BASE_URL}/api/users/profile`,
  // USER_ORDERS: (userId) => `${API_BASE_URL}/api/users/${userId}/orders`,
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
