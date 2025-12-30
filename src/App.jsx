import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Store, User, Bike, AlertCircle, Database, ChevronLeft } from 'lucide-react';
import { io } from 'socket.io-client';

// --- IMPORTS ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './components/UI/Toast';
import Login from './components/Auth/Login';
import HomeView from './components/Home/HomeView';
import PabiliView from './components/Pabili/PabiliView';
import CartView from './components/Cart/CartView';
import ProfileView from './components/Profile/ProfileView';
import SavedAddresses from './components/Address/SavedAddresses';
import AddressEditor from './components/Address/AddressEditor';
import RidesView from './components/Rides/RidesView';
import StoresView from './components/Stores/StoresView';
import StoreDetailView from './components/Stores/StoreDetailView';
import FoodView from './components/Food/FoodView';
import RestaurantView from './components/Restaurant/RestaurantView';
import BottomNav from './components/Navigation/BottomNav';
import WalletView from './components/Wallet/WalletView';
import TransactionsView from './components/Transactions/TransactionsView';
import CoinsView from './components/Coin/CoinsView';
import CoinDisplay from './components/Coin/CoinDisplay';

import socket from './config/socket';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // Or spinner, but AppContent handles main loading

  if (!isAuthenticated) {
    console.log("[ProtectedRoute] Denied. Redirecting to login.");
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [cart, setCart] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Socket.IO connection for notifications
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      socket.connect();

      // Listen for restaurant open notifications
      const eventName = `user_${user.id}_restaurant_open`;
      socket.on(eventName, (data) => {
        console.log('[Socket] Restaurant opened:', data);
        showToast(data.message, 'success', 8000);
      });

      return () => {
        socket.off(eventName);
        socket.disconnect();
      };
    }
  }, [isAuthenticated, user?.id, showToast]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/restaurants');
      const data = await response.json();
      if (data.success) {
        setRestaurants(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch restaurants", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetView = (viewName) => {
    switch (viewName) {
      case 'home': navigate('/'); break;
      case 'pabili': navigate('/pabili'); break;
      case 'cart': navigate('/cart'); break;
      case 'profile': navigate('/profile'); break;
      case 'wallet': navigate('/wallet'); break;
      case 'rides': navigate('/rides'); break;
      case 'stores': navigate('/stores'); break;
      case 'food': navigate('/food'); break;
      case 'transactions': navigate('/transactions'); break;
      case 'coins': navigate('/coins'); break;
      case 'addresses': navigate('/addresses'); break;
      case 'address-editor': navigate('/address-editor'); break;
      default: navigate('/');
    }
  };

  const getCurrentView = () => {
    const path = location.pathname;
    if (path.includes('login')) return 'login';
    if (path === '/' || path === '/hungr/') return 'home';
    if (path.includes('pabili')) return 'pabili';
    if (path.includes('cart')) return 'cart';
    if (path.includes('profile')) return 'profile';
    if (path.includes('food')) return 'food';
    if (path.includes('rides')) return 'rides';
    if (path.includes('stores')) return 'stores';
    if (path.includes('wallet')) return 'wallet';
    if (path.includes('coins')) return 'coins';
    if (path.includes('transactions')) return 'transactions';
    if (path.includes('addresses')) return 'addresses';
    if (path.includes('address-editor')) return 'address-editor';
    return 'home';
  };

  const currentView = getCurrentView();

  // UPDATED: Added 'pabili', 'stores', 'rides' to the exclusion list so they don't show the orange header
  const showMainHeader = !['cart', 'food', 'wallet', 'transactions', 'address-editor', 'addresses', 'coins', 'login', 'pabili', 'stores', 'rides'].includes(currentView);

  const hideNavPaths = ['/login', '/rides', '/address-editor']; // Added rides and address-editor
  const showBottomNav = !hideNavPaths.includes(location.pathname);

  // Debug logs for render
  console.log(`[App] Render. Path: ${location.pathname}, Loading: ${loading}, Auth: ${isAuthenticated}`);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div></div>;
  }

  const handleAddToCart = (item) => {
    setCart([...cart, item]);
    console.log("Added to cart:", item);
  };

  return (
    <div className={`min-h-screen bg-gray-50 text-gray-800 ${showBottomNav ? 'pb-20' : ''} md:max-w-md md:mx-auto md:shadow-xl relative overflow-hidden font-sans`}>

      {/* --- HEADER --- */}
      {showMainHeader && (
        <div className="hero-gradient text-white p-5 rounded-b-[2.5rem] shadow-xl sticky top-0 z-40 transition-all duration-300">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              {currentView !== 'home' ? (
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-95">
                  <ChevronLeft size={24} />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-inner">
                    <ShoppingBag size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-extrabold tracking-tight leading-none">Hungr</h1>
                    <p className="text-[10px] text-orange-100 font-medium opacity-80 uppercase tracking-widest mt-0.5">Everything Delivered</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <CoinDisplay onClick={() => navigate('/coins')} />
                <button onClick={() => user ? navigate('/profile') : navigate('/login')}
                  className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center font-bold text-sm border border-white/30 shadow-lg transition-transform active:scale-90 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {user ? user.username[0].toUpperCase() : <User size={20} />}
                </button>
              </div>
            </div>

            {currentView === 'home' && (
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors" size={18} />
                <input
                  type="text" placeholder="What are you craving today?"
                  className="w-full h-12 pl-12 pr-4 rounded-2xl text-gray-800 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-white/30 transition-all shadow-lg bg-white"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MAIN ROUTES --- */}
      <div className="p-0"> {/* Removed padding to allow full-width headers in components */}
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <div className="p-4">
              <HomeView
                user={user}
                setView={handleSetView}
                restaurants={restaurants}
                setActiveRestaurant={() => { }}
                loading={loading}
              />
            </div>
          } />

          <Route path="/pabili" element={<PabiliView setView={handleSetView} />} />
          <Route path="/pabili/store/:id" element={<PabiliView setView={handleSetView} />} />

          <Route path="/cart" element={<CartView cart={cart} setCart={setCart} setView={handleSetView} />} />

          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfileView user={user} setView={handleSetView} />
            </ProtectedRoute>
          } />

          <Route path="/food" element={
            <FoodView
              setView={handleSetView}
              restaurants={restaurants}
              setActiveRestaurant={() => { }}
            />
          } />

          <Route path="/restaurant/:id" element={<RestaurantView addToCart={handleAddToCart} />} />

          <Route path="/wallet" element={<ProtectedRoute><div className="p-4">{console.log("[App] Rendering Wallet Route")}<WalletView /></div></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><div className="p-4"><TransactionsView /></div></ProtectedRoute>} />

          <Route path="/rides" element={<RidesView setView={handleSetView} />} />
          <Route path="/stores" element={
            <StoresView
              setView={handleSetView}
              addToCart={handleAddToCart}
            />
          } />
          <Route path="/stores/:id" element={
            <StoreDetailView addToCart={handleAddToCart} />
          } />

          <Route path="/coins" element={<ProtectedRoute><CoinsView setView={handleSetView} /></ProtectedRoute>} />
          <Route path="/addresses" element={<ProtectedRoute><SavedAddresses setView={handleSetView} /></ProtectedRoute>} />
          <Route path="/address-editor" element={<ProtectedRoute><AddressEditor setView={handleSetView} /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* --- BOTTOM NAVIGATION --- */}
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 w-full z-50 md:max-w-md md:left-auto">
          <BottomNav
            view={currentView}
            setView={handleSetView}
            cartCount={cart.length}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

