import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Search, MapPin, Loader, Navigation, Crosshair } from 'lucide-react';

const API_URL = '/api';

const AddressEditor = ({ setView, onSave }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [coords, setCoords] = useState({ lat: 10.7202, lon: 122.5621 }); // Default: Iloilo
  const [loadingMap, setLoadingMap] = useState(true);
  const [addressLabel, setAddressLabel] = useState('Home');
  const [formattedAddress, setFormattedAddress] = useState('');

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerRef = useRef(null);

  // 0. Auto-detect Location on Mount
  useEffect(() => {
    // Pass false to NOT update the text field
    getCurrentLocation(false);
  }, []);

  const getCurrentLocation = (shouldUpdateText = true) => {
    if (!navigator.geolocation) return;

    // Only set loading if map isn't ready yet to avoid flicker
    if (!mapRef.current) setLoadingMap(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords = { lat: latitude, lon: longitude };
        setCoords(newCoords);

        // Only reverse geocode if explicitly requested (e.g. button click)
        if (shouldUpdateText) {
          await reverseGeocode(latitude, longitude);
        }

        // Update Map View if initialized
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([latitude, longitude], 18);
          markerRef.current.setLatLng([latitude, longitude]);
        }
        setLoadingMap(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLoadingMap(false);
        // Don't alert blocking errors on load, just fallback to default
      },
      { enableHighAccuracy: true }
    );
  };

  // 1. Initialize Map (Leaflet)
  useEffect(() => {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject Leaflet JS and Init
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Run once on mount

  const initMap = () => {
    if (mapRef.current || !mapContainerRef.current) return;

    const L = window.L;
    // Initialize map with current coords state (which might be updated by geolocation already)
    const map = L.map(mapContainerRef.current).setView([coords.lat, coords.lon], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Custom Red Pin Icon
    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const marker = L.marker([coords.lat, coords.lon], {
      draggable: true,
      icon: redIcon
    }).addTo(map);

    // Drag Listener
    marker.on('dragend', async (e) => {
      const { lat, lng } = e.target.getLatLng();
      setCoords({ lat, lon: lng });
      // Dragging ALWAYS updates text
      await reverseGeocode(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setLoadingMap(false);
  };

  // 2. Search Logic
  // Debounce Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query && query.length >= 3) {
        performSearch(query);
      } else {
        setSuggestions([]);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Just updates state, effect handles the fetch
  const handleSearch = (val) => {
    setQuery(val);
  };

  const performSearch = async (val) => {
    try {
      // Direct call to OSM Nominatim
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=ph&limit=5`);
      const data = await res.json();
      setSuggestions(data);
    } catch (e) { console.error(e); }
  };

  const selectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    setCoords({ lat, lon });
    setQuery(item.display_name);
    setFormattedAddress(item.display_name);
    setSuggestions([]);

    // Update Map
    if (mapRef.current && markerRef.current) {
      const L = window.L;
      mapRef.current.setView([lat, lon], 16);
      markerRef.current.setLatLng([lat, lon]);
    }
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      // Direct call to OSM Nominatim
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data && data.display_name) {
        setQuery(data.display_name);
        setFormattedAddress(data.display_name);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!formattedAddress) return alert("Please select a location");

    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/users/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          label: addressLabel,
          address: formattedAddress,
          latitude: coords.lat,
          longitude: coords.lon
        })
      });
      const data = await res.json();

      // Success check
      if (data.success) {
        alert("Address saved!");
        setView('addresses');
      } else {
        alert(data.error || "Failed to save address");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save address due to network error");
    }
  };

  return (
    // Overlay Container (Desktop: Dimmed background, centered. Mobile: Full screen white)
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:bg-black/50 sm:p-4 sm:animate-in sm:fade-in">

      {/* Content Card - Fixed height on desktop to ensure Map visibility */}
      <div className="bg-white w-full h-[100dvh] sm:h-[600px] sm:max-w-md sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-5 duration-300">

        {/* Header - Fixed Height */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white z-20 flex-shrink-0">
          <button onClick={() => setView('addresses')} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-lg font-bold">Pin Location</h2>
        </div>

        {/* Search Bar - Fixed Height */}
        <div className="p-4 bg-white relative z-[5000] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search street, city..."
              className="w-full bg-gray-50 p-3 pl-10 rounded-xl border border-gray-200 focus:border-orange-500 outline-none"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-1 max-h-60 overflow-auto border border-gray-100 z-[6000]">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion(s)} className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 text-sm">
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map Container - Flexible Height with MINIMUM ensuring visibility */}
        <div className="flex-1 relative bg-gray-100 min-h-[400px] sm:min-h-0 z-0 w-full shrink-0">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />
          {loadingMap && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-[1000]">
              <Loader className="animate-spin text-orange-600" />
            </div>
          )}

          {/* Floating Instruction */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md z-[400] text-xs font-bold text-gray-700 pointer-events-none whitespace-nowrap">
            Drag pin to adjust
          </div>

          {/* Locate Me Button */}
          <button
            onClick={() => getCurrentLocation(true)}
            className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg z-[400] text-gray-700 hover:text-orange-600 active:scale-95 transition"
            title="Use Current Location"
          >
            <Crosshair size={24} />
          </button>
        </div>

        {/* Footer Form - Fixed Height, always visible */}
        <div className="p-5 bg-white border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] relative z-[4000] flex-shrink-0 pb-safe">
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Label</label>
            <div className="flex gap-2">
              {['Home', 'Work', 'Other'].map(l => (
                <button
                  key={l}
                  onClick={() => setAddressLabel(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${addressLabel === l ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Address Detail</label>
            <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100 truncate">
              {formattedAddress || "Select a location on map"}
            </p>
          </div>
          <button
            onClick={handleSave}
            className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition"
          >
            Save Address
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddressEditor;
