import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingBag, Home, User, MapPin, Star, Clock, Plus, Minus, ChevronLeft, X, Trash2, Receipt } from 'lucide-react';

// API BASE URL
const API_BASE_URL = '/hungr/api';

// --- MOCK DATA (Fallback for offline/errors) ---
const MOCK_RESTAURANTS = [
  {
    id: 1,
    name: "Manila BBQ Spot",
    cuisine_type: "Filipino",
    rating: 4.8,
    delivery_time_min: 25,
    delivery_time_max: 40,
    image_url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800",
    menu: [
      { id: 101, name: "Chicken Inasal", price: 180, description: "Grilled chicken with calamansi", category: "Mains" },
      { id: 102, name: "Pork Sisig", price: 220, description: "Sizzling chopped pork", category: "Mains" },
      { id: 103, name: "Garlic Rice", price: 45, description: "Fried rice with toasted garlic", category: "Sides" }
    ]
  },
  {
    id: 2,
    name: "Sakura Ramen",
    cuisine_type: "Japanese",
    rating: 4.5,
    delivery_time_min: 30,
    delivery_time_max: 50,
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=800",
    menu: [
      { id: 201, name: "Tonkotsu Ramen", price: 350, description: "Rich pork broth", category: "Noodles" },
      { id: 202, name: "Gyoza (5pcs)", price: 150, description: "Pan-fried dumplings", category: "Sides" }
    ]
  },
];

