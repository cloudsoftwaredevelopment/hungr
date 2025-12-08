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

    const fetchMenu = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/hungr/api/restaurants/${id}/menu`);
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
                    <div className="bg-green-50 px-2 py-1 rounded-lg flex flex-col items-center">
                        <div className="flex items-center gap-1 text-green-700 font-bold text-sm">
                            <Star size={12} fill="currentColor" /> {restaurant.rating}
                        </div>
                        <span className="text-[10px] text-green-600/80">Rating</span>
                    </div>
                </div>

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
                    <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-3">
                        <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                            {/* Placeholder for menu item images if missing */}
                            <img src={item.image_url || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+"} className="w-full h-full object-cover" alt={item.name} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800 line-clamp-2">{item.name}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                                <span className="font-bold text-orange-600">₱{item.price}</span>
                                <button
                                    onClick={() => handleAdd(item)}
                                    className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-600 hover:text-white transition">
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
