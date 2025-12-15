import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Clock, MapPin, ShoppingBag, Plus } from 'lucide-react';

export default function RestaurantView({ addToCart }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        fetchMenu();
    }, [id]);

    // Register as watcher if restaurant is closed
    useEffect(() => {
        const registerWatch = async () => {
            if (!data) return;
            const isClosed = data.restaurant.is_available === 0 || data.restaurant.is_available === false;
            const token = sessionStorage.getItem('token');

            if (isClosed && token) {
                try {
                    await fetch(`/api/restaurants/${id}/watch`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    console.log('[Watch] Registered interest in closed restaurant:', data.restaurant.name);
                } catch (err) {
                    console.error('Failed to register watch:', err);
                }
            }
        };
        registerWatch();
    }, [data, id]);

    const fetchMenu = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/restaurants/${id}/menu`);
            const result = await res.json();
            if (result.success) {
                setData(result.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (item) => {
        if (addToCart && data) {
            const cartItem = {
                ...item,
                restaurantId: data.restaurant.id,
                restaurantName: data.restaurant.name
            };
            addToCart(cartItem);
            // Optional: Feedback (toast or alert, keeping it simple for now as requested)
            // alert("Added to cart"); 
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>;
    if (!data) return <div className="p-10 text-center text-gray-500">Restaurant not found</div>;

    const { restaurant, menu } = data;
    const isClosed = restaurant.is_available === 0 || restaurant.is_available === false;
    const categories = ['All', ...new Set(menu.map(item => item.category))];

    const filteredMenu = activeCategory === 'All'
        ? menu
        : menu.filter(item => item.category === activeCategory);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">

            {/* HEADER IMAGE */}
            <div className="relative h-48 bg-gray-300">
                <img src={restaurant.image_url} className="w-full h-full object-cover" alt={restaurant.name} />
                <div className="absolute inset-0 bg-black/30"></div>
                <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition">
                    <ChevronLeft size={24} />
                </button>
                {/* CLOSED Overlay */}
                {isClosed && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-600 text-white text-lg font-bold px-6 py-2 rounded-full shadow-lg">
                            CLOSED
                        </span>
                    </div>
                )}
            </div>

            {/* RESTAURANT INFO */}
            <div className="bg-white p-4 -mt-6 rounded-t-3xl relative z-10 shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 leading-tight">{restaurant.name}</h1>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                            <MapPin size={14} /> {restaurant.cuisine_type} • 2.5km
                        </p>
                    </div>
                    <div className={`px-2 py-1 rounded-lg flex flex-col items-center ${isClosed ? 'bg-red-50' : 'bg-green-50'}`}>
                        {isClosed ? (
                            <>
                                <span className="text-red-700 font-bold text-sm">Closed</span>
                                <span className="text-[10px] text-red-600/80">Currently</span>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-1 text-green-700 font-bold text-sm">
                                    <Star size={12} fill="currentColor" /> {restaurant.rating}
                                </div>
                                <span className="text-[10px] text-green-600/80">Rating</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Closed Notice Banner */}
                {isClosed && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                        <p className="text-red-700 font-bold text-sm">This restaurant is currently closed</p>
                        <p className="text-red-500 text-xs mt-0.5">Please check back later or browse other restaurants</p>
                    </div>
                )}

                <div className="mt-4 flex gap-4 text-xs text-gray-500 border-t border-b border-gray-100 py-3">
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-orange-500" />
                        <span>{restaurant.delivery_time_min}-{restaurant.delivery_time_max} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <ShoppingBag size={14} className="text-orange-500" />
                        <span>Delivery: ₱49</span>
                    </div>
                </div>
            </div>

            {/* MENU CATEGORIES */}
            <div className="sticky top-0 bg-white z-20 shadow-sm px-4 py-2 mb-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-200'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* MENU LIST */}
            <div className="p-4 space-y-4">
                {filteredMenu.map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-3 relative">
                        <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden shrink-0 relative">
                            {/* PROMO badge */}
                            {item.promotional_price && parseFloat(item.promotional_price) > 0 && (
                                <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm z-10">
                                    PROMO
                                </div>
                            )}
                            {/* Placeholder for menu item images if missing */}
                            <img src={item.image_url || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+"} className="w-full h-full object-cover" alt={item.name} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800 line-clamp-2">{item.name}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                <div className="flex items-baseline gap-2">
                                    {item.promotional_price && parseFloat(item.promotional_price) > 0 ? (
                                        <>
                                            <span className="font-bold text-orange-600">₱{parseFloat(item.promotional_price).toFixed(2)}</span>
                                            <span className="text-xs text-gray-400 line-through">₱{parseFloat(item.price).toFixed(2)}</span>
                                        </>
                                    ) : (
                                        <span className="font-bold text-orange-600">₱{parseFloat(item.price).toFixed(2)}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => !isClosed && handleAdd(item)}
                                    disabled={isClosed}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition ${isClosed ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-100 text-orange-600 hover:bg-orange-600 hover:text-white'}`}>
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Cart Button */}
            <div className="fixed bottom-24 right-4 z-40">
                <button
                    onClick={() => navigate('/cart')}
                    className="bg-orange-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition active:scale-95 flex items-center justify-center"
                >
                    <ShoppingBag size={24} />
                </button>
            </div>

        </div>
    );
}