// --- MAIN COMPONENT ---
export default function App() {
  // STATE
  const [view, setView] = useState('home');
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantMenu, setRestaurantMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Fetch menu when restaurant is selected
  useEffect(() => {
    if (activeRestaurant && view === 'restaurant') {
      fetchRestaurantMenu(activeRestaurant.id);
    }
  }, [activeRestaurant, view]);

  // FETCH RESTAURANTS
  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/restaurants`);
      if (!response.ok) throw new Error('Failed to fetch restaurants');
      const data = await response.json();
      setRestaurants(data || MOCK_RESTAURANTS);
    } catch (err) {
      console.error('Error fetching restaurants:', err);
      setError(err.message);
      setRestaurants(MOCK_RESTAURANTS);
    } finally {
      setLoading(false);
    }
  };

  // FETCH MENU ITEMS
  const fetchRestaurantMenu = async (restaurantId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/restaurants/${restaurantId}/menu`);
      if (!response.ok) throw new Error('Failed to fetch menu');
      const data = await response.json();
      setRestaurantMenu(data || []);
    } catch (err) {
      console.error('Error fetching menu:', err);
      setError(err.message);
      // Use mock menu if API fails
      const mockRestaurant = MOCK_RESTAURANTS.find(r => r.id === restaurantId);
      setRestaurantMenu(mockRestaurant?.menu || []);
    } finally {
      setLoading(false);
    }
  };

  // CART OPERATIONS
  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id && c.restaurantId === activeRestaurant.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1, restaurantId: activeRestaurant.id }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.id !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(c => c.id === itemId ? { ...c, quantity } : c));
    }
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // SEARCH FILTER
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.cuisine_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [restaurants, searchTerm]);

  // --- RENDER VIEWS ---
  const renderHome = () => (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Hungr</h1>
          <ShoppingBag size={24} />
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search restaurants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-gray-900"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="p-4 text-center text-gray-500">Loading restaurants...</div>}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded m-4">{error}</div>}

      {/* Restaurants Grid */}
      <div className="grid grid-cols-1 gap-4 p-4">
        {filteredRestaurants.map(restaurant => (
          <div
            key={restaurant.id}
            onClick={() => {
              setActiveRestaurant(restaurant);
              setView('restaurant');
            }}
            className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition cursor-pointer"
          >
            <img
              src={restaurant.image_url}
              alt={restaurant.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-lg font-bold">{restaurant.name}</h3>
              <p className="text-gray-600 text-sm">{restaurant.cuisine_type}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <Star size={16} className="fill-yellow-400 text-yellow-400" />
                  <span className="font-bold">{restaurant.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock size={16} />
                  <span className="text-sm">{restaurant.delivery_time_min}-{restaurant.delivery_time_max} min</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRestaurant = () => (
    <div className="pb-32">
      {/* Header */}
      <div className="relative">
        <img
          src={activeRestaurant.image_url}
          alt={activeRestaurant.name}
          className="w-full h-64 object-cover"
        />
        <button
          onClick={() => setView('home')}
          className="absolute top-4 left-4 bg-white rounded-full p-2 shadow"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Restaurant Info */}
      <div className="bg-white p-4 border-b">
        <h2 className="text-2xl font-bold">{activeRestaurant.name}</h2>
        <p className="text-gray-600">{activeRestaurant.cuisine_type}</p>
        <div className="flex gap-4 mt-2 text-sm">
          <div className="flex items-center gap-1">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            {activeRestaurant.rating}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={16} />
            {activeRestaurant.delivery_time_min}-{activeRestaurant.delivery_time_max} min
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="p-4 text-center text-gray-500">Loading menu...</div>}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded m-4">{error}</div>}

      {/* Menu Items */}
      <div className="p-4 space-y-4">
        {restaurantMenu.length === 0 && !loading && (
          <p className="text-gray-500 text-center">No menu items available</p>
        )}
        {restaurantMenu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{item.name}</h3>
              <p className="text-gray-600 text-sm">{item.description}</p>
              <p className="text-orange-500 font-bold mt-2">₱{item.price}</p>
            </div>
            <button
              onClick={() => addToCart(item)}
              className="bg-orange-500 text-white rounded-full p-2 ml-4"
            >
              <Plus size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCart = () => (
    <div className="pb-24">
      <div className="bg-orange-500 text-white p-6">
        <h2 className="text-2xl font-bold">Your Order</h2>
      </div>

      {cart.length === 0 ? (
        <div className="p-8 text-center">
          <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Your cart is empty</p>
          <button
            onClick={() => setView('home')}
            className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {cart.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
              <div className="flex-1">
                <h3 className="font-bold">{item.name}</h3>
                <p className="text-orange-500 font-bold">₱{item.price}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="bg-gray-200 p-1 rounded"
                >
                  <Minus size={16} />
                </button>
                <span className="w-6 text-center font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="bg-gray-200 p-1 rounded"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-500 ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* Checkout Section */}
          <div className="bg-white p-4 rounded-lg shadow mt-6">
            <div className="flex justify-between mb-2">
              <span>Subtotal:</span>
              <span>₱{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-4 text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>₱{cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setView('success')}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold"
            >
              Place Order
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSuccess = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8 text-center max-w-sm">
        <Receipt size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
        <p className="text-gray-600 mb-4">Your order has been sent to the restaurant</p>
        <p className="text-orange-500 font-bold mb-6">Total: ₱{cartTotal.toFixed(2)}</p>
        <button
          onClick={() => {
            setCart([]);
            setView('home');
          }}
          className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

  const renderBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center safe-area-pb">
      <button
        onClick={() => setView('home')}
        className={`flex-1 py-4 text-center ${view === 'home' ? 'text-orange-500 border-t-2 border-orange-500' : 'text-gray-600'}`}
      >
        <Home size={24} className="mx-auto" />
        <span className="text-xs">Home</span>
      </button>
      <button
        onClick={() => setView('cart')}
        className={`flex-1 py-4 text-center relative ${view === 'cart' ? 'text-orange-500 border-t-2 border-orange-500' : 'text-gray-600'}`}
      >
        <ShoppingBag size={24} className="mx-auto" />
        {cartCount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {cartCount}
          </span>
        )}
        <span className="text-xs">Cart</span>
      </button>
      <button
        onClick={() => setView('profile')}
        className={`flex-1 py-4 text-center ${view === 'profile' ? 'text-orange-500 border-t-2 border-orange-500' : 'text-gray-600'}`}
      >
        <User size={24} className="mx-auto" />
        <span className="text-xs">Profile</span>
      </button>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {view === 'home' && renderHome()}
      {view === 'restaurant' && renderRestaurant()}
      {view === 'cart' && renderCart()}
      {view === 'success' && renderSuccess()}
      {renderBottomNav()}
    </div>
  );
}
