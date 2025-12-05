import React, { useState } from 'react';
import { Search, MapPin, Star, Clock, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FoodView({ restaurants = [], setActiveRestaurant }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Fast Food', 'Filipino', 'Chinese', 'Japanese', 'Healthy', 'Dessert', 'Chicken', 'Beverages'];

  // Filter logic
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.cuisine_type && r.cuisine_type.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || r.cuisine_type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pb-24 font-sans bg-gray-50 min-h-screen">
      
      {/* --- HEADER --- */}
      <div className="bg-white sticky top-0 z-30 px-4 py-3 shadow-sm border-b border-gray-100 flex flex-col gap-3">
         
         {/* Navigation Row (Back Button Added) */}
         <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
            >
                <ChevronLeft size={24} />
            </button>
            <div className="flex-1 text-center pr-10"> 
                {/* pr-10 balances the back button width to center the title perfectly */}
                <h1 className="text-xl font-black text-gray-800 tracking-tight">
                    ORDER <span className="text-orange-600">FOOD</span>
                </h1>
            </div>
         </div>

         {/* Search Bar */}
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="text-gray-400" size={18} />
            </div>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 text-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all placeholder:text-gray-400"
                placeholder="Craving something specific?"
            />
         </div>

         {/* Categories */}
         <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)} 
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    activeCategory === cat 
                      ? 'bg-orange-600 text-white border-orange-600 shadow-md' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200 hover:text-orange-600'
                  }`}
                >
                {cat}
                </button>
            ))}
        </div>
      </div>

      {/* --- RESTAURANT LIST --- */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            {searchQuery ? 'Search Results' : 'Popular Near You'}
          </h2>
        </div>

        {filteredRestaurants.length > 0 ? (
            <div className="grid grid-cols-1 gap-5">
                {filteredRestaurants.map((restaurant) => (
                    <div 
                        key={restaurant.id} 
                        // Note: You'll need to define the route for /restaurant details later
                        onClick={() => {
                            if (setActiveRestaurant) setActiveRestaurant(restaurant);
                            // navigate(`/restaurant/${restaurant.id}`); 
                        }}
                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group cursor-pointer active:scale-[0.98] transition-all"
                    >
                        {/* Image */}
                        <div className="h-40 bg-gray-200 relative overflow-hidden">
                            <img 
                                src={restaurant.image_url} 
                                alt={restaurant.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => e.target.src='https://via.placeholder.com/400x200?text=Food'}
                            />
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                <Star size={12} className="text-orange-500 fill-orange-500" />
                                <span className="text-xs font-bold text-gray-800">{restaurant.rating}</span>
                            </div>
                            <div className="absolute bottom-3 left-3 bg-gray-900/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                <Clock size={12} className="text-white" />
                                <span className="text-[10px] font-bold text-white">{restaurant.delivery_time_min}-{restaurant.delivery_time_max} min</span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{restaurant.name}</h3>
                                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                                        <MapPin size={12} /> {restaurant.cuisine_type || 'Restaurant'} • {restaurant.distance || '1.2 km'}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-10 text-gray-400 text-sm">
                No restaurants found.
            </div>
        )}
      </div>
    </div>
  );
}
