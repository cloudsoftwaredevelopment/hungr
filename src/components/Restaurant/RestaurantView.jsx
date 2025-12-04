import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Heart, Share2, Star, Clock, 
  Users, Calendar, Plus, Loader, CheckCircle, Store 
} from 'lucide-react';

const API_URL = '/api';

const RestaurantView = ({ restaurant, setView, addToCart }) => {
  const [menu, setMenu] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // For "Added to Cart" feedback

  useEffect(() => {
    if (restaurant) {
      fetchMenu(restaurant.id);
    }
  }, [restaurant]);

  const fetchMenu = async (id) => {
    try {
      const response = await fetch(`${API_URL}/restaurants/${id}/menu`);
      const data = await response.json();
      if (data.success) {
        setMenu(data.data);
      } else {
        setMenu({}); // Empty state if API fails gracefully
      }
    } catch (error) {
      console.error("Failed to fetch menu", error);
      setMenu({}); // Remove hardcoded fallback to ensure data comes from tables
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item) => {
    addToCart(item);
    setToast(`${item.name} added to cart!`);
    setTimeout(() => setToast(null), 2000);
  };

  // Helper for image fallback
  const handleImageError = (e) => {
    e.target.src = "/api/placeholder/100/100"; // Fallback placeholder
    e.target.className = `${e.target.className} bg-gray-200 p-2 opacity-50`; // Style adjustment for placeholder
  };

  if (!restaurant) return null;

  return (
    <div className="absolute inset-0 bg-gray-50 z-50 overflow-y-auto animate-in slide-in-from-bottom duration-300">
        
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-5">
            <CheckCircle size={16} className="text-green-400" />
            {toast}
        </div>
      )}

      {/* 1. Sticky Header Navigation */}
      <div className="sticky top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none h-0 overflow-visible">
          <button 
              onClick={() => setView('food')} // Return to Food View context
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition pointer-events-auto"
          >
              <ChevronLeft size={24} />
          </button>
          <div className="flex gap-2 pointer-events-auto">
              <button className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition">
                  <Heart size={20} />
              </button>
              <button className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition">
                  <Share2 size={20} />
              </button>
          </div>
      </div>

      {/* 2. Sticky Header Image (Cover) */}
      <div className="sticky top-0 w-full h-72 z-0">
        <img 
            src={restaurant.image_url || "/api/placeholder/800/600"} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
            onError={(e) => {e.target.src = "/api/placeholder/800/600"}}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"></div>
      </div>

      {/* 3. Scrollable Content Area */}
      <div className="relative z-10 -mt-20 px-4 pb-24">
        
        {/* Floating Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-5 relative overflow-hidden mb-6">
            <div className="flex items-start gap-4 mb-3">
                {/* Brand Logo - Left Side */}
                <div className="w-16 h-16 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0 bg-white">
                    {restaurant.image_url ? (
                        <img 
                            src={restaurant.image_url} 
                            alt="Logo" 
                            className="w-full h-full object-cover"
                            onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex'}}
                        />
                    ) : null}
                    <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500 hidden">
                        <Store size={24} />
                    </div>
                </div>

                <div className="flex-1 min-w-0 pt-1">
                    <h1 className="text-xl font-bold text-gray-900 leading-tight mb-1 truncate">{restaurant.name}</h1>
                    <p className="text-gray-500 text-xs truncate">{restaurant.cuisine_type} • {restaurant.address || 'Mabini St.'}</p>
                    
                    <div className="flex items-center gap-3 text-xs mt-2">
                        <div className="flex items-center gap-1 font-bold text-gray-800">
                            <Star size={14} className="text-yellow-400 fill-current" />
                            {restaurant.rating}
                        </div>
                        <div className="w-px h-3 bg-gray-300"></div>
                        <div className="flex items-center gap-1 font-bold text-gray-800">
                            <Clock size={14} className="text-gray-400" />
                            {restaurant.delivery_time_min}-{restaurant.delivery_time_max} m
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Promo Tag */}
            <div className="border-t border-gray-100 pt-3 mt-1 flex items-center justify-center gap-2 text-xs">
               <span className="text-orange-500 font-bold flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg">
                 <span className="w-4 h-4 rounded-full border border-orange-500 flex items-center justify-center text-[9px]">₱</span>
                 P49 off delivery
               </span>
            </div>
        </div>

        {/* Action Buttons Scroll */}
        <div className="mb-8">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold whitespace-nowrap text-gray-700 shadow-sm active:bg-gray-50">
                    <Users size={14} className="text-orange-600" /> Group Order
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold whitespace-nowrap text-gray-700 shadow-sm active:bg-gray-50">
                    <Calendar size={14} className="text-gray-500" /> Order for Later
                </button>
            </div>
        </div>

        {/* Today's Offer Section */}
        {menu["Today's Offer"] && menu["Today's Offer"].length > 0 && (
            <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold text-gray-900">Today's Offer</h2>
                    <ChevronLeft size={16} className="rotate-180 text-orange-600" />
                </div>
                
                {loading ? <Loader className="animate-spin text-orange-600 mx-auto" /> : (
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                        {menu["Today's Offer"].map(item => (
                            <div key={item.id} className="min-w-[85vw] bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex gap-3">
                                <img 
                                    src={item.image_url} 
                                    className="w-24 h-24 object-cover rounded-xl bg-gray-200" 
                                    alt={item.name} 
                                    onError={handleImageError}
                                />
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{item.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description || 'Delicious meal prepared fresh.'}</p>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <div>
                                            <span className="font-bold text-lg text-gray-900">₱{item.price}</span>
                                            {item.original_price && (
                                                <span className="text-xs text-gray-400 line-through ml-2">₱{item.original_price}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => handleAddToCart(item)}
                                            className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition hover:bg-green-700"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* For You (Menu Grid) */}
        <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">For You</h2>
            
            {loading ? <div className="py-10 text-center"><Loader className="animate-spin text-orange-600 mx-auto" /></div> : (
                <div className="grid grid-cols-2 gap-3">
                    {/* Combine categories if structure varies, or use 'For You' */}
                    {(menu['For You'] || Object.values(menu).flat().filter(i => !menu["Today's Offer"]?.includes(i))).length > 0 ? (
                        (menu['For You'] || Object.values(menu).flat().filter(i => !menu["Today's Offer"]?.includes(i))).map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 relative">
                                {item.is_popular === 1 && (
                                    <div className="absolute top-3 left-3 bg-green-500 text-white text-[9px] font-bold px-2 py-1 rounded-md z-10 shadow-sm">
                                        Most ordered
                                    </div>
                                )}
                                <div className="aspect-square w-full mb-3 rounded-xl overflow-hidden bg-gray-100">
                                    <img 
                                        src={item.image_url} 
                                        alt={item.name} 
                                        className="w-full h-full object-cover" 
                                        onError={handleImageError}
                                    />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm font-bold text-gray-700">₱{item.price}</span>
                                    <button 
                                        onClick={() => handleAddToCart(item)}
                                        className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white shadow active:scale-95 transition hover:bg-green-700"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-2 py-10 text-center text-gray-400 text-sm bg-white rounded-xl border border-dashed">
                            No menu items found.
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default RestaurantView;
