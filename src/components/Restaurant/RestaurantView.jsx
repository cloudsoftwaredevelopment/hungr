import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Clock, MapPin, ShoppingBag, Plus } from 'lucide-react';

export default function RestaurantView({ addToCart }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [flyingItems, setFlyingItems] = useState([]);
    const cartRef = useRef(null);

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

    const handleAdd = (item, event) => {
        if (addToCart && data) {
            const cartItem = {
                ...item,
                restaurantId: data.restaurant.id,
                restaurantName: data.restaurant.name
            };

            // Get button position for animation
            const button = event.currentTarget;
            const buttonRect = button.getBoundingClientRect();
            const cartRect = cartRef.current?.getBoundingClientRect();

            if (cartRect) {
                // Create flying item
                const flyId = Date.now();
                const flyingItem = {
                    id: flyId,
                    image: item.image_url || 'https://nfcrevolution.com/hungr/registration/image_0.png',
                    startX: buttonRect.left + buttonRect.width / 2,
                    startY: buttonRect.top + buttonRect.height / 2,
                    endX: cartRect.left + cartRect.width / 2,
                    endY: cartRect.top + cartRect.height / 2,
                };

                setFlyingItems(prev => [...prev, flyingItem]);

                // Remove flying item after animation
                setTimeout(() => {
                    setFlyingItems(prev => prev.filter(f => f.id !== flyId));
                }, 600);
            }

            addToCart(cartItem);
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

            {/* Flying Items Animation */}
            {flyingItems.map(item => (
                <div
                    key={item.id}
                    className="fixed pointer-events-none z-[100]"
                    style={{
                        left: item.startX,
                        top: item.startY,
                        transform: 'translate(-50%, -50%)',
                        animation: 'flyToCart 0.6s ease-in-out forwards',
                        '--fly-end-x': `${item.endX - item.startX}px`,
                        '--fly-end-y': `${item.endY - item.startY}px`,
                    }}
                >
                    <div className="w-12 h-12 rounded-full bg-orange-500 shadow-lg flex items-center justify-center overflow-hidden border-2 border-white">
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                    </div>
                </div>
            ))}

            {/* Animation Styles */}
            <style>{`
                @keyframes flyToCart {
                    0% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(
                            calc(-50% + var(--fly-end-x) / 2),
                            calc(-50% + var(--fly-end-y) / 2 - 60px)
                        ) scale(0.8);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(
                            calc(-50% + var(--fly-end-x)),
                            calc(-50% + var(--fly-end-y))
                        ) scale(0.3);
                    }
                }
                @keyframes cartBounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                }
            `}</style>

            {/* HEADER IMAGE */}
            <div className="relative h-64 bg-slate-200 overflow-hidden">
                <img
                    src={restaurant.image_url}
                    className="w-full h-full object-cover transition-transform duration-1000 scale-105"
                    alt={restaurant.name}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"></div>

                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-black/30 backdrop-blur-xl rounded-2xl text-white hover:bg-black/50 transition-all active:scale-90 border border-white/20 shadow-lg"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    {/* Share/Fav buttons could go here */}
                </div>

                {/* CLOSED Overlay */}
                {isClosed && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                        <div className="bg-red-600/90 text-white text-xl font-black px-8 py-3 rounded-2xl shadow-2xl border border-red-500 animate-in zoom-in duration-300">
                            CURRENTLY CLOSED
                        </div>
                        <p className="text-white/80 text-sm mt-3 font-medium max-w-xs">This merchant is not accepting orders at the moment. Try again later!</p>
                    </div>
                )}
            </div>

            {/* RESTAURANT INFO CARD */}
            <div className="px-5 -mt-12 relative z-20">
                <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200/60 border border-slate-50">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight mb-2">{restaurant.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                                <span className="bg-slate-100 px-2 py-1 rounded-lg">{restaurant.cuisine_type}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                                    <MapPin size={12} /> 2.5km Away
                                </div>
                            </div>
                        </div>
                        {!isClosed && (
                            <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg border border-emerald-400 text-center min-w-[60px]">
                                <div className="flex items-center justify-center gap-1 font-black text-lg">
                                    <Star size={16} fill="white" /> {restaurant.rating}
                                </div>
                                <div className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">Rating</div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 border border-orange-100">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Delivery Time</p>
                                <p className="text-sm font-black text-slate-800 tracking-tight">
                                    {restaurant.delivery_time_min}-{restaurant.delivery_time_max} mins
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                <ShoppingBag size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Delivery Fee</p>
                                <p className="text-sm font-black text-slate-800 tracking-tight text-emerald-600">₱49.00</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MENU CATEGORIES */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-slate-100 py-3 mt-4">
                <div className="flex gap-3 overflow-x-auto no-scrollbar px-5">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all duration-300 border shadow-sm active:scale-95 ${activeCategory === cat
                                ? 'bg-orange-600 text-white border-orange-500 shadow-orange-600/20'
                                : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* MENU LIST */}
            <div className="p-5 space-y-6">
                {filteredMenu.map(item => (
                    <div key={item.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-50 flex gap-4 p-4 relative overflow-hidden active:bg-slate-50 transition-colors">
                        <div className="w-28 h-28 bg-slate-100 rounded-[1.5rem] overflow-hidden shrink-0 relative shadow-inner">
                            {/* PROMO badge */}
                            {item.promotional_price && parseFloat(item.promotional_price) > 0 && (
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-lg z-10 border border-red-500">
                                    PROMO
                                </div>
                            )}
                            <img src={item.image_url ? `${item.image_url}?v=2` : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+"} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" alt={item.name} />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <h3 className="font-extrabold text-gray-900 text-[15px] leading-snug line-clamp-2 mb-1 tracking-tight">{item.name}</h3>
                                <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed tracking-tight">{item.description}</p>
                            </div>
                            <div className="flex justify-between items-center mt-3">
                                <div className="flex flex-col">
                                    {item.promotional_price && parseFloat(item.promotional_price) > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-orange-600 text-lg">₱{parseFloat(item.promotional_price).toFixed(2)}</span>
                                            <span className="text-[10px] text-slate-400 line-through font-bold">₱{parseFloat(item.price).toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <span className="font-black text-gray-900 text-lg">₱{parseFloat(item.price).toFixed(2)}</span>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => !isClosed && handleAdd(item, e)}
                                    disabled={isClosed}
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 ${isClosed
                                        ? 'bg-slate-100 text-slate-300 shadow-none'
                                        : 'bg-orange-600 text-white shadow-orange-600/20 hover:shadow-orange-600/40 hover:scale-105'}`}
                                >
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Cart Button Upgrade: Bottom Bar Style */}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] md:max-w-xs z-50 pointer-events-none" ref={cartRef}>
                <button
                    onClick={() => navigate('/cart')}
                    className="w-full bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center justify-between gap-4 pointer-events-auto group relative overflow-hidden"
                    style={flyingItems.length > 0 ? { animation: 'cartBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' } : {}}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                            <ShoppingBag size={20} className="text-white" strokeWidth={3} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Your Basket</p>
                            <p className="text-sm font-black tracking-tight">View Order Details</p>
                        </div>
                    </div>
                    <div className="bg-white/10 px-4 py-2 rounded-xl text-xs font-black border border-white/10 group-hover:bg-orange-600 transition-colors">
                        GO TO CART
                    </div>
                </button>
            </div>

        </div>
    );
}

