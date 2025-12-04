import React, { useState, useEffect } from 'react';
import { 
  Search, MapPin, Clock, Star, Heart, 
  TrendingUp, Tag, ChevronRight, BadgeCheck, Bike, ShoppingBag, Store, Loader
} from 'lucide-react';

const API_URL = '/api';

const StoresView = ({ setView }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Categories specific to Stores
  const categories = [
    { id: 'All', name: 'All', icon: '🏪', color: 'bg-gray-100' },
    { id: 'Grocery', name: 'Grocery', icon: '🥦', color: 'bg-green-100' },
    { id: 'Pharmacy', name: 'Pharmacy', icon: '💊', color: 'bg-blue-100' },
    { id: 'Convenience', name: 'Convenience', icon: '🏪', color: 'bg-orange-100' },
    { id: 'Bakery', name: 'Bakery', icon: '🥖', color: 'bg-yellow-100' },
    { id: 'Hardware', name: 'Hardware', icon: '🔨', color: 'bg-gray-200' },
    { id: 'Electrical', name: 'Electrical', icon: '⚡', color: 'bg-yellow-50' },
    { id: 'Auto Supply', name: 'Auto Supply', icon: '🚗', color: 'bg-red-100' },
  ];

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      // Re-using the pabili stores endpoint as the source of truth for "Stores"
      const response = await fetch(`${API_URL}/pabili/stores`);
      const data = await response.json();
      if (data.success) {
        // Enrich data with mock categories/promos for demonstration purposes 
        // since the current backend table might not have these specific columns populated yet
        const enrichedStores = data.data.map(store => ({
            ...store,
            // Simple deterministic category assignment based on ID for demo variety
            category: assignMockCategory(store.name, store.id),
            has_promo: Math.random() > 0.5 ? 1 : 0,
            is_popular: Math.random() > 0.7 ? 1 : 0,
            delivery_fee: 49.00,
            min_time: store.delivery_time || 15,
            max_time: (store.delivery_time || 15) + 15
        }));
        setStores(enrichedStores);
      }
    } catch (err) {
      console.error("Failed to fetch stores", err);
    } finally {
      setLoading(false);
    }
  };

  const assignMockCategory = (name, id) => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes('drug') || lowerName.includes('pharma')) return 'Pharmacy';
      if (lowerName.includes('mart') || lowerName.includes('super')) return 'Grocery';
      if (lowerName.includes('bakery') || lowerName.includes('bread')) return 'Bakery';
      if (lowerName.includes('7-eleven') || lowerName.includes('uncle')) return 'Convenience';
      if (lowerName.includes('hardware')) return 'Hardware';
      // Fallback distribution
      const types = ['Grocery', 'Hardware', 'Electrical', 'Auto Supply', 'Convenience'];
      return types[id % types.length];
  };

  // Filtering Logic
  const filteredStores = stores.filter(s => {
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="animate-in slide-in-from-right pb-24">
      
      {/* 1. Header & Search (Orange Theme) */}
      <div className="sticky top-0 bg-white z-40 pb-2 pt-1">
        <div className="relative mb-3">
            <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Search stores..." 
                className="w-full bg-gray-100 py-3 pl-11 pr-4 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        
        {/* Toggle Pills */}
        <div className="flex gap-2 mb-2">
            <button 
                onClick={() => setDeliveryType('delivery')}
                className={`flex-1 py-2 rounded-full text-sm font-bold shadow-sm transition-colors duration-200 ${deliveryType === 'delivery' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                Delivery
            </button>
            <button 
                onClick={() => setDeliveryType('pickup')}
                className={`flex-1 py-2 rounded-full text-sm font-bold shadow-sm transition-colors duration-200 ${deliveryType === 'pickup' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                Pickup
            </button>
        </div>
      </div>

      {/* 2. Circular Categories */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-hide -mx-4 px-4">
        {categories.map((cat) => (
            <button 
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSearchQuery(''); }}
                className="flex flex-col items-center gap-2 min-w-[70px] transition group"
            >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-sm group-active:scale-95 transition ${selectedCategory === cat.id ? 'ring-4 ring-orange-500 ring-offset-2 ' + cat.color : 'bg-gray-50'}`}>
                    {cat.icon}
                </div>
                <span className={`text-xs font-medium text-center leading-tight ${selectedCategory === cat.id ? 'text-orange-700 font-bold' : 'text-gray-600'}`}>
                    {cat.name}
                </span>
            </button>
        ))}
      </div>

      {/* 3. Featured / Near Me Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <MapPin size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Nearest</h4>
                <p className="text-[10px] text-gray-500">Open now</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Store size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Official</h4>
                <p className="text-[10px] text-gray-500">Trusted stores</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                <Tag size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Promos</h4>
                <p className="text-[10px] text-gray-500">Store deals</p>
            </div>
        </div>
      </div>

      {/* 4. Banner */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-gray-900">Store Deals</h3>
            <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="relative h-40 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl overflow-hidden shadow-md flex items-center cursor-pointer">
            <div className="w-1/2 p-5 text-white z-10">
                <div className="bg-white text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2">FREE DELIVERY</div>
                <h2 className="text-xl font-extrabold leading-tight mb-1">Stock Up <br/> & Save</h2>
                <p className="text-[10px] opacity-90">Groceries delivered in minutes</p>
            </div>
            <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=500" className="absolute right-0 w-3/5 h-full object-cover -skew-x-6 scale-110" alt="Store Promo" />
        </div>
      </div>

      {/* 5. Stores List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-gray-900">
                {searchQuery ? `Results for "${searchQuery}"` : (selectedCategory === 'All' ? 'All Stores' : `${selectedCategory}`)}
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{filteredStores.length} results</span>
        </div>

        {loading ? (
            <div className="py-10 text-center"><Loader className="animate-spin text-orange-600 mx-auto" /></div>
        ) : filteredStores.length > 0 ? (
            filteredStores.map(store => (
                <div 
                  key={store.id} 
                  className="flex gap-4 cursor-pointer active:scale-[0.99] transition bg-white" 
                  onClick={() => {
                      // Logic to open store details or pabili form for this store
                      // For now, alerting or setting a detail view if available
                      // setView('pabili-form'); // Or a dedicated store detail view
                      alert(`Opening ${store.name}`);
                  }}
                >
                  {/* Left: Image */}
                  <div className="relative w-28 h-28 flex-shrink-0">
                      <img 
                        src={store.image_url || "/api/placeholder/400/400"} 
                        className="w-full h-full object-cover rounded-xl bg-gray-200" 
                        alt={store.name} 
                      />
                      {store.is_popular === 1 && (
                        <div className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-bold px-2 py-1 rounded-tl-xl rounded-br-lg shadow-sm">
                            PREFERRED
                        </div>
                      )}
                      <div className="absolute top-1 right-1">
                          <Heart size={16} className="text-white fill-transparent hover:fill-white transition" />
                      </div>
                  </div>

                  {/* Right: Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                        <div className="flex items-center gap-1">
                            <h3 className="font-bold text-base text-gray-900 line-clamp-1">{store.name}</h3>
                            <BadgeCheck size={14} className="text-blue-500 fill-blue-100" />
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                            <div className="flex items-center text-gray-800 font-bold">
                                <Star size={12} className="text-yellow-400 fill-current mr-0.5" />
                                {store.rating || 4.5} <span className="text-gray-400 font-normal ml-0.5"></span>
                            </div>
                            <span className="text-gray-300">•</span>
                            <span className="line-clamp-1">{store.category}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            {deliveryType === 'delivery' ? (
                                <div className="flex items-center gap-1">
                                    <Bike size={12} className="text-orange-600" />
                                    <span className="text-orange-600 font-medium">₱{store.delivery_fee}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-green-600">
                                    <ShoppingBag size={12} />
                                    <span className="font-medium">Pickup</span>
                                    <span className="text-gray-500 text-[10px] ml-1">{store.distance || '1.2km'}</span>
                                </div>
                            )}
                            <span className="text-gray-300">•</span>
                            <span>{store.min_time}-{store.max_time} mins</span>
                        </div>
                    </div>

                    {/* Scrollable Discounts Area */}
                    <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide pb-1 w-full">
                        <div className="flex-shrink-0 flex items-center gap-2 border border-gray-100 bg-gray-50 rounded-lg p-1.5 pr-3 min-w-fit">
                            <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center">
                                <Tag size={12} className="text-blue-600 fill-blue-600" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] font-bold text-gray-900">Free Delivery</span>
                                <span className="text-[9px] text-gray-500">Min. spend ₱1000</span>
                            </div>
                        </div>

                        {store.has_promo === 1 && (
                            <div className="flex-shrink-0 flex items-center gap-2 border border-orange-100 bg-orange-50 rounded-lg p-1.5 pr-3 min-w-fit">
                                <div className="w-5 h-5 bg-orange-100 rounded-md flex items-center justify-center">
                                    <Tag size={12} className="text-orange-600 fill-orange-600" />
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[10px] font-bold text-gray-900">10% Off Items</span>
                                    <span className="text-[9px] text-gray-500">Capped at ₱50</span>
                                </div>
                            </div>
                        )}
                    </div>

                  </div>
                </div>
            ))
        ) : (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-400 text-sm">No stores found for "{searchQuery || selectedCategory}"</p>
                <button onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }} className="text-orange-600 text-sm font-bold mt-2 hover:underline">
                    View all stores
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default StoresView;
