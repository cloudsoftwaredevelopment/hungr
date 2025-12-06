import { Loader, Clock, Star, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HomeView = ({ restaurants, loading, setView, setActiveRestaurant }) => {
  const navigate = useNavigate();

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

      {/* Full Width Advertisement Card */}
      <div className="mb-8 relative rounded-2xl overflow-hidden shadow-md cursor-pointer hover:shadow-lg transition group">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 opacity-90"></div>
        <img
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800"
          alt="Ad"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50 group-hover:scale-105 transition duration-500"
        />
        <div className="relative p-5 text-white flex flex-col justify-center min-h-[140px]">
          <div className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2 flex items-center gap-1">
            <TrendingUp size={10} /> SPONSORED
          </div>
          <h3 className="text-2xl font-extrabold leading-tight mb-1">
            Get 50% OFF <br />on Bistro Group!
          </h3>
          <p className="text-xs text-orange-100 mb-3 opacity-90">Valid until Dec 31 • Min. spend ₱500</p>
          <button className="bg-white text-orange-600 text-xs font-bold py-2 px-4 rounded-full w-fit hover:bg-orange-50 transition shadow-sm">
            Order Now
          </button>
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
