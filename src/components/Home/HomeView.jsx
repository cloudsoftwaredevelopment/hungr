import React from 'react';
import { Loader, Clock, Star } from 'lucide-react';

const HomeView = ({ restaurants, loading, setView, setActiveRestaurant }) => {
  
  const handleCategoryClick = (category) => {
    if (category === 'Pabili') {
      setView('pabili');
    } else if (category === 'Ride') {
      setView('rides');
    } else if (category === 'Stores') {
      setView('stores');
    } else {
      setView('home');
    }
  };

  return (
    <>
      {/* Category Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6 place-items-center">
        {[
          { label: 'Food', emoji: '🍔', bg: 'from-red-400 to-red-500' },
          { label: 'Pabili', emoji: '🛒', bg: 'from-blue-400 to-blue-500' },
          { label: 'Stores', emoji: '🏪', bg: 'from-purple-400 to-purple-500' },
          { label: 'Ride', emoji: '🚗', bg: 'from-green-400 to-green-500' }
        ].map((cat) => (
          <button
            key={cat.label}
            onClick={() => handleCategoryClick(cat.label)}
            className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:opacity-90 hover:scale-105 transition-all active:scale-95 bg-gradient-to-br ${cat.bg} rounded-2xl p-2 shadow-lg hover:shadow-xl transition-shadow text-white w-14 h-14`}
          >
            <div className="text-lg">{cat.emoji}</div>
            <span className="text-xs font-bold text-center leading-none">{cat.label}</span>
          </button>
        ))}
      </div>

      <h2 className="font-bold text-lg mb-4">Featured Restaurants</h2>
      
      {/* Restaurant List */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 flex justify-center">
            <Loader className="animate-spin text-orange-600" />
          </div>
        ) : (
          restaurants.map(r => (
            <div 
              key={r.id} 
              className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]" 
              onClick={() => { setActiveRestaurant(r); setView('restaurant'); }}
            >
              <div className="h-24 bg-gray-200 relative">
                  <img src={r.image_url || "/api/placeholder/400/200"} className="w-full h-full object-cover" alt={r.name} />
                  <div className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold shadow flex items-center gap-0.5">
                    <Clock size={10} className="text-orange-500" /> {r.delivery_time_min}-{r.delivery_time_max}m
                  </div>
              </div>
              <div className="p-2">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-sm leading-tight text-gray-800 line-clamp-1">{r.name}</h3>
                    <div className="flex items-center gap-0.5 bg-green-50 px-1 py-0.5 rounded text-green-700 font-bold text-[10px]">
                      <Star size={8} fill="currentColor" /> {r.rating}
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{r.cuisine_type}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default HomeView;
