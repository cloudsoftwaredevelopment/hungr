import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, ShoppingBag, ArrowRight, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import PabiliOrderForm from './PabiliOrderForm';

export default function Pabili() {
  const navigate = useNavigate();

  // State
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [userLocation, setUserLocation] = useState(null);

  // Categories for filtering
  const categories = ['All', 'Grocery', 'Pharmacy', 'Bakery', 'Pet Shop', 'Hardware', 'Stationery', 'Convenience'];

  // 1. Get User Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, long: pos.coords.longitude });
        },
        (err) => console.log("Location denied")
      );
    }
    fetchStores();
  }, []);

  // 2. Fetch Logic
  const fetchStores = async (query = '', cat = 'All') => {
    setLoading(true);
    try {
      let url = `https://nfcrevolution.com/hungr/api/pabili/stores?category=${cat}`;

      if (query.length > 2) {
        const loc = userLocation ? `&lat=${userLocation.lat}&long=${userLocation.long}` : '';
        url = `https://nfcrevolution.com/hungr/api/pabili/search?q=${query}${loc}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setStores(data.data);
      } else {
        setStores([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStores(searchQuery, activeCategory);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeCategory]);

  /* --- SELECTED STORE LOGIC --- */
  const { id } = useParams();
  const selectedStore = stores.find(s => s.id === parseInt(id));

  // If ID present but store not loaded (e.g. refresh), fetch specific store could be better, 
  // but for now we rely on the list fetch or fallback to loading state.
  // In a real app we'd fetchStoreById(id).

  if (id && !selectedStore && !loading && stores.length > 0) {
    // Store ID invalid or not found in list (might need dedicated fetch)
    // For MVP just standard list
  }

  if (id && selectedStore) {
    return (
      <div className="pb-20 font-sans bg-gray-50 min-h-screen p-4">
        <button
          onClick={() => navigate('/pabili')}
          className="mb-4 flex items-center gap-2 text-gray-500 font-bold text-sm hover:text-orange-600 transition-colors"
        >
          <ChevronLeft size={20} /> Back to Stores
        </button>
        <PabiliOrderForm store={selectedStore} onCancel={() => navigate('/pabili')} />
      </div>
    );
  }

  return (
    <div className="pb-20 font-sans bg-gray-50 min-h-screen">

      {/* --- CLEAN HEADER SECTION --- */}
      <div className="bg-white sticky top-0 z-20 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]">

        {/* Top Bar: Navigation & Title */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Pabili Service</span>
            <h1 className="text-xl font-black text-gray-800 tracking-tight leading-none">
              SHOP <span className="text-orange-600">ANYTHING</span>
            </h1>
          </div>

          <div className="w-10"></div> {/* Spacer for visual balance */}
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 text-gray-800 rounded-2xl py-3.5 pl-11 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all placeholder:text-gray-400"
              placeholder="What do you need us to buy?"
            />
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer hover:text-orange-600 text-gray-400 transition-colors">
              <SlidersHorizontal size={18} />
            </div>
          </div>
        </div>

        {/* Categories Tabs */}
        <div className="pl-4 pb-4 flex gap-3 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeCategory === cat
                  ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-200 scale-105'
                  : 'bg-white text-gray-500 border-gray-100 shadow-sm hover:border-orange-200 hover:text-orange-600'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- RESULTS GRID --- */}
      <div className="p-4 space-y-5">

        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-gray-800">
            {searchQuery ? `Results for "${searchQuery}"` : 'Recommended Stores'}
          </h2>
          {userLocation && (
            <span className="text-[10px] font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
              <MapPin size={10} className="fill-green-600 text-green-600" /> Location Active
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-gray-100 shadow-sm flex overflow-hidden">
                <div className="w-28 bg-gray-200 h-full"></div>
                <div className="p-4 flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {stores.map((store) => (
              <div
                key={store.id}
                onClick={() => navigate(`/pabili/store/${store.id}`)}
                className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all flex gap-3 cursor-pointer group active:scale-[0.99]"
              >
                {/* Store Image (Thumbnail Style) */}
                <div className="w-24 h-24 bg-gray-100 rounded-xl shrink-0 overflow-hidden relative">
                  <img
                    src={store.image_url || 'https://via.placeholder.com/150'}
                    alt={store.name}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=Store'}
                  />
                  {store.is_featured === 1 && (
                    <div className="absolute top-0 left-0 w-full bg-orange-500/90 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-wide">
                      Featured
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-800 text-base leading-tight truncate pr-2 group-hover:text-orange-600 transition-colors">{store.name}</h3>
                    <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                      <Star size={10} className="text-orange-500 fill-orange-500" />
                      <span className="text-xs font-bold text-gray-700">{store.rating || 'New'}</span>
                    </div>
                  </div>

                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-1 truncate">
                    <MapPin size={12} /> {store.address || 'Iloilo City'}
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      {store.category}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                      <Clock size={10} /> {store.distance ? `${Math.ceil(store.distance * 3)} min` : '15-20 min'}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <div className="self-center text-gray-300 group-hover:text-orange-500 transition-colors">
                  <ArrowRight size={18} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <ShoppingBag size={32} className="text-gray-300" />
            </div>
            <h3 className="text-gray-800 font-bold text-lg">No stores found</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto mt-1">We couldn't find any stores matching your search. Try "Grocery" or "Bakery".</p>
          </div>
        )}
      </div>
    </div>
  );
}
