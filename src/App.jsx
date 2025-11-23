import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingBag, MapPin, Star, Clock, Plus, Minus, ChevronLeft, X, Trash2, Receipt, AlertCircle, Loader } from 'lucide-react';
import { API_ENDPOINTS, handleApiResponse, handleApiError, logApiCall } from './config/api';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import AuthModal from './components/Auth/AuthModal';
import BottomNav from './components/Navigation/BottomNav';
import ProfileView from './components/Profile/ProfileView';
import WalletView from './components/Wallet/WalletView';
import TransactionHistory from './components/Transactions/TransactionHistory';
import CoinDisplay from './components/Wallet/CoinDisplay';

// --- MAIN APP COMPONENT ---
function AppContent() {
  // STATE
  const { isAuthenticated, user } = useAuth();
  const [view, setView] = useState('home');
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // INITIAL LOAD - Fetch restaurants on mount
  useEffect(() => {
    fetchRestaurants();
  }, []);

  // FETCH RESTAURANTS FROM API
  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    
    try {
      logApiCall('GET', API_ENDPOINTS.RESTAURANTS);
      const response = await fetch(API_ENDPOINTS.RESTAURANTS);
      const data = await handleApiResponse(response);
      
      if (data.success) {
        setRestaurants(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch restaurants');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      console.error('Fetch restaurants error:', err);
    } finally {
      setLoading(false);
    }
  };

  // FETCH MENU FOR SPECIFIC RESTAURANT
  const fetchMenu = async (restaurantId) => {
    setMenuLoading(true);
    setMenuError(null);
    
    try {
      const endpoint = API_ENDPOINTS.RESTAURANT_MENU(restaurantId);
      logApiCall('GET', endpoint);
      
      const response = await fetch(endpoint);
      const data = await handleApiResponse(response);
      
      if (data.success) {
        setActiveRestaurant(prev => ({
          ...prev,
          menu: data.data
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch menu');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setMenuError(errorMsg);
      console.error('Fetch menu error:', err);
    } finally {
      setMenuLoading(false);
    }
  };

  // HANDLE RESTAURANT CLICK - Fetch its menu
  const handleRestaurantClick = (restaurant) => {
    setActiveRestaurant(restaurant);
    setView('restaurant');
    fetchMenu(restaurant.id);
  };

  // CART ACTIONS
  const addToCart = (item, restaurant) => {
    if (cart.length > 0 && cart[0].restaurantId !== restaurant.id) {
      if (!window.confirm('Start a new basket? You can only order from one restaurant at a time.')) {
        return;
      }
      setCart([{ 
        ...item, 
        quantity: 1, 
        restaurantId: restaurant.id, 
        restaurantName: restaurant.name 
      }]);
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        ...item, 
        quantity: 1, 
        restaurantId: restaurant.id, 
        restaurantName: restaurant.name 
      }];
    });
  };

  const updateQty = (itemId, delta) => {
    setCart(prev => prev
      .map(item => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  // PLACE ORDER - Call actual API
  const placeOrder = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (cart.length === 0) {
      setOrderError('Your cart is empty');
      return;
    }

    setOrderLoading(true);
    setOrderError(null);

    try {
      const restaurantId = cart[0].restaurantId;
      const orderPayload = {
        userId: user.id,
        restaurantId: restaurantId,
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price
        })),
        total: cartTotal
      };

      logApiCall('POST', API_ENDPOINTS.CREATE_ORDER, orderPayload);

      const response = await fetch(API_ENDPOINTS.CREATE_ORDER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await handleApiResponse(response);

      if (data.success) {
        console.log('✅ Order placed successfully:', data.data);
        setCart([]);
        setView('success');
        setTimeout(() => setView('home'), 3000);
      } else {
        throw new Error(data.error || 'Failed to place order');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setOrderError(errorMsg);
      console.error('Place order error:', err);
    } finally {
      setOrderLoading(false);
    }
  };

  // RENDER COMPONENTS

  // Error Banner Component
  const ErrorBanner = ({ message, onDismiss }) => (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
      <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-700 font-medium">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
          <X size={16} />
        </button>
      )}
    </div>
  );

  // Loading Skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-200 rounded-2xl h-40 animate-pulse" />
      ))}
    </div>
  );

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:max-w-md md:mx-auto md:shadow-xl md:border-x md:border-gray-200 relative overflow-hidden">
      
      {/* TOP BAR - Updated: Removed "Delivering to", Added Coins & Profile */}
      <div className="bg-orange-600 text-white p-4 rounded-b-3xl shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {view === 'home' && (
              <h1 className="text-2xl font-bold">Hungr</h1>
            )}
          </div>
          
          {/* Right Section: Coins + Profile */}
          <div className="flex items-center gap-4">
            <CoinDisplay onClick={() => setView('wallet')} />
            
            <button
              onClick={() => isAuthenticated ? setView('profile') : setShowAuthModal(true)}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm hover:bg-white/30 transition cursor-pointer"
              title={isAuthenticated ? 'Profile' : 'Login/Signup'}
            >
              {isAuthenticated && user ? user.username?.charAt(0).toUpperCase() : 'G'}
            </button>
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
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {/* Categories - Updated Design */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Food', emoji: '🍔', bg: 'from-red-400 to-red-500' },
                { label: 'Pabili', emoji: '🛒', bg: 'from-blue-400 to-blue-500' },
                { label: 'Stores', emoji: '🏪', bg: 'from-purple-400 to-purple-500' },
                { label: 'Ride', emoji: '🚗', bg: 'from-green-400 to-green-500' }
              ].map((cat) => (
                <div
                  key={cat.label}
                  className={`flex flex-col items-center gap-2 cursor-pointer hover:opacity-90 hover:scale-105 transition-all active:scale-95`}
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${cat.bg} rounded-2xl flex items-center justify-center text-2xl shadow-lg hover:shadow-xl transition-shadow text-white`}>
                    {cat.emoji}
                  </div>
                  <span className="text-xs font-medium text-gray-600">{cat.label}</span>
                </div>
              ))}
            </div>

            {/* Featured Section */}
            <div className="flex justify-between items-end mb-3">
              <h2 className="text-lg font-bold text-gray-800">Featured</h2>
              <span className="text-xs text-orange-600 font-semibold">See All</span>
            </div>

            {/* Restaurant List */}
            <div className="space-y-5">
              {loading ? (
                <LoadingSkeleton />
              ) : restaurants.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No restaurants found</div>
              ) : (
                restaurants
                  .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((r) => (
                    <div 
                      key={r.id} 
                      onClick={() => handleRestaurantClick(r)}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]"
                    >
                      <div className="h-36 w-full relative">
                        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow flex items-center gap-1">
                          <Clock size={12} className="text-orange-500" /> {r.delivery_time_min}-{r.delivery_time_max} min
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-lg text-gray-900 leading-tight">{r.name}</h3>
                          <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded text-green-700 font-bold text-xs">
                            <Star size={10} fill="currentColor" /> {r.rating}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{r.cuisine_type} • ₱₱</p>
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
            {menuError && <ErrorBanner message={menuError} onDismiss={() => setMenuError(null)} />}

            <button onClick={() => setView('home')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600">
              <ChevronLeft size={16} /> Back
            </button>
            
            <div className="flex gap-4 items-center mb-6">
              <img src={activeRestaurant.image_url} alt={activeRestaurant.name} className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
              <div>
                <h1 className="text-2xl font-bold leading-none mb-1">{activeRestaurant.name}</h1>
                <p className="text-sm text-gray-500">{activeRestaurant.cuisine_type}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" fill="currentColor"/> {activeRestaurant.rating}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {activeRestaurant.delivery_time_min}-{activeRestaurant.delivery_time_max} min</span>
                </div>
              </div>
            </div>

            {menuLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-200 rounded-xl h-20 animate-pulse" />
                ))}
              </div>
            ) : activeRestaurant.menu && Object.keys(activeRestaurant.menu).length > 0 ? (
              <>
                <h3 className="font-bold text-lg mb-3 border-b border-gray-100 pb-2">Menu</h3>
                <div className="space-y-5">
                  {Object.entries(activeRestaurant.menu).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wider">{category}</h4>
                      <div className="space-y-3">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-800">{item.name}</h5>
                              <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                              <p className="text-orange-600 font-bold mt-1">₱{item.price}</p>
                            </div>
                            <button 
                              onClick={() => addToCart(item, activeRestaurant)} 
                              className="bg-orange-100 text-orange-600 p-2 rounded-full hover:bg-orange-200 transition"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-400">No menu items available</div>
            )}
          </div>
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
          <div className="animate-in slide-in-from-right-8 duration-300">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <ShoppingBag className="text-orange-600" /> Your Basket
            </h2>
            
            {orderError && <ErrorBanner message={orderError} onDismiss={() => setOrderError(null)} />}
            
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
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                          x{item.quantity}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-400">₱{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateQty(item.id, -1)} 
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
                        >
                          <Minus size={12} />
                        </button>
                        <button 
                          onClick={() => updateQty(item.id, 1)} 
                          className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700"
                        >
                          <Plus size={12} />
                        </button>
                        <button 
                          onClick={() => removeFromCart(item.id)} 
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="border-t border-gray-200 pt-4 mt-6 space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>₱{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Delivery Fee</span>
                      <span>₱49</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2">
                      <span>Total</span>
                      <span>₱{(cartTotal + 49).toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={placeOrder} 
                    disabled={orderLoading}
                    className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 mt-4 active:scale-95 transition flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {orderLoading ? (
                      <>
                        <Loader size={18} className="animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      'Place Order'
                    )}
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
            <p className="text-gray-500 max-w-xs mx-auto mb-2">Your food is being prepared. You can track it in the Transactions tab.</p>
            <p className="text-xs text-gray-400">Redirecting in 3 seconds...</p>
            <button onClick={() => setView('home')} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg">
              Back to Home
            </button>
          </div>
        )}

        {/* PROFILE VIEW */}
        {view === 'profile' && (
          <ProfileView setView={setView} />
        )}

        {/* WALLET VIEW */}
        {view === 'wallet' && (
          <WalletView />
        )}

        {/* TRANSACTIONS VIEW */}
        {view === 'transactions' && (
          <TransactionHistory />
        )}

        {/* INBOX VIEW (Placeholder) */}
        {view === 'inbox' && (
          <div className="pb-20">
            <h2 className="text-xl font-bold mb-6">Inbox</h2>
            <div className="text-center py-12 bg-white rounded-xl">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-gray-500">No messages yet</p>
            </div>
          </div>
        )}

      </div>
      
      {/* Floating Cart Button for Restaurant View */}
      {view === 'restaurant' && cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:bottom-24">
          <button onClick={() => setView('cart')} className="w-full bg-orange-600 text-white p-4 rounded-xl shadow-xl flex justify-between items-center font-bold">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 px-2 py-1 rounded text-xs">{cart.reduce((a,b) => a+b.quantity, 0)} items</div>
            </div>
            <span>View Basket</span>
            <span>₱{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Bottom Navigation - Hidden on restaurant/success views */}
      {view !== 'restaurant' && view !== 'success' && <BottomNav view={view} setView={setView} cartCount={cart.length} />}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}

// --- WRAPPED WITH AUTH PROVIDER ---
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
