import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingBag, Home, User, MapPin, Star, Clock, Plus, Minus, ChevronLeft, X, Trash2, Receipt } from 'lucide-react';

// --- MOCK DATA (Used for Preview/Demo Mode) ---
const MOCK_RESTAURANTS = [
  {
    id: 1,
    name: "Manila BBQ Spot",
    cuisine: "Filipino",
    rating: 4.8,
    time: "25-40 min",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800",
    menu: [
      { id: 101, name: "Chicken Inasal", price: 180, desc: "Grilled chicken with calamansi", category: "Mains" },
      { id: 102, name: "Pork Sisig", price: 220, desc: "Sizzling chopped pork", category: "Mains" },
      { id: 103, name: "Garlic Rice", price: 45, desc: "Fried rice with toasted garlic", category: "Sides" }
    ]
  },
  {
    id: 2,
    name: "Sakura Ramen",
    cuisine: "Japanese",
    rating: 4.5,
    time: "30-50 min",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=800",
    menu: [
      { id: 201, name: "Tonkotsu Ramen", price: 350, desc: "Rich pork broth", category: "Noodles" },
      { id: 202, name: "Gyoza (5pcs)", price: 150, desc: "Pan-fried dumplings", category: "Sides" }
    ]
  },
  {
    id: 3,
    name: "Burgers & Brews",
    cuisine: "American",
    rating: 4.2,
    time: "20-35 min",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
    menu: [
      { id: 301, name: "Cheeseburger Deluxe", price: 250, desc: "Quarter pounder w/ fries", category: "Burgers" },
      { id: 302, name: "Onion Rings", price: 120, desc: "Crispy battered rings", category: "Sides" }
    ]
  }
];

