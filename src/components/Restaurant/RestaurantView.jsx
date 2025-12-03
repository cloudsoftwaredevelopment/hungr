import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Heart, Share2, Star, Clock, 
  Users, Calendar, Plus, Loader, CheckCircle 
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
      }
    } catch (error) {
      console.error("Failed to fetch menu", error);
      // Fallback data
      setMenu({
        'Today\'s Offer': [
            { id: 1, name: 'Hungarian Sausage', description: 'Drizzled in our homemade BBQ sauce... serve with rice', price: 183.20, original_price: 229.00, image_url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&q=80&w=400' }
        ],
        'For You': [
            { id: 2, name: 'Cheesesteak', price: 250.00, image_url: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&q=80&w=400', is_popular: true },
            { id: 3, name: 'Steakhouse Ribs', price: 450.00, image_url: 'https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&q=80&w=400', is_popular: true },
            { id: 4, name: 'Caesar Salad', price: 180.00, image_url: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=400' },
            { id: 5, name: 'Iced Tea', price: 60.00, image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=400' }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item) => {
    addToCart(item);
    setToast(`${item.name} added to cart!`);
    setTimeout(() => setToast(null), 2000);
  };

  if (!restaurant) return null;

  return (
    // CHANGED: fixed -> absolute to stay inside the app container width
    <div className="absolute inset-0 bg-gray-50 z-50 overflow-y-auto animate-in slide-in-from-bottom duration-300">
        
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-5">
            <CheckCircle size={16} className="text-green-400" />
            {toast}
        </div>
      )}

      {/* 1. Sticky Header Navigation */}
      {/* CHANGED: sticky top-0 h-0 allows it to float over the image without complex positioning */}
      <div className="sticky top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none h-0 overflow-visible">
          <button 
              onClick={() => setView('home')} 
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

      {/* 2. Sticky Header Image */}
      <div className="sticky top-0 w-full h-72 z-0">
        <img 
            src={restaurant.image_url} 
            alt={restaurant.name} 
            className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"></div>
      </div>

      {/* 3. Scrollable Content Area */}
      <div className="relative z-10 -mt-20 px-4 pb-24">
        
        {/* Floating Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-5 text-center relative overflow-hidden mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{restaurant.name}</h1>
            <p className="text-gray-500 text-xs mb-3">{restaurant.cuisine_type} • {restaurant.address || 'Mabini St.'}</p>
            
            <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-1 font-bold text-gray-800">
                    <Star size={16} className="text-yellow-400 fill-current" />
                    {restaurant.rating} <span className="text-gray-400 font-normal">(3k+)</span>
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
                <div className="flex items-center gap-1 font-bold text-gray-800">
                    <Clock size={16} className="text-gray-400" />
                    {restaurant.delivery_time_min}-{restaurant.delivery_time_max} mins
                </div>
            </div>
            
            {/* Promo Tag */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
               <span className="text-orange-500 font-bold flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg">
                 <span className="w-4 h-4 rounded-full border border-orange-500 flex items-center justify-center text-[9px]">₱</span>
                 P49 off delivery
               </span>
            </div>
        </div>

        {/* Action Buttons Scroll */}
        <div className="mb-8">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold whitespace-nowrap text-gray-700 shadow-sm">
                    <Users size={14} className="text-orange-600" /> Group Order
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold whitespace-nowrap text-gray-700 shadow-sm">
                    <Calendar size={14} className="text-gray-500" /> Order for Later
                </button>
            </div>
        </div>

        {/* Today's Offer Section */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-gray-900">Today's Offer</h2>
                <ChevronLeft size={16} className="rotate-180 text-orange-600" />
            </div>
            
            {loading ? <Loader className="animate-spin text-orange-600 mx-auto" /> : (
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                    {(menu["Today's Offer"] || []).map(item => (
                        <div key={item.id} className="min-w-[85vw] bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex gap-3">
                            <img src={item.image_url} className="w-24 h-24 object-cover rounded-xl bg-gray-200" alt={item.name} />
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

        {/* For You (Menu Grid) */}
        <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">For You</h2>
            
            <div className="grid grid-cols-2 gap-3">
                {(menu['For You'] || Object.values(menu).flat().filter(i => !menu["Today's Offer"]?.includes(i))).map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 relative">
                        {item.is_popular && (
                            <div className="absolute top-3 left-3 bg-green-500 text-white text-[9px] font-bold px-2 py-1 rounded-md z-10 shadow-sm">
                                Most ordered
                            </div>
                        )}
                        <div className="aspect-square w-full mb-3 rounded-xl overflow-hidden bg-gray-100">
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
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
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default RestaurantView;
