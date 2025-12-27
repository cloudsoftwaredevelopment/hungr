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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:bg-black/60 sm:p-4 sm:animate-in sm:fade-in">

      {/* Content Card */}
      <div className="bg-white w-full h-[100dvh] sm:h-[600px] sm:max-w-md sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">

        {/* Header */}
        <div className="flex items-center gap-4 p-5 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl z-20 flex-shrink-0">
          <button
            onClick={() => setView('addresses')}
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight leading-tight uppercase">
              Pin <span className="text-orange-600 italic">Location</span>
            </h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Where should we deliver?</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-5 bg-white relative z-[5000] flex-shrink-0 pb-2">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none z-10">
              <div className="w-11 h-11 flex items-center justify-center">
                <Search className="text-slate-400 group-focus-within:text-orange-600 transition-colors" size={20} strokeWidth={2.5} />
              </div>
            </div>
            <input
              type="text"
              placeholder="Search street, building or city..."
              className="w-full bg-slate-50 p-4 pl-12 rounded-2xl border-none focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all text-sm font-black shadow-inner placeholder:text-slate-400"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl shadow-2xl rounded-[1.8rem] mt-2 max-h-60 overflow-auto border border-slate-100 z-[6000] p-2 space-y-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left p-4 hover:bg-orange-50 rounded-xl border-b border-transparent last:border-0 text-sm font-black text-gray-700 transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                      <MapPin size={16} strokeWidth={2.5} />
                    </div>
                    <span className="truncate">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-100 min-h-[350px] sm:min-h-0 z-0 w-full shrink-0">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />
          {loadingMap && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-[1000]">
              <div className="w-12 h-12 border-4 border-orange-100 rounded-full border-t-orange-600 animate-spin"></div>
            </div>
          )}

          {/* Floating Instruction */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-2xl z-[400] text-[10px] font-black uppercase tracking-widest text-white pointer-events-none whitespace-nowrap border border-white/10">
            DRAG PIN TO REFINE LOCATION
          </div>

          {/* Locate Me Button */}
          <button
            onClick={() => getCurrentLocation(true)}
            className="absolute bottom-6 right-6 bg-white w-14 h-14 rounded-2xl shadow-2xl z-[400] flex items-center justify-center text-slate-800 hover:text-orange-600 hover:scale-110 active:scale-95 transition-all border border-slate-100"
            title="Use Current Location"
          >
            <Crosshair size={28} strokeWidth={2.5} />
          </button>
        </div>

        {/* Footer Form */}
        <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] relative z-[4000] flex-shrink-0 pb-safe rounded-t-[2.5rem]">
          <div className="mb-5">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">SAVE LOCATION AS</h3>
            <div className="flex gap-3">
              {['Home', 'Work', 'Other'].map(l => (
                <button
                  key={l}
                  onClick={() => setAddressLabel(l)}
                  className={`flex-1 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${addressLabel === l
                    ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/30'
                    : 'bg-white text-slate-400 border-slate-50 hover:border-orange-200 hover:text-orange-600 shadow-sm'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">DELIVERY ADDRESS</h3>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <MapPin size={16} className="text-orange-600 flex-shrink-0" />
              <p className="text-[11px] font-black text-gray-800 leading-tight uppercase tracking-tight truncate">
                {formattedAddress || "SELECT ON MAP"}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-5 rounded-[1.8rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-900/40 active:scale-95 transition-all text-xs transform hover:-translate-y-1"
          >
            CONFIRM ADDRESS
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddressEditor;
