import React, { useState } from 'react';
import { 
  Search, MapPin, Clock, Star, Heart, 
  TrendingUp, Tag, ChevronRight, BadgeCheck, Bike, ShoppingBag 
} from 'lucide-react';

const FoodView = ({ restaurants, setView, setActiveRestaurant }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Added state for Delivery/Pickup toggle
  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' or 'pickup'

  // Categories based on your video/data
  const categories = [
    { id: 'All', name: 'All', icon: '🍽️', color: 'bg-gray-100' },
    { id: 'Fast Food', name: 'Fast Food', icon: '🍔', color: 'bg-orange-100' },
    { id: 'Filipino', name: 'Filipino', icon: '🍲', color: 'bg-yellow-100' },
    { id: 'Chicken', name: 'Chicken', icon: '🍗', color: 'bg-red-100' },
    { id: 'American', name: 'American', icon: '🌭', color: 'bg-blue-100' },
    { id: 'Chinese', name: 'Asian', icon: '🍜', color: 'bg-red-50' },
    { id: 'Pizza', name: 'Pizza', icon: '🍕', color: 'bg-orange-50' },
    { id: 'Coffee', name: 'Coffee', icon: '☕', color: 'bg-brown-100' },
    { id: 'Bakery', name: 'Bakery', icon: '🥐', color: 'bg-yellow-50' },
  ];

  // Filtering Logic
  const filteredRestaurants = restaurants.filter(r => {
    const matchesCategory = selectedCategory === 'All' || r.cuisine_type === selectedCategory || (selectedCategory === 'Asian' && r.cuisine_type === 'Chinese');
    
    // Enhanced search: check name OR cuisine_type
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
        r.name.toLowerCase().includes(query) || 
        r.cuisine_type.toLowerCase().includes(query) ||
        // Basic mapping for "hamburgers" -> "Fast Food" or "American" if specific tags aren't present
        (query.includes('burger') && (r.cuisine_type === 'Fast Food' || r.cuisine_type === 'American'));

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
                placeholder="What shall we deliver?" 
                className="w-full bg-gray-100 py-3 pl-11 pr-4 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        
        {/* Toggle Pills (Orange) - Interactive */}
        <div className="flex gap-2 mb-2">
            <button 
                onClick={() => setDeliveryType('delivery')}
                className={`flex-1 py-2 rounded-full text-sm font-bold shadow-sm transition-colors ${deliveryType === 'delivery' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                Delivery
            </button>
            <button 
                onClick={() => setDeliveryType('pickup')}
                className={`flex-1 py-2 rounded-full text-sm font-bold shadow-sm transition-colors ${deliveryType === 'pickup' ? 'bg-orange-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                Pickup
            </button>
        </div>
      </div>

      {/* 2. Circular Categories (Horizontal Scroll) */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-hide -mx-4 px-4">
        {categories.map((cat) => (
            <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
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

      {/* 3. "Near Me" & Deals Grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <MapPin size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Near Me</h4>
                <p className="text-[10px] text-gray-500">Get it quick</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                <Star size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Joyful Deals!</h4>
                <p className="text-[10px] text-gray-500">Affordable meals</p>
            </div>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-2 active:scale-95 transition cursor-pointer">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Tag size={20} />
            </div>
            <div>
                <h4 className="font-bold text-xs text-gray-900">Up to P400</h4>
                <p className="text-[10px] text-gray-500">For the holidays</p>
            </div>
        </div>
      </div>

      {/* 4. Order Now Banner (Orange Theme) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-gray-900">Order Now</h3>
            <ChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="relative h-40 bg-gradient-to-r from-orange-700 to-orange-500 rounded-2xl overflow-hidden shadow-md flex items-center cursor-pointer">
            <div className="w-1/2 p-5 text-white z-10">
                <div className="bg-white text-orange-900 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2">HOLIDAY SALE</div>
                <h2 className="text-xl font-extrabold leading-tight mb-1">12-Day Holiday <br/> Sale</h2>
                <p className="text-[10px] opacity-90">Get a FREE ITEM on your next order</p>
            </div>
            <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=500" className="absolute right-0 w-3/5 h-full object-cover -skew-x-6 scale-110" alt="Promo" />
        </div>
      </div>

      {/* 5. Filtered Restaurant List (New Card Design) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-gray-900">
                {searchQuery ? `Results for "${searchQuery}"` : (selectedCategory === 'All' ? 'All Restaurants' : `${selectedCategory} Places`)}
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{filteredRestaurants.length} results</span>
        </div>

        {filteredRestaurants.length > 0 ? (
            filteredRestaurants.map(r => (
                <div 
                  key={r.id} 
                  className="flex gap-4 cursor-pointer active:scale-[0.99] transition bg-white" 
                  onClick={() => { 
                      // Pass delivery type preference if needed in the future
                      setActiveRestaurant({...r, orderType: deliveryType}); 
                      setView('restaurant'); 
                  }}
                >
                  {/* Left: Image (Square with rounded corners) */}
                  <div className="relative w-28 h-28 flex-shrink-0">
                      <img 
                        src={r.image_url || "/api/placeholder/400/400"} 
                        className="w-full h-full object-cover rounded-xl bg-gray-200" 
                        alt={r.name} 
                      />
                      {/* Optional Overlay Tag like the image (e.g., NOTIFSON) */}
                      {r.is_popular === 1 && (
                        <div className="absolute top-0 left-0 bg-black/70 text-white text-[9px] font-bold px-2 py-1 rounded-tl-xl rounded-br-lg">
                            POPULAR
                        </div>
                      )}
                      {/* Heart Icon Overlay */}
                      <div className="absolute top-1 right-1">
                          <Heart size={16} className="text-white fill-transparent" />
                      </div>
                  </div>

                  {/* Right: Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    
                    {/* Header Row */}
                    <div>
                        <div className="flex items-center gap-1">
                            <h3 className="font-bold text-base text-gray-900 line-clamp-1">{r.name}</h3>
                            <BadgeCheck size={14} className="text-blue-500 fill-blue-100" />
                        </div>
                        
                        {/* Rating Row */}
                        <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                            <div className="flex items-center text-gray-800 font-bold">
                                <Star size={12} className="text-yellow-400 fill-current mr-0.5" />
                                {r.rating} <span className="text-gray-400 font-normal ml-0.5">(1K+)</span>
                            </div>
                            <span className="text-gray-300">•</span>
                            <span>$$$</span>
                            <span className="text-gray-300">•</span>
                            <span className="line-clamp-1">{r.cuisine_type}</span>
                        </div>

                        {/* Delivery Info Row */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            {deliveryType === 'delivery' ? (
                                <div className="flex items-center gap-1">
                                    <Bike size={12} className="text-red-500" />
                                    <span className="text-red-500 font-medium">Free</span>
                                    <span className="text-gray-400 line-through text-[10px]">₱49.00</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-orange-600">
                                    <ShoppingBag size={12} />
                                    <span className="font-medium">Pickup</span>
                                    <span className="text-gray-500 text-[10px] ml-1">{r.distance || '1.2km'}</span>
                                </div>
                            )}
                            <span className="text-gray-300">•</span>
                            <span>From {r.delivery_time_min} mins</span>
                        </div>
                    </div>

                    {/* Scrollable Discounts Area */}
                    <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide pb-1 w-full">
                        {/* Discount Card 1 */}
                        <div className="flex-shrink-0 flex items-center gap-2 border border-gray-100 bg-gray-50 rounded-lg p-1.5 pr-3 min-w-fit">
                            <div className="w-5 h-5 bg-orange-100 rounded-md flex items-center justify-center">
                                <Tag size={12} className="text-orange-600 fill-orange-600" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[10px] font-bold text-gray-900">Up to 100% off</span>
                                <span className="text-[9px] text-gray-500">Selected items only</span>
                            </div>
                        </div>

                        {/* Discount Card 2 (Conditional or Example) */}
                        {r.has_promo === 1 && (
                            <div className="flex-shrink-0 flex items-center gap-2 border border-green-100 bg-green-50 rounded-lg p-1.5 pr-3 min-w-fit">
                                <div className="w-5 h-5 bg-green-100 rounded-md flex items-center justify-center">
                                    <Tag size={12} className="text-green-600 fill-green-600" />
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[10px] font-bold text-gray-900">₱80.00 off</span>
                                    <span className="text-[9px] text-gray-500">Min. spend ₱550</span>
                                </div>
                            </div>
                        )}
                    </div>

                  </div>
                </div>
            ))
        ) : (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-400 text-sm">No restaurants found for "{searchQuery || selectedCategory}"</p>
                <button onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }} className="text-orange-600 text-sm font-bold mt-2 hover:underline">
                    View all restaurants
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default FoodView;
