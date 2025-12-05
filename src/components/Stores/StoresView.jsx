import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StoresView() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', 'Electronics', 'Fashion', 'Home', 'Beauty'];

  useEffect(() => { fetchStores(); }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
        // Reuse Pabili API for now or specific stores endpoint if available
        const response = await fetch('https://nfcrevolution.com/hungr/api/pabili/stores');
        const data = await response.json();
        if (data.success) setStores(data.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  return (
    <div className="pb-24 font-sans bg-gray-50 min-h-screen">
      {/* --- SEARCH HEADER --- */}
      <div className="bg-white sticky top-0 z-30 px-4 py-3 shadow-sm flex flex-col gap-3">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-100 text-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all placeholder:text-gray-400"
                    placeholder="Find a store..."
                />
            </div>
         </div>
         <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)} 
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    activeCategory === cat 
                      ? 'bg-orange-600 text-white border-orange-600' 
                      : 'bg-white text-gray-500 border-gray-200 hover:text-orange-600'
                  }`}
                >
                {cat}
                </button>
            ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
           <div className="space-y-3">{[1,2].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100" />)}</div>
        ) : (
            stores.map((store) => (
                <div key={store.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex gap-3 items-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        <img src={store.image_url} className="w-full h-full object-cover" onError={(e) => e.target.src='https://via.placeholder.com/100'} alt={store.name} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-800 text-sm">{store.name}</h3>
                        <p className="text-gray-500 text-xs">Official Partner</p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300" />
                </div>
            ))
        )}
      </div>
    </div>
  );
}
