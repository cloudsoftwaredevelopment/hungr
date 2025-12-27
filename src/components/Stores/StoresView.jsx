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
      const response = await fetch('/api/pabili/stores');
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
    <div className="pb-32 font-sans bg-slate-50 min-h-screen">
      {/* --- HEADER --- */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-6 pb-4 border-b border-slate-100 shadow-sm flex flex-col gap-5">

        {/* Navigation and Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
              Hungr <span className="text-orange-600 italic">Stores</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Discover lifestyle shops</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none z-10">
            <div className="w-11 h-11 flex items-center justify-center">
              <Search className="text-slate-400 group-focus-within:text-orange-600 transition-colors" size={20} strokeWidth={2.5} />
            </div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-gray-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-black focus:outline-none focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all placeholder:text-slate-400 border-none shadow-inner"
            placeholder="Search stores or brands..."
          />
        </div>

        {/* Categories - Horizontal Scroll */}
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-5 px-5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border-2 active:scale-95 ${activeCategory === cat
                ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/20'
                : 'bg-white text-slate-500 border-slate-50 hover:border-orange-200 hover:text-orange-600 shadow-sm'
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
                  className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 active:scale-[0.98] group"
                  onClick={() => navigate(`/stores/${store.id}`)}
                >
                  <div className="h-32 bg-slate-100 relative overflow-hidden">
                    <img
                      src={store.image_url || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+"}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+'}
                      alt={store.name}
                    />
                    {/* Mock Delivery Time if not in DB */}
                    <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-xl text-[10px] font-black shadow-lg flex items-center gap-1 border border-white/50 backdrop-blur-md">
                      <Clock size={10} className="text-orange-600" strokeWidth={3} /> 15-30m
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-black text-sm leading-tight text-gray-900 line-clamp-1 tracking-tight group-hover:text-orange-600 transition-colors uppercase">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-lg text-emerald-700 font-black text-[9px] border border-emerald-100">
                          <Star size={9} fill="currentColor" strokeWidth={3} /> {store.rating || '4.5'}
                        </div>
                        <span className="text-slate-200">•</span>
                        <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{store.category || 'General'}</span>
                      </div>
                    </div>
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
