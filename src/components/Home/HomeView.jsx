import { useState, useEffect } from 'react';
import { Loader, Clock, Star, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../../config/socket';
import ActiveOrderCard from './ActiveOrderCard';

const HomeView = ({ user, restaurants, loading, setView, setActiveRestaurant }) => {
  const navigate = useNavigate();
  const [activeOrder, setActiveOrder] = useState(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [premiumBanners, setPremiumBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);

  // Default banners (fallback when no premium restaurants)
  const defaultBanners = [
    {
      id: 1,
      title: 'Get 50% OFF',
      subtitle: 'on Bistro Group!',
      description: 'Valid until Dec 31 • Min. spend ₱500',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
      gradient: 'from-orange-600 to-red-600',
      cta: 'Order Now'
    },
    {
      id: 2,
      title: 'Free Delivery',
      subtitle: 'on your first order!',
      description: 'New users only • No min. spend',
      image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800',
      gradient: 'from-green-600 to-teal-600',
      cta: 'Claim Now'
    },
    {
      id: 3,
      title: '₱100 Cashback',
      subtitle: 'when you pay with Maya',
      description: 'Valid until Dec 25 • Limited slots',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800',
      gradient: 'from-purple-600 to-pink-600',
      cta: 'Learn More'
    }
  ];

  // Gradient colors for premium banners
  const gradients = [
    'from-orange-600 to-red-600',
    'from-green-600 to-teal-600',
    'from-purple-600 to-pink-600',
    'from-blue-600 to-indigo-600',
    'from-rose-600 to-orange-600'
  ];

  // Fetch premium restaurants from API
  useEffect(() => {
    const fetchPremiumRestaurants = async () => {
      try {
        const response = await fetch('/api/restaurants/premium');
        const data = await response.json();
        if (data.success && data.data.length > 0) {
          // Add gradient to each premium banner
          const bannersWithGradients = data.data.map((banner, idx) => ({
            ...banner,
            gradient: gradients[idx % gradients.length]
          }));
          setPremiumBanners(bannersWithGradients);
        }
      } catch (err) {
        console.error('Failed to fetch premium restaurants:', err);
      } finally {
        setBannersLoading(false);
      }
    };
    fetchPremiumRestaurants();
  }, []);

  // Fetch active order and listen for updates
  useEffect(() => {
    const fetchActiveOrder = async () => {
      if (!user?.id) return;
      try {
        const token = sessionStorage.getItem('accessToken');
        const response = await fetch('/api/orders/active', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setActiveOrder(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch active order:', err);
      }
    };

    fetchActiveOrder();

    if (user?.id) {
      const eventName = `user_${user.id}_order_update`;
      console.log(`[HomeView] Listening for ${eventName}`);

      socket.on(eventName, (data) => {
        console.log('[HomeView] Order update received:', data);
        if (['delivered', 'cancelled', 'completed'].includes(data.status)) {
          setActiveOrder(null);
        } else {
          setActiveOrder(prev => prev ? { ...prev, status: data.status } : null);
          // If no active order but we got an update, we might need to re-fetch or just ignore 
          // usually it's better to re-fetch to get full details if prev was null
          if (!activeOrder) fetchActiveOrder();
        }
      });

      return () => socket.off(eventName);
    }
  }, [user?.id]);

  // Use premium banners if available, otherwise use defaults
  const banners = premiumBanners.length > 0 ? premiumBanners : defaultBanners;

  // Auto-scroll banners every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleCategoryClick = (category) => {
    if (category === 'Pabili') {
      navigate('/pabili');
    } else if (category === 'Ride') {
      navigate('/rides');
    } else if (category === 'Stores') {
      navigate('/stores');
    } else if (category === 'Food') {
      navigate('/food');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="animate-in fade-in">
      {/* Active Order Progress */}
      {activeOrder && (
        <ActiveOrderCard
          order={activeOrder}
          onClick={() => navigate('/transactions')}
        />
      )}

      {/* Category Grid */}
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

      {/* Auto-Scrolling Banner Carousel */}
      <div className="mb-8 relative overflow-hidden rounded-2xl shadow-md">
        {/* Banner Container with slide animation */}
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentBanner * 100}%)` }}
        >
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="min-w-full relative cursor-pointer group"
              onClick={() => {
                if (banner.restaurantId) {
                  navigate(`/restaurant/${banner.restaurantId}`);
                }
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-90`}></div>
              <img
                src={banner.image}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50 group-hover:scale-105 transition duration-500"
              />
              <div className="relative p-5 text-white flex flex-col justify-center min-h-[140px]">
                <div className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2 flex items-center gap-1">
                  <TrendingUp size={10} /> SPONSORED
                </div>
                <h3 className="text-2xl font-extrabold leading-tight mb-1">
                  {banner.title} <br />{banner.subtitle}
                </h3>
                <p className="text-xs text-white/80 mb-3 opacity-90">{banner.description}</p>
                <button className="bg-white text-orange-600 text-xs font-bold py-2 px-4 rounded-full w-fit hover:bg-orange-50 transition shadow-sm">
                  {banner.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft size={16} className="text-white" />
        </button>
        <button
          onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100"
        >
          <ChevronRight size={16} className="text-white" />
        </button>

        {/* Dot Indicators */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBanner(idx)}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentBanner
                ? 'bg-white w-4'
                : 'bg-white/50 hover:bg-white/70'
                }`}
            />
          ))}
        </div>
      </div>

      <h2 className="font-bold text-lg mb-4 text-gray-800">Featured Restaurants</h2>

      {/* Restaurant List */}
      <div className="grid grid-cols-2 gap-4 pb-20">
        {loading ? (
          <div className="col-span-2 flex justify-center py-10">
            <Loader className="animate-spin text-orange-600" />
          </div>
        ) : (
          restaurants.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98]"
              onClick={() => {
                if (setActiveRestaurant) setActiveRestaurant(r);
                navigate(`/restaurant/${r.id}`);
              }}
            >
              <div className="h-28 bg-gray-200 relative">
                <img src={r.image_url || "/api/placeholder/400/200"} className="w-full h-full object-cover" alt={r.name} />
                <div className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-sm flex items-center gap-0.5 backdrop-blur-sm">
                  <Clock size={10} className="text-orange-600" /> {r.delivery_time_min}-{r.delivery_time_max}m
                </div>
              </div>
              <div className="p-3">
                <div className="flex justify-between items-start gap-1">
                  <h3 className="font-bold text-sm leading-tight text-gray-900 line-clamp-1">{r.name}</h3>
                  <div className="flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded text-green-700 font-bold text-[10px]">
                    <Star size={8} fill="currentColor" /> {r.rating}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{r.cuisine_type} • 1.2km</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeView;