// --- MAIN COMPONENT ---
export default function App() {
  // STATE
  const [view, setView] = useState('home'); // home, restaurant, cart, profile, success
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(true); // Default to Mock for Preview

  // INITIAL LOAD
  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    if (useMock) {
      // Simulate network delay
      setTimeout(() => {
        setRestaurants(MOCK_RESTAURANTS);
        setLoading(false);
      }, 800);
    } else {
      try {
        const response = await fetch('/hungr/api/restaurants');
        if (!response.ok) throw new Error('API Failed');
        const data = await response.json();
        setRestaurants(data); // Note: Real API needs to return menu items structured correctly
      } catch (err) {
        console.error("Failed to fetch, falling back to mock", err);
        setUseMock(true); // Fallback
        setRestaurants(MOCK_RESTAURANTS);
      } finally {
        setLoading(false);
      }
    }
  };

  // CART ACTIONS
  const addToCart = (item, restaurant) => {
    // Check if adding from a different restaurant
    if (cart.length > 0 && cart[0].restaurantId !== restaurant.id) {
      if (!window.confirm("Start a new basket? You can only order from one restaurant at a time.")) return;
      setCart([{ ...item, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name }]);
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, restaurantId: restaurant.id, restaurantName: restaurant.name }];
    });
  };

  const updateQty = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  const placeOrder = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setCart([]);
      setView('success');
    }, 1500);
  };

  // VIEW COMPONENTS
  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-center z-50 safe-area-pb">
      <button onClick={() => setView('home')} className={`flex flex-col items-center ${view === 'home' ? 'text-orange-600' : 'text-gray-400'}`}>
        <Home size={24} />
        <span className="text-xs mt-1">Home</span>
      </button>
      <button onClick={() => {}} className="flex flex-col items-center text-gray-400">
        <Search size={24} />
        <span className="text-xs mt-1">Search</span>
      </button>
      <button onClick={() => setView('cart')} className={`flex flex-col items-center ${view === 'cart' ? 'text-orange-600' : 'text-gray-400'} relative`}>
        <div className="relative">
          <ShoppingBag size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </div>
        <span className="text-xs mt-1">Orders</span>
      </button>
      <button onClick={() => setView('profile')} className={`flex flex-col items-center ${view === 'profile' ? 'text-orange-600' : 'text-gray-400'}`}>
        <User size={24} />
        <span className="text-xs mt-1">Profile</span>
      </button>
    </div>
  );

  // RENDER
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:max-w-md md:mx-auto md:shadow-xl md:border-x md:border-gray-200 relative overflow-hidden">
      
      {/* TOP BAR (Mobile Style) */}
      <div className="bg-orange-600 text-white p-4 rounded-b-3xl shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className="bg-white/20 p-2 rounded-full">
                    <MapPin size={18} className="text-white" />
                </div>
                <div>
                    <p className="text-xs text-orange-100 uppercase tracking-wider font-bold">Delivering to</p>
                    <p className="font-semibold text-sm flex items-center gap-1 cursor-pointer">
                        Iloilo Business Park <span className="text-orange-200 text-xs">▼</span>
                    </p>
                </div>
            </div>
            <div className="w-8 h-8 bg-orange-700 rounded-full flex items-center justify-center font-bold text-sm">
                JD
            </div>
        </div>
        
        {view === 'home' && (
            <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                    type="text"
                    placeholder="What are you craving?"
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="p-4">
        
        {/* HOME VIEW */}
        {view === 'home' && (
          <>
            {/* Categories */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {['Fast Food', 'Healthy', 'Milk Tea', 'Local'].map((cat) => (
                <div key={cat} className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm text-orange-600">
                    {cat === 'Fast Food' && '🍔'}
                    {cat === 'Healthy' && '🥗'}
                    {cat === 'Milk Tea' && '🧋'}
                    {cat === 'Local' && '🍛'}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{cat}</span>
                </div>
              ))}
            </div>

            {/* Featured Section */}
            <div className="flex justify-between items-end mb-3">
                <h2 className="text-lg font-bold text-gray-800">Featured</h2>
                <span className="text-xs text-orange-600 font-semibold">See All</span>
            </div>

            <div className="space-y-5">
              {loading ? (
                <div className="text-center py-10 text-gray-400">Loading appetizing options...</div>
              ) : (
                restaurants.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map((r) => (
                  <div key={r.id} onClick={() => { setActiveRestaurant(r); setView('restaurant'); }} 
                       className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]">
                    <div className="h-36 w-full relative">
                        <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow flex items-center gap-1">
                            <Clock size={12} className="text-orange-500" /> {r.time}
                        </div>
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{r.name}</h3>
                        <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded text-green-700 font-bold text-xs">
                            <Star size={10} fill="currentColor" /> {r.rating}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{r.cuisine} • ₱₱</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* RESTAURANT VIEW */}
        {view === 'restaurant' && activeRestaurant && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => setView('home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
                <ChevronLeft size={16} /> Back
            </button>
            
            <div className="flex gap-4 items-center mb-6">
                <img src={activeRestaurant.image} className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
                <div>
                    <h1 className="text-2xl font-bold leading-none mb-1">{activeRestaurant.name}</h1>
                    <p className="text-sm text-gray-500">{activeRestaurant.cuisine}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" fill="currentColor"/> {activeRestaurant.rating}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {activeRestaurant.time}</span>
                    </div>
                </div>
            </div>

            <h3 className="font-bold text-lg mb-3 border-b border-gray-100 pb-2">Menu</h3>
            <div className="space-y-4">
                {activeRestaurant.menu.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div>
                            <h4 className="font-semibold text-gray-800">{item.name}</h4>
                            <p className="text-xs text-gray-400 line-clamp-1">{item.desc}</p>
                            <p className="text-orange-600 font-bold mt-1">₱{item.price}</p>
                        </div>
                        <button onClick={() => addToCart(item, activeRestaurant)} className="bg-orange-100 text-orange-600 p-2 rounded-full hover:bg-orange-200 transition">
                            <Plus size={18} />
                        </button>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
          <div className="animate-in slide-in-from-right-8 duration-300">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ShoppingBag className="text-orange-600" /> Your Basket
            </h2>
            
            {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <ShoppingBag size={48} className="mb-4 opacity-20" />
                    <p>Your basket is hungry.</p>
                    <button onClick={() => setView('home')} className="mt-4 text-orange-600 font-bold text-sm">Find Food</button>
                </div>
            ) : (
                <>
                    <div className="bg-orange-50 p-3 rounded-lg text-sm text-orange-800 mb-4 border border-orange-100 flex items-center gap-2">
                        <MapPin size={14} /> Ordering from <b>{cart[0].restaurantName}</b>
                    </div>

                    <div className="space-y-4 mb-24">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                                        x{item.quantity}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">{item.name}</h4>
                                        <p className="text-xs text-gray-400">₱{item.price * item.quantity}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500"><Minus size={12} /></button>
                                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center"><Plus size={12} /></button>
                                </div>
                            </div>
                        ))}

                        <div className="border-t border-gray-200 pt-4 mt-6 space-y-2">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Subtotal</span>
                                <span>₱{cartTotal}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Delivery Fee</span>
                                <span>₱49</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2">
                                <span>Total</span>
                                <span>₱{cartTotal + 49}</span>
                            </div>
                        </div>

                        <button onClick={placeOrder} disabled={loading} 
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 mt-4 active:scale-95 transition flex justify-center items-center gap-2">
                            {loading ? 'Placing Order...' : 'Place Order'}
                        </button>
                    </div>
                </>
            )}
          </div>
        )}

        {/* SUCCESS VIEW */}
        {view === 'success' && (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 shadow-sm">
                    <Receipt size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
                <p className="text-gray-500 max-w-xs mx-auto">Your food is being prepared. You can track it in the Orders tab.</p>
                <button onClick={() => setView('home')} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg">
                    Back to Home
                </button>
            </div>
        )}

        {/* PROFILE VIEW */}
        {view === 'profile' && (
            <div className="p-4">
                 <h2 className="text-2xl font-bold mb-6">Profile</h2>
                 <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-2xl">JD</div>
                    <div>
                        <h3 className="font-bold text-lg">John Doe</h3>
                        <p className="text-sm text-gray-500">+63 917 123 4567</p>
                    </div>
                 </div>
                 
                 <div className="space-y-2">
                    {['Saved Addresses', 'Payment Methods', 'Order History', 'Help Center', 'Log Out'].map(item => (
                        <button key={item} className="w-full text-left p-4 bg-white rounded-xl shadow-sm text-sm font-medium text-gray-700 flex justify-between">
                            {item} <ChevronLeft size={16} className="rotate-180 text-gray-400" />
                        </button>
                    ))}
                 </div>
            </div>
        )}

      </div>
      
      {/* Floating Cart Button for Restaurant View */}
      {view === 'restaurant' && cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
            <button onClick={() => setView('cart')} className="w-full bg-orange-600 text-white p-4 rounded-xl shadow-xl flex justify-between items-center font-bold">
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 px-2 py-1 rounded text-xs">{cart.reduce((a,b) => a+b.quantity, 0)} items</div>
                </div>
                <span>View Basket</span>
                <span>₱{cartTotal}</span>
            </button>
        </div>
      )}

      {view !== 'restaurant' && view !== 'success' && <BottomNav />}
    </div>
  );
}
