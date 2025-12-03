import React, { useState, useEffect } from 'react';
import { 
  Search, ShoppingBag, Store, User, Bike, 
  Wallet, List, AlertCircle, Database, X, ChevronLeft
} from 'lucide-react';

// --- IMPORTS ---
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProfileView from './components/Profile/ProfileView';
import SavedAddresses from './components/Address/SavedAddresses';
import RidesView from './components/Rides/RidesView';
import StoresView from './components/Stores/StoresView';
import PabiliView from './components/Pabili/PabiliView';
import FoodView from './components/Food/FoodView'; // NEW IMPORT
import BottomNav from './components/Navigation/BottomNav';
import CoinDisplay from './components/Coin/CoinDisplay';
import AuthModal from './components/Auth/AuthModal';
import HomeView from './components/Home/HomeView';
import RestaurantView from './components/Restaurant/RestaurantView';
import CartView from './components/Cart/CartView';

// --- CONFIG ---
const API_URL = '/api';

// --- MAIN APP CONTENT ---

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  
  // App State
  const [view, setView] = useState('home');
  const [restaurants, setRestaurants] = useState([]);
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
        setIsUsingDemoData(false);
      } else {
        throw new Error("Empty list");
      }
    } catch (err) {
      console.warn("Using demo data");
      setIsUsingDemoData(true);
      setRestaurants([
        { id: 1, name: "Jollibee", cuisine_type: "Fast Food", rating: 4.9, delivery_time_min: 20, delivery_time_max: 35, image_url: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400" },
        { id: 2, name: "McDonald's", cuisine_type: "Fast Food", rating: 4.8, delivery_time_min: 15, delivery_time_max: 30, image_url: "https://images.unsplash.com/photo-1552590635-27c2c2128abf?auto=format&fit=crop&q=80&w=400" },
        { id: 3, name: "Chowking", cuisine_type: "Chinese", rating: 4.6, delivery_time_min: 25, delivery_time_max: 40, image_url: "https://images.unsplash.com/photo-1563245372-f21720e32c4d?auto=format&fit=crop&q=80&w=400" },
        { id: 4, name: "Mang Inasal", cuisine_type: "Filipino", rating: 4.7, delivery_time_min: 30, delivery_time_max: 45, image_url: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=400" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const ErrorBanner = ({ message }) => (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
      <AlertCircle size={18} />
      <span className="text-sm">{message}</span>
      <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
    </div>
  );

  // Determine when to show the main Orange Header
  // We hide it for: restaurant details, cart, AND the new FoodView (since it has its own search bar header)
  const showMainHeader = view !== 'restaurant' && view !== 'cart' && view !== 'food';

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:max-w-md md:mx-auto md:shadow-xl relative overflow-hidden">
      
      {/* HEADER */}
      {showMainHeader && (
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
          {(view === 'pabili' || view === 'rides' || view === 'stores') && (
            <div className="mt-4 animate-in fade-in">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {view === 'pabili' ? <ShoppingBag className="text-orange-200" /> : 
                 view === 'rides' ? <Bike className="text-orange-200" /> :
                 <Store className="text-orange-200" />}
                {view === 'pabili' ? 'Pabili' : view === 'rides' ? 'Rides' : 'Stores'}
              </h1>
              <p className="text-orange-100 text-sm opacity-90">
                {view === 'pabili' ? 'Purchase custom items' : 
                 view === 'rides' ? 'Where are you going?' :
                 view === 'stores' ? 'Shop by category' :
                 'Tracking your order'}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Data Source Indicator */}
        {view === 'home' && (
            <div className={`mb-3 text-xs font-bold px-2 py-1 rounded w-fit flex items-center gap-1 ${isUsingDemoData ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                {isUsingDemoData ? <><AlertCircle size={12}/> Demo Mode</> : <><Database size={12}/> Live Data</>}
            </div>
        )}

        {error && <ErrorBanner message={error} />}

        {/* HOME VIEW */}
        {view === 'home' && (
          <HomeView 
            restaurants={restaurants} 
            loading={loading} 
            setView={setView} 
            setActiveRestaurant={setActiveRestaurant} 
          />
        )}

        {/* NEW FOOD VIEW */}
        {view === 'food' && (
          <FoodView 
            restaurants={restaurants} 
            setView={setView} 
            setActiveRestaurant={setActiveRestaurant}
          />
        )}

        {/* RESTAURANT DETAIL VIEW */}
        {view === 'restaurant' && activeRestaurant && (
            <RestaurantView 
                restaurant={activeRestaurant} 
                setView={setView} 
                addToCart={(item) => setCart([...cart, item])}
            />
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
            <CartView cart={cart} setCart={setCart} setView={setView} />
        )}

        {/* Placeholder Views */}
        {view === 'wallet' && <div className="text-center p-10"><Wallet size={48} className="mx-auto text-gray-300 mb-2"/>Wallet Feature</div>}
        {view === 'transactions' && <div className="text-center p-10"><List size={48} className="mx-auto text-gray-300 mb-2"/>Transactions</div>}
        
        {/* Modular Views */}
        {view === 'profile' && <ProfileView setView={setView} />}
        {view === 'addresses' && <SavedAddresses setView={setView} />}
        {view === 'rides' && <RidesView setView={setView} />}
        {view === 'stores' && <StoresView setView={setView} addToCart={(item, store) => alert(`Added ${item.name}`)} />}
        {view === 'pabili' && <PabiliView setView={setView} />}

      </div>
      
      {/* Modals & Nav */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      {/* Hide Bottom Nav on Restaurant Detail & Cart View */}
      {view !== 'pabili' && view !== 'rides' && view !== 'stores' && view !== 'restaurant' && view !== 'cart' && view !== 'food' && (
        <BottomNav view={view} setView={setView} cartCount={cart.length} />
      )}
      
      {/* Show Bottom Nav on Food View (Often consistent with apps like Grab) */}
      {view === 'food' && (
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
