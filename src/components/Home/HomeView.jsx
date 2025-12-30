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
            gradient: gradients[idx % gradients.length],
            is_premium: true
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
      <div className="grid grid-cols-4 gap-4 mb-8 px-1">
        {[
          { label: 'Food', emoji: '🍔', bg: 'bg-red-500/10', borderColor: 'border-red-500/20' },
          { label: 'Pabili', emoji: '🛒', bg: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
          { label: 'Stores', emoji: '🏪', bg: 'bg-green-500/10', borderColor: 'border-green-500/20' },
          { label: 'Ride', emoji: '🚗', bg: 'bg-amber-500/10', borderColor: 'border-amber-500/20' }
        ].map((cat) => (
          <button
            key={cat.label}
            onClick={() => handleCategoryClick(cat.label)}
            className="flex flex-col items-center gap-2 group transition-all active:scale-95"
          >
            <div className={`w-16 h-16 ${cat.bg} backdrop-blur-xl rounded-[2rem] flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)] transition-all border ${cat.borderColor} relative overflow-hidden`}>
              {/* Subtle inner gloss effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50"></div>
              <span className="text-3xl transform group-hover:scale-125 transition-all duration-300 drop-shadow-sm z-10">{cat.emoji}</span>
            </div>
            <span className="text-[12px] font-black text-gray-800 tracking-tight uppercase">{cat.label}</span>
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
              className="min-w-full relative cursor-pointer group h-[180px] overflow-hidden"
              onClick={() => {
                if (banner.restaurantId) {
                  navigate(`/restaurant/${banner.restaurantId}`);
                }
              }}
            >
              {/* Image Background */}
              <img
                src={banner.image}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />

              {/* Enhanced Gradient Overlay for readability while revealing brand */}
              <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient.split(' ')[0]} via-transparent to-transparent opacity-90`}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>

              <div className="relative h-full p-6 text-white flex items-center justify-between gap-4">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="bg-white/20 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1 rounded-full w-fit mb-3 flex items-center gap-1 uppercase tracking-widest border border-white/20">
                    <TrendingUp size={10} /> {banner.is_premium ? 'Premium Partner' : 'Special Offer'}
                  </div>
                  <h3 className="text-2xl font-black leading-tight mb-1 drop-shadow-lg tracking-tight">
                    {banner.title}
                  </h3>
                  <p className="text-[11px] font-bold text-white/90 mb-4 line-clamp-1 drop-shadow-md">{banner.description}</p>
                  <button className="bg-white text-gray-900 text-[11px] font-black py-2 px-6 rounded-2xl w-fit hover:scale-105 transition-all shadow-xl active:scale-95">
                    {banner.cta || 'Order Now'}
                  </button>
                </div>

                {/* Optional floating logo for brand reinforcement - now with transparent bg for better integration */}
                {banner.is_premium && (
                  <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-[2rem] p-3 shadow-2xl flex items-center justify-center overflow-hidden border border-white/30 transform group-hover:rotate-6 transition-transform duration-500">
                    <img
                      src={banner.image}
                      alt={banner.title}
                      className="w-full h-full object-contain filter drop-shadow-md"
                    />
                  </div>
                )}
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
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBanner(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentBanner
                ? 'bg-white w-6 shadow-sm'
                : 'bg-white/40 w-1.5 hover:bg-white/60'
                }`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-xl text-gray-900 tracking-tight">Featured Restaurants</h2>
        <button onClick={() => navigate('/food')} className="text-orange-600 font-bold text-xs hover:underline">View All</button>
      </div>

      {/* Restaurant List */}
      <div className="grid grid-cols-2 gap-4 pb-24 px-1">
        {loading ? (
          <div className="col-span-2 flex justify-center py-12">
            <div className="relative">
              <div className="w-10 h-10 border-4 border-orange-100 rounded-full"></div>
              <div className="w-10 h-10 border-4 border-orange-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
          </div>
        ) : (
          restaurants.map(r => (
            <div
              key={r.id}
              className="group bg-white rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer border border-slate-100 active:scale-[0.98] flex flex-col"
              onClick={() => {
                if (setActiveRestaurant) setActiveRestaurant(r);
                navigate(`/restaurant/${r.id}`);
              }}
            >
              <div className="h-32 bg-gray-100 relative overflow-hidden">
                <img
                  src={r.image_url || "/api/placeholder/400/200"}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  alt={r.name}
                />
                <div className="absolute top-2.5 left-2.5">
                  <div className="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-black shadow-sm flex items-center gap-1 text-orange-600 border border-orange-100 uppercase tracking-tighter">
                    <Clock size={10} /> {r.delivery_time_min}m
                  </div>
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <div className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black shadow-lg flex items-center gap-0.5 border border-emerald-400">
                    <Star size={8} fill="white" /> {r.rating}
                  </div>
                </div>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm text-gray-900 line-clamp-1 leading-tight mb-1">{r.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{r.cuisine_type}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Free Delivery</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeView;

