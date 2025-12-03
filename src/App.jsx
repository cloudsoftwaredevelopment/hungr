import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ShoppingBag, MapPin, Star, Clock, Plus, Minus, ChevronLeft, 
  X, Trash2, Receipt, AlertCircle, Loader, Package, User, Bike, 
  DollarSign, Home, Wallet, List, User as UserIcon,
  ChevronRight, LogOut, Phone, Mail, Navigation, Database, Store
} from 'lucide-react';

// --- IMPORTS ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProfileView from './components/Profile/ProfileView';
import SavedAddresses from './components/Address/SavedAddresses';

// --- CONFIG ---
const API_URL = '/api';

// --- MONOLITHIC COMPONENTS (To be refactored next) ---

const RidesView = ({ setView }) => { 
  // State
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [distance, setDistance] = useState(null);
  const [rideError, setRideError] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Get user's current location on component mount
  useEffect(() => {
    if (!currentLocation) {
      getUserLocation();
    }
  }, []);

  // Get user's current location via geolocation API
  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      setRideError('Geolocation is not supported by your browser');
      return;
    }

    setLoadingLocation(true);
    setRideError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`📍 Location found: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

        try {
          const response = await fetch(
            `${API_URL}/geocode/reverse?lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          const locationData = {
            lat: latitude,
            lon: longitude,
            address: data.data?.address || data.data?.display_name || 'Current Location'
          };

          setCurrentLocation(locationData);
          setLoadingLocation(false);
        } catch (err) {
          console.error('Reverse geocode error:', err);
          setRideError('Failed to get address for current location');
          
          // Fallback: use coordinates
          setCurrentLocation({
            lat: latitude,
            lon: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Unable to access your location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location access denied. Please enable location services.';
        }
        setRideError(errorMsg);
        setLoadingLocation(false);
      }
    );
  };

  // Search for destination addresses
  const searchDestination = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `${API_URL}/geocode/search?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setSuggestions(data.data);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Search failed');
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle destination input change with debouncing
  const handleDestinationChange = (value) => {
    setDestinationQuery(value);
    setSelectedDestination(null);
    setEstimatedFare(null);
    setDistance(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchDestination(value);
    }, 300);
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion) => {
    const destination = {
      lat: parseFloat(suggestion.latitude),
      lon: parseFloat(suggestion.longitude),
      address: suggestion.address || suggestion.display_name
    };

    setSelectedDestination(destination);
    setDestinationQuery(destination.address);
    setSuggestions([]);
    setSearchError(null);

    if (currentLocation) {
      calculateDistanceAndFare(currentLocation, destination);
    }
  };

  // Calculate distance using Haversine formula and estimate fare
  const calculateDistanceAndFare = (start, end) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((end.lat - start.lat) * Math.PI) / 180;
    const dLon = ((end.lon - start.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((start.lat * Math.PI) / 180) *
        Math.cos((end.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const calculatedDistance = R * c;

    setDistance(calculatedDistance.toFixed(1));

    // Estimate fare: ₱40 base + ₱15 per km
    const baseFare = 40;
    const perKmRate = 15;
    const fare = baseFare + calculatedDistance * perKmRate;
    setEstimatedFare({
      minimum: Math.ceil(fare),
      maximum: Math.ceil(fare * 1.2)
    });
  };

  const handleRefreshLocation = () => {
    setCurrentLocation(null);
    getUserLocation();
  };

  return (
    <div className="pb-20 animate-in slide-in-from-right">
      <h2 className="text-xl font-bold mb-6">Book a Ride</h2>

      {rideError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">{rideError}</p>
          </div>
          <button onClick={() => setRideError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* CURRENT LOCATION SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-900">Your Current Location</h3>
          </div>
          <button
            onClick={handleRefreshLocation}
            disabled={loadingLocation}
            className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {loadingLocation ? <Loader size={16} className="animate-spin" /> : <Navigation size={16} />}
          </button>
        </div>

        {loadingLocation ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader size={16} className="animate-spin" />
            <span className="text-sm">Getting your location...</span>
          </div>
        ) : currentLocation ? (
          <div>
            <div className="bg-gray-50 rounded-lg p-3 mb-2">
              <p className="text-sm font-medium text-gray-900">{currentLocation.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">Unable to get your location</p>
            <button onClick={handleRefreshLocation} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* DESTINATION SEARCH SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search size={20} className="text-orange-600" />
          <h3 className="font-bold text-gray-900">Where to?</h3>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Enter destination address..."
            value={destinationQuery}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            disabled={!currentLocation}
          />

          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery('');
                setSuggestions([]);
                setSelectedDestination(null);
              }}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}

          {searching && (
            <div className="absolute right-3 top-3">
              <Loader size={16} className="animate-spin text-orange-600" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 hover:bg-gray-100 transition border-b border-gray-200 last:border-b-0 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {suggestion.address || suggestion.display_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {suggestion.display_name}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-gray-400 flex-shrink-0 ml-2" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ROUTE SUMMARY SECTION */}
      {selectedDestination && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-4">Trip Summary</h3>
          <div className="space-y-3 mb-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div className="w-0.5 h-12 bg-gray-300 my-1"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs text-gray-500 font-medium">From</p>
                <p className="text-sm font-medium text-gray-900">{currentLocation.address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs text-gray-500 font-medium">To</p>
                <p className="text-sm font-medium text-gray-900">{selectedDestination.address}</p>
              </div>
            </div>
          </div>

          {distance && estimatedFare && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-blue-200">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">Distance</div>
                <div className="text-lg font-bold text-gray-900">{distance} km</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium mb-1">Est. Fare</div>
                <div className="text-lg font-bold text-orange-600">
                  ₱{estimatedFare.minimum}-{estimatedFare.maximum}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOOK RIDE BUTTON */}
      {currentLocation && selectedDestination && estimatedFare && (
        <button
          onClick={() => alert("Ride booking feature coming soon!")}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-between px-6 transition active:scale-95"
        >
          <span>Book Ride</span>
          <span className="text-lg">₱{estimatedFare.minimum}</span>
        </button>
      )}
    </div>
  );
};

const StoresView = ({ setView, addToCart }) => {
  const [internalView, setInternalView] = useState('categories'); // categories, list, detail
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeDetails, setStoreDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initial Load: Categories
  useEffect(() => {
    // Mock Categories for now
    setCategories([
        { id: 'groceries', name: 'Groceries', icon: '🥦', store_count: 12 },
        { id: 'pharmacy', name: 'Pharmacy', icon: '💊', store_count: 8 },
        { id: 'pet', name: 'Pet Supplies', icon: '🐾', store_count: 5 },
        { id: 'electronics', name: 'Electronics', icon: '📱', store_count: 4 }
    ]);
  }, []);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setLoading(true);
    // Mock Store Fetch
    setTimeout(() => {
        setStores([
            { id: 101, name: "All Day Supermarket", category: 'groceries', rating: 4.8, distance: '1.2km', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400' },
            { id: 102, name: "Puregold", category: 'groceries', rating: 4.5, distance: '2.0km', image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=400' },
            { id: 103, name: "Mercury Drug", category: 'pharmacy', rating: 4.9, distance: '0.8km', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=400' }
        ].filter(s => s.category === catId || catId === 'all'));
        setInternalView('list');
        setLoading(false);
    }, 500);
  };

  const handleStoreSelect = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    setSelectedStore(store);
    setLoading(true);
    // Mock Detail Fetch
    setTimeout(() => {
        setStoreDetails({
            ...store,
            products: {
                'Best Sellers': [
                    { id: 1, name: 'Fresh Milk 1L', price: 95, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200' },
                    { id: 2, name: 'Whole Wheat Bread', price: 75, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' }
                ],
                'Snacks': [
                    { id: 3, name: 'Potato Chips', price: 45, image: 'https://images.unsplash.com/photo-1566478919030-261744529942?auto=format&fit=crop&q=80&w=200' }
                ]
            }
        });
        setInternalView('detail');
        setLoading(false);
    }, 500);
  };

  return (
    <div className="pb-20 animate-in slide-in-from-right">
        {/* Navigation Header */}
        <div className="mb-4">
            {internalView === 'categories' ? (
                <h2 className="text-xl font-bold">Store Categories</h2>
            ) : (
                <button 
                    onClick={() => setInternalView(internalView === 'detail' ? 'list' : 'categories')}
                    className="flex items-center gap-1 text-gray-500 hover:text-orange-600 transition"
                >
                    <ChevronLeft size={20} /> Back
                </button>
            )}
        </div>

        {/* CATEGORIES GRID */}
        {internalView === 'categories' && (
            <div className="grid grid-cols-2 gap-4">
                {categories.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => handleCategorySelect(cat.id)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-orange-200 transition"
                    >
                        <span className="text-4xl">{cat.icon}</span>
                        <div className="text-center">
                            <h3 className="font-bold text-gray-800">{cat.name}</h3>
                            <p className="text-xs text-gray-500">{cat.store_count} stores</p>
                        </div>
                    </button>
                ))}
            </div>
        )}

        {/* STORES LIST */}
        {internalView === 'list' && (
            <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4">{categories.find(c => c.id === selectedCategory)?.name}</h2>
                {loading ? <Loader className="mx-auto animate-spin text-orange-600" /> : stores.map(store => (
                    <div 
                        key={store.id} 
                        onClick={() => handleStoreSelect(store.id)}
                        className="bg-white rounded-xl shadow-sm overflow-hidden flex gap-4 p-3 border border-gray-100 cursor-pointer hover:shadow-md transition"
                    >
                        <img src={store.image} alt={store.name} className="w-20 h-20 object-cover rounded-lg bg-gray-200" />
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{store.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-current"/> {store.rating}</span>
                                <span>•</span>
                                <span>{store.distance}</span>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 self-center" />
                    </div>
                ))}
            </div>
        )}

        {/* STORE DETAILS */}
        {internalView === 'detail' && storeDetails && (
            <div>
                {/* Banner */}
                <div className="relative h-40 rounded-xl overflow-hidden mb-6">
                    <img src={storeDetails.image} alt={storeDetails.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                        <h1 className="text-white text-2xl font-bold">{storeDetails.name}</h1>
                    </div>
                </div>

                {/* Products */}
                {Object.entries(storeDetails.products).map(([cat, items]) => (
                    <div key={cat} className="mb-6">
                        <h3 className="font-bold text-gray-800 mb-3">{cat}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {items.map(item => (
                                <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2 bg-gray-100" />
                                    <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-orange-600 font-bold text-sm">₱{item.price}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); addToCart?.(item, storeDetails); }}
                                            className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center hover:bg-orange-200"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

const BottomNav = ({ view, setView, cartCount }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 md:max-w-md md:mx-auto">
    <button onClick={() => setView('home')} className={`flex flex-col items-center ${view === 'home' ? 'text-orange-600' : 'text-gray-400'}`}>
      <Home size={24} />
      <span className="text-[10px] font-bold mt-1">Home</span>
    </button>
    <button onClick={() => setView('transactions')} className={`flex flex-col items-center ${view === 'transactions' ? 'text-orange-600' : 'text-gray-400'}`}>
      <List size={24} />
      <span className="text-[10px] font-bold mt-1">Orders</span>
    </button>
    <div className="relative -top-5">
      <button onClick={() => setView('cart')} className="bg-orange-600 text-white p-4 rounded-full shadow-lg shadow-orange-200 hover:scale-105 transition">
        <ShoppingBag size={24} />
        {cartCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
            {cartCount}
          </span>
        )}
      </button>
    </div>
    <button onClick={() => setView('wallet')} className={`flex flex-col items-center ${view === 'wallet' ? 'text-orange-600' : 'text-gray-400'}`}>
      <Wallet size={24} />
      <span className="text-[10px] font-bold mt-1">Wallet</span>
    </button>
    <button onClick={() => setView('profile')} className={`flex flex-col items-center ${view === 'profile' ? 'text-orange-600' : 'text-gray-400'}`}>
      <UserIcon size={24} />
      <span className="text-[10px] font-bold mt-1">Profile</span>
    </button>
  </div>
);

const CoinDisplay = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-yellow-300 transition cursor-pointer">
    <div className="w-4 h-4 rounded-full bg-yellow-200 border-2 border-yellow-600 flex items-center justify-center text-[8px]">$</div>
    <span>150</span>
  </button>
);

const AuthModal = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) onClose();
    else setError(res.error);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative animate-in zoom-in duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
        <h2 className="text-2xl font-bold mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" required />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200" required />
          <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- MAIN APP CONTENT ---

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [view, setView] = useState('home');
  const [restaurants, setRestaurants] = useState([]);
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [pabiliStores, setPabiliStores] = useState([]);
  const [selectedPabiliStore, setSelectedPabiliStore] = useState(null);
  const [pabiliItems, setPabiliItems] = useState([{ name: '', qty: '' }]);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [pabiliOrder, setPabiliOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // New state to track data source
  const [isUsingDemoData, setIsUsingDemoData] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/restaurants`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setRestaurants(data.data);
        setIsUsingDemoData(false); // Successfully fetched data
      } else {
        throw new Error("Empty list");
      }
    } catch (err) {
      console.warn("Using demo data");
      setIsUsingDemoData(true); // Switch to demo mode
      setRestaurants([
        { id: 1, name: "Jollibee", cuisine_type: "Fast Food", rating: 4.9, delivery_time_min: 20, delivery_time_max: 35, image_url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400" },
        { id: 2, name: "McDonald's", cuisine_type: "Fast Food", rating: 4.8, delivery_time_min: 15, delivery_time_max: 30, image_url: "https://images.unsplash.com/photo-1552590635-27c2c2128abf?auto=format&fit=crop&q=80&w=400" },
        { id: 3, name: "Chowking", cuisine_type: "Chinese", rating: 4.6, delivery_time_min: 25, delivery_time_max: 40, image_url: "https://images.unsplash.com/photo-1563245372-f21720e32c4d?auto=format&fit=crop&q=80&w=400" },
        { id: 4, name: "Mang Inasal", cuisine_type: "Filipino", rating: 4.7, delivery_time_min: 30, delivery_time_max: 45, image_url: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=400" },
        { id: 5, name: "KFC", cuisine_type: "Fast Food", rating: 4.7, delivery_time_min: 20, delivery_time_max: 35, image_url: "https://images.unsplash.com/photo-1513639776629-7b611599e1e6?auto=format&fit=crop&q=80&w=400" },
        { id: 6, name: "Greenwich", cuisine_type: "Pizza", rating: 4.5, delivery_time_min: 35, delivery_time_max: 50, image_url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&q=80&w=400" },
        { id: 7, name: "Pizza Hut", cuisine_type: "Pizza", rating: 4.6, delivery_time_min: 30, delivery_time_max: 45, image_url: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=400" },
        { id: 8, name: "Shakey's", cuisine_type: "Pizza", rating: 4.7, delivery_time_min: 30, delivery_time_max: 50, image_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400" },
        { id: 9, name: "BonChon Chicken", cuisine_type: "Korean", rating: 4.5, delivery_time_min: 25, delivery_time_max: 40, image_url: "https://images.unsplash.com/photo-1626082929543-5bab0f006c42?auto=format&fit=crop&q=80&w=400" },
        { id: 10, name: "Max's Restaurant", cuisine_type: "Filipino", rating: 4.8, delivery_time_min: 40, delivery_time_max: 60, image_url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=400" },
        { id: 11, name: "Burger King", cuisine_type: "Fast Food", rating: 4.6, delivery_time_min: 20, delivery_time_max: 35, image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400" },
        { id: 12, name: "Army Navy", cuisine_type: "American", rating: 4.8, delivery_time_min: 30, delivery_time_max: 45, image_url: "https://images.unsplash.com/photo-1586190848861-99c8a3fb7ea5?auto=format&fit=crop&q=80&w=400" },
        { id: 13, name: "Yellow Cab Pizza", cuisine_type: "Pizza", rating: 4.7, delivery_time_min: 35, delivery_time_max: 50, image_url: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&q=80&w=400" },
        { id: 14, name: "Conti's", cuisine_type: "Bakery", rating: 4.9, delivery_time_min: 45, delivery_time_max: 60, image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400" },
        { id: 15, name: "Kenny Rogers", cuisine_type: "American", rating: 4.6, delivery_time_min: 30, delivery_time_max: 45, image_url: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=400" },
        { id: 16, name: "North Park", cuisine_type: "Chinese", rating: 4.7, delivery_time_min: 35, delivery_time_max: 55, image_url: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=400" },
        { id: 17, name: "Amber", cuisine_type: "Filipino", rating: 4.8, delivery_time_min: 40, delivery_time_max: 60, image_url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=400" },
        { id: 18, name: "Goldilocks", cuisine_type: "Bakery", rating: 4.5, delivery_time_min: 20, delivery_time_max: 40, image_url: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&q=80&w=400" },
        { id: 19, name: "Red Ribbon", cuisine_type: "Bakery", rating: 4.5, delivery_time_min: 20, delivery_time_max: 40, image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400" },
        { id: 20, name: "Starbucks", cuisine_type: "Coffee", rating: 4.9, delivery_time_min: 15, delivery_time_max: 30, image_url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=400" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPabiliStores = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/pabili/stores`);
      const data = await response.json();
      if (data.success) setPabiliStores(data.data);
      else throw new Error("No stores");
    } catch (err) {
      setPabiliStores([
        { id: 101, name: "7-Eleven", address: "Corner St.", rating: 4.5 },
        { id: 102, name: "Mercury Drug", address: "Main Ave.", rating: 4.8 },
        { id: 103, name: "Uncle John's", address: "Plaza", rating: 4.2 },
        { id: 104, name: "Robinsons Supermarket", address: "Mall Level 1", rating: 4.7 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitPabiliOrder = async () => {
    if (!isAuthenticated) return setShowAuthModal(true);
    const validItems = pabiliItems.filter(i => i.name.trim() !== '');
    if (validItems.length === 0) return setError('Please add at least one item');
    if (!estimatedCost) return setError('Please enter an estimated cost');

    setLoading(true);
    const payload = {
        storeId: selectedPabiliStore.id,
        items: validItems,
        estimatedCost: parseFloat(estimatedCost),
        deliveryAddress: user?.address || 'Current Location',
        recipient: user?.username,
        mobile: user?.phone_number
    };

    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/pabili/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        setPabiliOrder({ ...payload, id: data.data.orderId, status: 'pending' });
        setView('pabili-tracking');
        setPabiliItems([{ name: '', qty: '' }]);
        setEstimatedCost('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setPabiliOrder({ ...payload, id: Date.now(), status: 'pending' });
      setView('pabili-tracking');
      setPabiliItems([{ name: '', qty: '' }]);
      setEstimatedCost('');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category) => {
    if (category === 'Pabili') {
      fetchPabiliStores();
      setView('pabili-stores');
    } else if (category === 'Ride') {
      setView('rides');
    } else if (category === 'Stores') {
      setView('stores');
    } else {
      setView('home');
    }
  };

  const handlePabiliStoreSelect = (store) => {
    setSelectedPabiliStore(store);
    setView('pabili-form');
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...pabiliItems];
    newItems[index][field] = value;
    setPabiliItems(newItems);
  };

  const addPabiliItem = () => setPabiliItems([...pabiliItems, { name: '', qty: '' }]);
  const removePabiliItem = (index) => {
    if (pabiliItems.length > 1) {
      const newItems = pabiliItems.filter((_, i) => i !== index);
      setPabiliItems(newItems);
    }
  };

  const ErrorBanner = ({ message }) => (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
      <AlertCircle size={18} />
      <span className="text-sm">{message}</span>
      <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:max-w-md md:mx-auto md:shadow-xl relative overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-orange-600 text-white p-4 rounded-b-3xl shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between gap-3">
          {view !== 'home' ? (
            <button onClick={() => setView('home')} className="p-1 hover:bg-white/20 rounded-full transition">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" placeholder="What are you craving?" 
                className="w-full py-2 pl-9 pr-3 rounded-xl text-gray-800 text-sm focus:outline-none"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <CoinDisplay onClick={() => setView('wallet')} />
            <button onClick={() => isAuthenticated ? setView('profile') : setShowAuthModal(true)} 
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-xs">
              {isAuthenticated && user ? user.username[0].toUpperCase() : <User size={16} />}
            </button>
          </div>
        </div>
        
        {/* Dynamic Header Title */}
        {(view.startsWith('pabili') || view === 'rides' || view === 'stores') && (
          <div className="mt-4 animate-in fade-in">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {view.startsWith('pabili') ? <ShoppingBag className="text-orange-200" /> : 
               view === 'rides' ? <Bike className="text-orange-200" /> :
               <Store className="text-orange-200" />}
              {view.startsWith('pabili') ? 'Pabili' : view === 'rides' ? 'Rides' : 'Stores'}
            </h1>
            <p className="text-orange-100 text-sm opacity-90">
              {view === 'pabili-stores' ? 'Select a store nearby' : 
               view === 'pabili-form' ? `Buy from ${selectedPabiliStore?.name}` : 
               view === 'rides' ? 'Where are you going?' :
               view === 'stores' ? 'Shop by category' :
               'Tracking your order'}
            </p>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Data Source Indicator */}
        <div className={`mb-3 text-xs font-bold px-2 py-1 rounded w-fit flex items-center gap-1 ${isUsingDemoData ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {isUsingDemoData ? <><AlertCircle size={12}/> Demo Mode</> : <><Database size={12}/> Live Data</>}
        </div>

        {error && <ErrorBanner message={error} />}

        {/* HOME VIEW */}
        {view === 'home' && (
          <>
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
            
            <div className="grid grid-cols-2 gap-4">
              {loading ? <div className="col-span-2 flex justify-center"><Loader className="animate-spin text-orange-600" /></div> : 
                restaurants.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]" onClick={() => { setActiveRestaurant(r); setView('restaurant'); }}>
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
              }
            </div>
          </>
        )}

        {/* PABILI: STORE LIST VIEW */}
        {view === 'pabili-stores' && (
          <div className="space-y-4 animate-in slide-in-from-right">
            {loading ? <Loader className="animate-spin mx-auto text-orange-600" /> : 
              pabiliStores.length === 0 ? <p className="text-center text-gray-400">No stores found nearby.</p> :
              pabiliStores.map(store => (
                <div 
                  key={store.id} 
                  onClick={() => handlePabiliStoreSelect(store)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-orange-200 transition"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🏪</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{store.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {store.address || '1.2 km away'}
                    </p>
                    <p className="text-xs text-orange-600 font-semibold mt-1">
                      ~10-15 mins travel time
                    </p>
                  </div>
                  <ChevronLeft size={20} className="rotate-180 text-gray-300" />
                </div>
              ))
            }
          </div>
        )}

        {/* PABILI: ORDER FORM VIEW */}
        {view === 'pabili-form' && (
          <div className="space-y-6 animate-in slide-in-from-right pb-20">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <ShoppingBag size={18} className="text-orange-600" /> Shopping List
              </h3>
              
              <div className="space-y-3">
                {pabiliItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="Item Name (e.g., Eggs)"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-l-xl focus:border-orange-500 outline-none text-sm"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-1/3">
                      <input 
                        type="text" 
                        placeholder="Qty"
                        className="w-full p-3 bg-gray-50 border-y border-r border-gray-200 rounded-r-xl focus:border-orange-500 outline-none text-sm"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => removePabiliItem(idx)}
                      className={`p-3 text-gray-400 hover:text-red-500 transition ${pabiliItems.length === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={addPabiliItem}
                className="mt-4 text-orange-600 text-sm font-bold flex items-center gap-2 hover:bg-orange-50 px-3 py-2 rounded-lg transition"
              >
                <Plus size={16} /> Add another item
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign size={18} className="text-orange-600" /> Estimated Cost
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                How much cash should the rider bring to purchase these items?
              </p>
              <div className="relative">
                <span className="absolute left-4 top-3.5 font-bold text-gray-400">₱</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full p-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 outline-none"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={18} className="text-orange-600" /> Delivery Address
              </h3>
              <p className="text-sm bg-gray-50 p-3 rounded-xl text-gray-600 border border-gray-200">
                {user?.address || "Please set your address in profile"}
              </p>
            </div>

            <button 
              onClick={submitPabiliOrder}
              disabled={loading}
              className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Finding Rider...' : 'Find Rider'}
            </button>
          </div>
        )}

        {/* PABILI: TRACKING VIEW */}
        {view === 'pabili-tracking' && pabiliOrder && (
          <div className="text-center py-10 animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <Bike size={48} className="text-green-600" />
              <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-md">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Sent!</h2>
            <p className="text-gray-500 mb-8 px-8">
              We are looking for a rider near <b>{selectedPabiliStore?.name}</b>.
            </p>

            <div className="bg-white rounded-2xl mx-4 p-6 shadow-sm border border-gray-100 text-left space-y-6 relative overflow-hidden">
               <div className="absolute left-9 top-10 bottom-10 w-0.5 bg-gray-100"></div>

               {['Pending Confirmation', 'Driving to store', 'Gathering Items', 'Falling in line to pay', 'Coming to your address'].map((step, i) => (
                 <div key={i} className="flex items-center gap-4 relative z-10">
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 
                     ${i === 0 ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-300'}`}>
                     {i === 0 ? '✓' : i + 1}
                   </div>
                   <span className={i === 0 ? 'font-bold text-green-700' : 'text-gray-400'}>{step}</span>
                 </div>
               ))}
            </div>

            <button onClick={() => setView('home')} className="mt-8 text-orange-600 font-bold text-sm">
              Back to Home
            </button>
          </div>
        )}

        {view === 'wallet' && <div className="text-center p-10"><Wallet size={48} className="mx-auto text-gray-300 mb-2"/>Wallet Feature</div>}
        {view === 'transactions' && <div className="text-center p-10"><List size={48} className="mx-auto text-gray-300 mb-2"/>Transactions</div>}
        
        {/* ADDED: Profile View (Refactored) */}
        {view === 'profile' && <ProfileView setView={setView} />}
        {/* ADDED: Addresses View (Refactored) */}
        {view === 'addresses' && <SavedAddresses setView={setView} />}
        
        {/* ADDED: Rides View */}
        {view === 'rides' && <RidesView setView={setView} />}
        
        {/* ADDED: Stores View */}
        {view === 'stores' && <StoresView setView={setView} />}

      </div>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {view !== 'pabili-form' && view !== 'pabili-tracking' && view !== 'rides' && view !== 'stores' && (
        <BottomNav view={view} setView={setView} cartCount={cart.length} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
