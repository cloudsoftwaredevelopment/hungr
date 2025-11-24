// ========================================
// FILE 2: src/components/Address/AddressSearch.jsx
// ========================================

import React, { useState, useEffect } from 'react';
import { Search, Loader, AlertCircle, MapPin } from 'lucide-react';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';

export default function AddressSearch({ onAddressSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Debounce search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchAddresses(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const searchAddresses = async (searchQuery) => {
    setLoading(true);
    setError(null);

    try {
      logApiCall('GET', `${API_ENDPOINTS.RESTAURANTS}geocode/search?q=${searchQuery}`);
      const endpoint = `${API_ENDPOINTS.RESTAURANTS.replace('/api/restaurants', '')}/api/geocode/search?q=${encodeURIComponent(searchQuery)}&limit=5`;
      
      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    setLoadingLocation(true);
    setError(null);

    try {
      // Get current position
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('📍 Current location:', { latitude, longitude });

          // Reverse geocode
          try {
            logApiCall('GET', `${API_ENDPOINTS.RESTAURANTS}geocode/reverse?lat=${latitude}&lon=${longitude}`);
            const endpoint = `${API_ENDPOINTS.RESTAURANTS.replace('/api/restaurants', '')}/api/geocode/reverse?lat=${latitude}&lon=${longitude}`;
            
            const response = await fetch(endpoint);
            const data = await response.json();

            if (data.success) {
              onAddressSelect({
                address: data.data.address,
                latitude: parseFloat(data.data.latitude),
                longitude: parseFloat(data.data.longitude)
              });
              onClose();
            } else {
              setError('Could not get address from location');
            }
          } catch (err) {
            setError(handleApiError(err));
          } finally {
            setLoadingLocation(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Unable to access your location. Please enable location services.');
          setLoadingLocation(false);
        }
      );
    } catch (err) {
      setError(handleApiError(err));
      setLoadingLocation(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Search Address</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
          />
        </div>

        {/* Current Location Button */}
        <button
          onClick={getCurrentLocation}
          disabled={loadingLocation}
          className="w-full mb-4 py-3 bg-orange-50 border border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loadingLocation ? (
            <>
              <Loader size={18} className="animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <MapPin size={18} />
              Use Current Location
            </>
          )}
        </button>

        {/* Results */}
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-orange-600" />
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 mb-3">Search Results:</p>
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onAddressSelect({
                      address: result.address,
                      latitude: parseFloat(result.latitude),
                      longitude: parseFloat(result.longitude)
                    });
                    onClose();
                  }}
                  className="w-full text-left p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 hover:border-orange-300 transition"
                >
                  <p className="font-medium text-sm text-gray-900">{result.address}</p>
                  <p className="text-xs text-gray-400 mt-1">{result.type}</p>
                </button>
              ))}
            </>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center py-8 text-gray-500">No addresses found</p>
          )}

          {!loading && query.length === 0 && (
            <p className="text-center py-8 text-gray-400">Start typing to search addresses</p>
          )}
        </div>
      </div>
    </div>
  );
}

