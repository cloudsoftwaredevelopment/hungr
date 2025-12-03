import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Loader, AlertCircle, X, Clock, DollarSign, ChevronRight } from 'lucide-react';
import { API_ENDPOINTS, handleApiResponse, handleApiError, logApiCall } from '../../config/api';

export default function RidesView({ 
  setView, 
  userLocation, 
  onLocationUpdate,
  setRideError,
  rideError,
  rideLoading
}) {
  // State
  const [currentLocation, setCurrentLocation] = useState(userLocation || null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [distance, setDistance] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Get user's current location on component mount
  useEffect(() => {
    if (!currentLocation) {
      getUserLocation();
    }
  }, []);

  // Get user's current location via geolocation API
  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      setRideError('Geolocation is not supported by your browser');
      return;
    }

    setLoadingLocation(true);
    setRideError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`📍 Location found: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

        try {
          // Reverse geocode to get address
          logApiCall('GET', API_ENDPOINTS.GEOCODE_REVERSE);
          
          const response = await fetch(
            `${API_ENDPOINTS.GEOCODE_REVERSE}?lat=${latitude}&lon=${longitude}`
          );
          const data = await handleApiResponse(response);

          const locationData = {
            lat: latitude,
            lon: longitude,
            address: data.data?.address || data.data?.display_name || 'Current Location'
          };

          setCurrentLocation(locationData);
          if (onLocationUpdate) onLocationUpdate(locationData);
          setLoadingLocation(false);
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setRideError('Failed to get address for current location');
          
          // Fallback: use coordinates
          setCurrentLocation({
            lat: latitude,
            lon: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        
        let errorMsg = 'Unable to access your location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location access denied. Please enable location services in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timeout.';
        }

        setRideError(errorMsg);
        setLoadingLocation(false);
      }
    );
  };

  // Search for destination addresses
  const searchDestination = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      logApiCall('GET', API_ENDPOINTS.GEOCODE_SEARCH);
      
      const response = await fetch(
        `${API_ENDPOINTS.GEOCODE_SEARCH}?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await handleApiResponse(response);

      if (data.success && Array.isArray(data.data)) {
        setSuggestions(data.data);
        console.log(`Found ${data.data.length} suggestions for "${query}"`);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      const errorMsg = handleApiError(err);
      setSearchError(errorMsg);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle destination input change with debouncing
  const handleDestinationChange = (value) => {
    setDestinationQuery(value);
    setSelectedDestination(null);
    setEstimatedFare(null);
    setDistance(null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout (debounce 300ms)
    searchTimeoutRef.current = setTimeout(() => {
      searchDestination(value);
    }, 300);
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion) => {
    const destination = {
      lat: parseFloat(suggestion.latitude),
      lon: parseFloat(suggestion.longitude),
      address: suggestion.address || suggestion.display_name
    };

    setSelectedDestination(destination);
    setDestinationQuery(destination.address);
    setSuggestions([]);
    setSearchError(null);

    // Calculate distance and fare
    if (currentLocation) {
      calculateDistanceAndFare(currentLocation, destination);
    }
  };

  // Calculate distance using Haversine formula and estimate fare
  const calculateDistanceAndFare = (start, end) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((end.lat - start.lat) * Math.PI) / 180;
    const dLon = ((end.lon - start.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((start.lat * Math.PI) / 180) *
        Math.cos((end.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const calculatedDistance = R * c;

    setDistance(calculatedDistance.toFixed(1));

    // Estimate fare: ₱40 base + ₱15 per km
    const baseFare = 40;
    const perKmRate = 15;
    const fare = baseFare + calculatedDistance * perKmRate;
    setEstimatedFare({
      minimum: Math.ceil(fare),
      maximum: Math.ceil(fare * 1.2)
    });

    console.log(`Distance: ${calculatedDistance.toFixed(1)} km, Fare: ₱${fare.toFixed(2)}`);
  };

  // Refresh current location
  const handleRefreshLocation = () => {
    setCurrentLocation(null);
    getUserLocation();
  };

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold mb-6">Book a Ride</h2>

      {/* Error Banner */}
      {rideError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">{rideError}</p>
          </div>
          <button 
            onClick={() => setRideError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* CURRENT LOCATION SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-900">Your Current Location</h3>
          </div>
          <button
            onClick={handleRefreshLocation}
            disabled={loadingLocation}
            className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
            title="Refresh location"
          >
            {loadingLocation ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Navigation size={16} />
            )}
          </button>
        </div>

        {loadingLocation ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader size={16} className="animate-spin" />
            <span className="text-sm">Getting your location...</span>
          </div>
        ) : currentLocation ? (
          <div>
            <div className="bg-gray-50 rounded-lg p-3 mb-2">
              <p className="text-sm font-medium text-gray-900">{currentLocation.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
              </p>
            </div>
            <button
              onClick={handleRefreshLocation}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Update location
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">Unable to get your location</p>
            <button
              onClick={handleRefreshLocation}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* DESTINATION SEARCH SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search size={20} className="text-orange-600" />
          <h3 className="font-bold text-gray-900">Where to?</h3>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Enter destination address..."
            value={destinationQuery}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            disabled={!currentLocation}
          />

          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery('');
                setSuggestions([]);
                setSelectedDestination(null);
              }}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}

          {/* Loading indicator */}
          {searching && (
            <div className="absolute right-3 top-3">
              <Loader size={16} className="animate-spin text-orange-600" />
            </div>
          )}
        </div>

        {/* Search Error */}
        {searchError && (
          <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-600">{searchError}</p>
          </div>
        )}

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 hover:bg-gray-100 transition border-b border-gray-200 last:border-b-0 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {suggestion.address || suggestion.display_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {suggestion.display_name}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 flex-shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {destinationQuery.length >= 2 && !searching && suggestions.length === 0 && !searchError && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No addresses found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search</p>
          </div>
        )}
      </div>

      {/* ROUTE SUMMARY SECTION */}
      {selectedDestination && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-4">Trip Summary</h3>

          {/* Route details */}
          <div className="space-y-3 mb-4">
            {/* From */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div className="w-0.5 h-12 bg-gray-300 my-1"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs text-gray-500 font-medium">From</p>
                <p className="text-sm font-medium text-gray-900">{currentLocation.address}</p>
              </div>
            </div>

            {/* To */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs text-gray-500 font-medium">To</p>
                <p className="text-sm font-medium text-gray-900">{selectedDestination.address}</p>
              </div>
            </div>
          </div>

          {/* Distance and Fare */}
          {distance && estimatedFare && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-blue-200">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">Distance</div>
                <div className="text-lg font-bold text-gray-900">{distance} km</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">Est. Fare</div>
                <div className="text-lg font-bold text-orange-600">
                  ₱{estimatedFare.minimum}-{estimatedFare.maximum}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOOK RIDE BUTTON */}
      {currentLocation && selectedDestination && estimatedFare && (
        <button
          onClick={() => {
            // Will implement ride confirmation in next phase
            console.log('Book ride:', {
              from: currentLocation,
              to: selectedDestination,
              fare: estimatedFare,
              distance: distance
            });
            // setView('ride-confirm');
          }}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-between px-6 transition"
        >
          <span>Book Ride</span>
          <span className="text-lg">₱{estimatedFare.minimum}</span>
        </button>
      )}

      {/* Help text */}
      {!selectedDestination && currentLocation && (
        <div className="text-center py-6 text-gray-500">
          <MapPin size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Enter your destination to continue</p>
        </div>
      )}
    </div>
  );
}
