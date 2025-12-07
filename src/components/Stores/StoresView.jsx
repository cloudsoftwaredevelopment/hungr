import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, Clock, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StoresView({ addToCart }) {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Example categories for Stores
  const categories = ['All', 'Fashion', 'Gadgets', 'Beauty', 'Home', 'Groceries'];

  useEffect(() => { fetchStores(); }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      // Fetching from pabili/stores for now as it returns the stores table content
      const response = await fetch('https://nfcrevolution.com/hungr/api/pabili/stores');
      const data = await response.json();
      if (data.success) setStores(data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || store.category === activeCategory; // Assuming store has category field
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pb-24 font-sans bg-gray-50 min-h-screen">
      {/* --- HEADER --- */}
      <div className="bg-white sticky top-0 z-30 pt-3 pb-1 shadow-sm flex flex-col gap-3">
        <div className="px-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 text-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all placeholder:text-gray-400"
              placeholder="Search stores..."
            />
          </div>
        </div>

        {/* Categories - Horizontal Scroll */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeCategory === cat
                  ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                  : 'bg-white text-gray-500 border-gray-200 hover:text-orange-600'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />)}
          </div>
        ) : (
          <>
            <h2 className="font-bold text-lg mb-4 text-gray-800">All Stores</h2>
            <div className="grid grid-cols-2 gap-4 pb-20">
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]"
                  onClick={() => navigate(`/stores/${store.id}`)}
                >
                  <div className="h-28 bg-gray-200 relative">
                    <img
                      src={store.image_url || "https://via.placeholder.com/400x200"}
                      className="w-full h-full object-cover"
                      onError={(e) => e.target.src = 'https://via.placeholder.com/400x200'}
                      alt={store.name}
                    />
                    {/* Mock Delivery Time if not in DB */}
                    <div className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-sm flex items-center gap-0.5 backdrop-blur-sm">
                      <Clock size={10} className="text-orange-600" /> 15-30m
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="font-bold text-sm leading-tight text-gray-900 line-clamp-1">{store.name}</h3>
                      <div className="flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded text-green-700 font-bold text-[10px]">
                        <Star size={8} fill="currentColor" /> {store.rating || '4.5'}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">
                      {store.category || 'General'} • 1.2km
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
