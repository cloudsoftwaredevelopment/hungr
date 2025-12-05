import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Store, User, Bike, AlertCircle, Database, ChevronLeft } from 'lucide-react';

// --- IMPORTS ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login'; 
import HomeView from './components/Home/HomeView';
import Pabili from './components/Pabili/Pabili';
import CartView from './components/Cart/CartView';
import ProfileView from './components/Profile/ProfileView';
import SavedAddresses from './components/Address/SavedAddresses';
import AddressEditor from './components/Address/AddressEditor';
import RidesView from './components/Rides/RidesView';
import StoresView from './components/Stores/StoresView';
import FoodView from './components/Food/FoodView';
import BottomNav from './components/Navigation/BottomNav';
import WalletView from './components/Wallet/WalletView';
import TransactionsView from './components/Transactions/TransactionsView';
import CoinsView from './components/Coin/CoinsView';
import CoinDisplay from './components/Coin/CoinDisplay';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cart, setCart] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://nfcrevolution.com/hungr/api/restaurants');
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
    switch(viewName) {
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
    return 'home';
  };

  const currentView = getCurrentView();
  
  // UPDATED: Added 'pabili', 'stores', 'rides' to the exclusion list so they don't show the orange header
  const showMainHeader = !['cart', 'food', 'wallet', 'transactions', 'address-editor', 'addresses', 'coins', 'login', 'pabili', 'stores', 'rides'].includes(currentView);
  
  const hideNavPaths = ['/login'];
  const showBottomNav = !hideNavPaths.includes(location.pathname);

  const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    return children;
  };

  const handleAddToCart = (item) => {
    setCart([...cart, item]);
    console.log("Added to cart:", item);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 md:max-w-md md:mx-auto md:shadow-xl relative overflow-hidden font-sans">
      
      {/* --- HEADER --- */}
      {showMainHeader && (
        <div className="bg-orange-600 text-white p-4 rounded-b-3xl shadow-lg sticky top-0 z-40">
          <div className="flex items-center justify-between gap-3">
            {currentView !== 'home' ? (
              <button onClick={() => navigate('/')} className="p-1 hover:bg-white/20 rounded-full transition">
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
              <CoinDisplay onClick={() => navigate('/coins')} />
              <button onClick={() => user ? navigate('/profile') : navigate('/login')} 
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-xs border border-white/30">
                {user ? user.username[0].toUpperCase() : <User size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN ROUTES --- */}
      <div className="p-0"> {/* Removed padding to allow full-width headers in components */}
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <div className="p-4">
                <HomeView 
                  user={user} 
                  setView={handleSetView}
                  restaurants={restaurants} 
                  loading={loading}
                />
              </div>
            </ProtectedRoute>
          } />
          
          <Route path="/pabili" element={<ProtectedRoute><Pabili /></ProtectedRoute>} />
          <Route path="/pabili/store/:id" element={<ProtectedRoute><Pabili /></ProtectedRoute>} />
          
          <Route path="/cart" element={
            <ProtectedRoute>
              <div className="p-4"><CartView cart={cart} setCart={setCart} setView={handleSetView} /></div>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <div className="p-4"><ProfileView user={user} setView={handleSetView} /></div>
            </ProtectedRoute>
          } />

          <Route path="/food" element={
            <ProtectedRoute>
               <FoodView 
                 setView={handleSetView} 
                 restaurants={restaurants} 
                 setActiveRestaurant={() => {}} 
              />
            </ProtectedRoute>
          } />

          <Route path="/wallet" element={<ProtectedRoute><div className="p-4"><WalletView /></div></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><div className="p-4"><TransactionsView /></div></ProtectedRoute>} />
          
          <Route path="/rides" element={<ProtectedRoute><RidesView setView={handleSetView} /></ProtectedRoute>} />
          <Route path="/stores" element={
            <ProtectedRoute>
              <StoresView 
                setView={handleSetView} 
                addToCart={handleAddToCart} 
              />
            </ProtectedRoute>
          } />
          
          <Route path="/coins" element={<ProtectedRoute><div className="p-4"><CoinsView setView={handleSetView} /></div></ProtectedRoute>} />
          <Route path="/addresses" element={<ProtectedRoute><div className="p-4"><SavedAddresses setView={handleSetView} /></div></ProtectedRoute>} />
          <Route path="/address-editor" element={<ProtectedRoute><div className="p-4"><AddressEditor setView={handleSetView} /></div></ProtectedRoute>} />

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
      <AppContent />
    </AuthProvider>
  );
}
