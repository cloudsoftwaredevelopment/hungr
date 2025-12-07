import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ChevronLeft, Bike, Car, ArrowRight, Star, Clock, Search, Crosshair, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api'; // Use relative path for proxy
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export default function RidesView() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('bike');
  const [loading, setLoading] = useState(false);
  const [showSavedPickup, setShowSavedPickup] = useState(false);
  const [showSavedDropoff, setShowSavedDropoff] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);

  // --- STATE ---
  // Pickup
  const [pickup, setPickup] = useState({
    lat: 10.7202, lon: 122.5621, address: '', rawAddress: ''
  });
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState([]);

  // Dropoff
  const [dropoff, setDropoff] = useState({
    lat: 10.7220, lon: 122.5650, address: '', rawAddress: ''
  });
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);

  // Calculations
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);

  // --- MAP REFS ---
  const pickupMapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMapRef = useRef(null);
  const dropoffMarkerRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Inject Leaflet if needed (should be global if used in other components, but adding here to be safe)
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => { initMaps(); };
      document.head.appendChild(script);
    } else {
      // slight delay to ensure container render
      setTimeout(initMaps, 100);
    }

    // Initial Location
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      updateLocation('pickup', latitude, longitude, true);
    }, () => { }, { enableHighAccuracy: true });

    fetchSavedAddresses();

    return () => {
      if (pickupMapRef.current) pickupMapRef.current.remove();
      if (dropoffMapRef.current) dropoffMapRef.current.remove();
    };
  }, []);

  const initMaps = () => {
    if (!window.L) return;
    const L = window.L;

    const createMap = (id, coords, onChange) => {
      if (!document.getElementById(id)) return null;
      const map = L.map(id, { zoomControl: false }).setView([coords.lat, coords.lon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);

      const icon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], shadowSize: [41, 41]
      });

      const marker = L.marker([coords.lat, coords.lon], { draggable: true, icon }).addTo(map);

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        onChange(lat, lng);
      });
      return { map, marker }; // Return object wrapper
    };

    // Cleanup old maps if re-init
    if (pickupMapRef.current) pickupMapRef.current.remove();
    if (dropoffMapRef.current) dropoffMapRef.current.remove();

    const pm = createMap('pickup-map', pickup, (lat, lon) => updateLocation('pickup', lat, lon));
    if (pm) { pickupMapRef.current = pm.map; pickupMarkerRef.current = pm.marker; }

    const dm = createMap('dropoff-map', dropoff, (lat, lon) => updateLocation('dropoff', lat, lon));
    if (dm) { dropoffMapRef.current = dm.map; dropoffMarkerRef.current = dm.marker; }
  };

  const fetchSavedAddresses = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/users/addresses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSavedAddresses(data.data);
    } catch (e) { console.error("Addr fetch err", e); }
  };

  // --- LOGIC ---

  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate Fare whenever coords change
  useEffect(() => {
    if (pickup.address && dropoff.address) {
      const distKm = haversine(pickup.lat, pickup.lon, dropoff.lat, dropoff.lon);
      setDistance(distKm);
      const basePrice = 10;
      let price = Math.max(10, Math.ceil(distKm * 10)); // 10 pesos / km, min 10
      setFare(price);
    }
  }, [pickup.lat, pickup.lon, dropoff.lat, dropoff.lon, pickup.address, dropoff.address]);


  const updateLocation = async (type, lat, lon, doReverse = true) => {
    const setFn = type === 'pickup' ? setPickup : setDropoff;
    const setQueryFn = type === 'pickup' ? setPickupQuery : setDropoffQuery;
    const mapRef = type === 'pickup' ? pickupMapRef : dropoffMapRef;
    const markerRef = type === 'pickup' ? pickupMarkerRef : dropoffMarkerRef;

    // Update State Coords
    setFn(prev => ({ ...prev, lat, lon }));

    // Update Map View
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lon], 15);
      markerRef.current.setLatLng([lat, lon]);
    }

    if (doReverse) {
      try {
        // Reverse Geocode
        const res = await fetch(`${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lon}`);
        const d = await res.json();
        if (d.display_name) {
          setFn(prev => ({ ...prev, address: d.display_name }));
          setQueryFn(d.display_name); // Sync input
        }
      } catch (e) { }
    }
  };

  // Debouce Ref
  const searchTimeoutRef = useRef(null);

  const handleSearch = (type, val) => {
    const setQuery = type === 'pickup' ? setPickupQuery : setDropoffQuery;
    const setSugg = type === 'pickup' ? setPickupSuggestions : setDropoffSuggestions;
    setQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.length < 3) { setSugg([]); return; }

    // 800ms Debounce for "longer display time" stability
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(val)}&countrycodes=ph&limit=5`);
        const d = await res.json();
        setSugg(d);
      } catch (e) { }
    }, 800);
  };

  const selectSuggestion = (type, item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    updateLocation(type, lat, lon, false);
    const setFn = type === 'pickup' ? setPickup : setDropoff;
    const setQuery = type === 'pickup' ? setPickupQuery : setDropoffQuery;
    const setSugg = type === 'pickup' ? setPickupSuggestions : setDropoffSuggestions;

    setFn(prev => ({ ...prev, address: item.display_name }));
    setQuery(item.display_name);
    setSugg([]);
  };

  const selectSaved = (type, addr) => {
    updateLocation(type, parseFloat(addr.latitude), parseFloat(addr.longitude), false);
    if (type === 'pickup') {
      setPickup(prev => ({ ...prev, address: addr.address }));
      setPickupQuery(addr.address);
      setShowSavedPickup(false);
    } else {
      setDropoff(prev => ({ ...prev, address: addr.address }));
      setDropoffQuery(addr.address);
      setShowSavedDropoff(false);
    }
  };

  const handleBook = async () => {
    if (!pickup.address || !dropoff.address) return alert("Please set both locations");
    setLoading(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          orderType: 'ride',
          pickup,
          dropoff,
          fare,
          distance,
          selectedType // 'bike' or 'car'
        })
      });
      const d = await res.json();
      if (d.success) {
        alert(`Booking Sent! Rider searching... (ID: ${d.data.orderId})`);
        navigate('/');
      } else {
        alert(d.error || "Booking failed");
      }
    } catch (e) {
      alert("Network Error");
    } finally {
      setLoading(false);
    }
  };

  /* --- MISSING HELPERS RE-ADDED --- */
  const getAddr = (lbl) => savedAddresses.find(a => a.label && a.label.toLowerCase() === lbl.toLowerCase());

  const handleQuickSelect = (type, lbl) => {
    const addr = getAddr(lbl);
    if (addr) {
      selectSaved(type, addr);
    } else {
      // Optional: Prompt to add? For now just alert or ignore.
      // In a real app, this would open a modal to "Add Home Address"
      alert(`You haven't saved a ${lbl} address yet. Go to your Profile > Addresses to add one.`);
    }
  };

  const renderQuickButtons = (type) => (
    <div className="flex gap-2">
      {['Home', 'Work'].map(lbl => {
        const addr = getAddr(lbl);
        return (
          <button
            key={lbl}
            onClick={() => handleQuickSelect(type, lbl)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${addr
              ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
              }`}
          >
            {lbl === 'Home' ? <div className="w-2 h-2 rounded-full bg-blue-400" /> : <div className="w-2 h-2 bg-slate-400 rounded-sm" />}
            {lbl}
            {!addr && <span className="text-[8px] font-normal opacity-70">(Empty)</span>}
          </button>
        );
      })}
      <button
        onClick={() => type === 'pickup' ? setShowSavedPickup(!showSavedPickup) : setShowSavedDropoff(!showSavedDropoff)}
        className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1"
      >
        <Star size={10} /> Saved
      </button>
    </div>
  );

  return (
    // Fixed Height Container (h-[100dvh] fixes mobile browser bar offset)
    <div className="font-sans bg-slate-50 h-[100dvh] flex flex-col relative overflow-hidden">

      {/* --- HEADER --- */}
      <div className="bg-white px-4 py-3 shadow-md border-b border-gray-100 flex-shrink-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black text-slate-800 tracking-tighter">RIDE <span className="text-orange-600">BOOKING</span></h1>
        </div>

        {/* TYPE SELECTOR */}
        <div className="grid grid-cols-2 gap-3">
          {[{ id: 'bike', icon: Bike, lbl: 'Motorbike' }, { id: 'car', icon: Car, lbl: 'Car' }].map(t => (
            <button
              key={t.id} onClick={() => setSelectedType(t.id)}
              className={`py-3 rounded-xl flex items-center justify-center gap-2 border transition-all ${selectedType === t.id ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200' : 'bg-white border-gray-200 text-gray-400'
                }`}
            >
              <t.icon size={20} /> <span className="font-bold text-sm tracking-wide">{t.lbl}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT (Scrollable) --- */}
      <div className="flex-1 overflow-y-auto bg-slate-50 relative z-10">

        {/* PICKUP SECTION */}
        <div className="p-4 bg-white mb-2 border-b border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" /> PICK UP
            </span>
            {renderQuickButtons('pickup')}
          </div>

          {/* SAVED DROPDOWN PICKUP */}
          {showSavedPickup && (
            <div className="mb-3 bg-slate-50 border border-slate-100 rounded-xl p-2 animate-in slide-in-from-top-2">
              <p className="text-[10px] font-bold text-slate-400 mb-2 px-1">ALL SAVED LOCATIONS</p>
              {savedAddresses.length === 0 ? <p className="text-xs p-2 text-slate-400 italic">No saved addresses</p> :
                savedAddresses.map(addr => (
                  <button key={addr.id} onClick={() => selectSaved('pickup', addr)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-white rounded-lg transition border-b border-slate-200 last:border-0">
                    <MapPin size={14} className="text-orange-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{addr.label}</p>
                      <p className="text-[10px] text-slate-500 truncate w-48">{addr.address}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          )}

          {/* MAP */}
          <div className="w-full h-40 bg-slate-100 rounded-xl overflow-hidden relative mb-3 border border-slate-200">
            <div id="pickup-map" className="w-full h-full z-0" />
            <div className="absolute top-2 right-2 bg-white p-1.5 rounded-lg shadow z-[400]" onClick={() => updateLocation('pickup', pickup.lat, pickup.lon, true)}><Navigation size={14} className="text-blue-500" /></div>
          </div>

          {/* INPUT */}
          <div className="relative">
            <input
              value={pickupQuery} onChange={e => handleSearch('pickup', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-3 px-10 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              placeholder="Search pickup location..."
            />
            <div className="absolute left-3 top-3.5 w-4 h-4 rounded-full border-[3px] border-blue-500 bg-white" />

            {pickupSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-1 max-h-60 overflow-auto border border-gray-100 z-50">
                {pickupSuggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion('pickup', s)} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 text-xs font-medium text-slate-600">
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DESTINATION SECTION */}
        <div className="p-4 bg-white border-b border-gray-100 shadow-sm relative z-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" /> DROP OFF
            </span>
            {renderQuickButtons('dropoff')}
          </div>

          {/* SAVED DROPDOWN DROPOFF */}
          {showSavedDropoff && (
            <div className="mb-3 bg-slate-50 border border-slate-100 rounded-xl p-2 animate-in slide-in-from-top-2">
              <p className="text-[10px] font-bold text-slate-400 mb-2 px-1">ALL SAVED LOCATIONS</p>
              {savedAddresses.length === 0 ? <p className="text-xs p-2 text-slate-400 italic">No saved addresses</p> :
                savedAddresses.map(addr => (
                  <button key={addr.id} onClick={() => selectSaved('dropoff', addr)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-white rounded-lg transition border-b border-slate-200 last:border-0">
                    <MapPin size={14} className="text-orange-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{addr.label}</p>
                      <p className="text-[10px] text-slate-500 truncate w-48">{addr.address}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          )}

          {/* MAP */}
          <div className="w-full h-40 bg-slate-100 rounded-xl overflow-hidden relative mb-3 border border-slate-200">
            <div id="dropoff-map" className="w-full h-full z-0" />
          </div>

          {/* INPUT */}
          <div className="relative">
            <input
              value={dropoffQuery} onChange={e => handleSearch('dropoff', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-3 px-10 text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
              placeholder="Search destination..."
            />
            <MapPin size={18} className="absolute left-3 top-3.5 text-orange-500" />

            {dropoffSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-1 max-h-48 overflow-auto border border-gray-100 z-50">
                {dropoffSuggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion('dropoff', s)} className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 text-xs font-medium text-slate-600">
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- FOOTER: FARE & BOOK (Static Flex Item) --- */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-between items-end mb-4 px-2">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Distance</p>
            <p className="text-lg font-black text-slate-800 flex items-center gap-1">
              <Navigation size={18} className="text-slate-400" /> {distance.toFixed(1)} km
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Fare</p>
            <p className="text-3xl font-black text-orange-600 tracking-tighter">₱{fare}</p>
          </div>
        </div>

        <button
          onClick={handleBook}
          disabled={loading || fare === 0}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-300 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader className="animate-spin" /> :
            <>BOOK RIDE <ArrowRight size={20} /></>
          }
        </button>
      </div>

    </div>
  );
}
