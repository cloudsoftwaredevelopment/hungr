import React, { useState } from 'react';
import { Search, MapPin, Star, Clock, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FoodView({ restaurants = [], setActiveRestaurant }) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    const categories = ['All', 'Fast Food', 'Filipino', 'Chinese', 'Japanese', 'Healthy', 'Dessert', 'Chicken', 'Beverages'];

    // Filter logic
    const filteredRestaurants = restaurants.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.cuisine_type && r.cuisine_type.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = activeCategory === 'All' || r.cuisine_type === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="pb-32 font-sans bg-slate-50 min-h-screen">

            {/* --- HEADER --- */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-6 pb-4 border-b border-slate-100 shadow-sm flex flex-col gap-5">

                {/* Navigation and Title */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95"
                    >
                        <ChevronLeft size={24} strokeWidth={3} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                            Hungr <span className="text-orange-600 italic">Food</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pick your craving</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none z-10">
                        <div className="w-11 h-11 flex items-center justify-center">
                            <Search className="text-slate-400 group-focus-within:text-orange-600 transition-colors" size={20} strokeWidth={2.5} />
                        </div>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 text-gray-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-black focus:outline-none focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all placeholder:text-slate-400 border-none shadow-inner"
                        placeholder="Search for restaurants or dishes..."
                    />
                </div>

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-5 px-5">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 backdrop-blur-md border ${activeCategory === cat
                                ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/30'
                                : 'bg-slate-500/5 text-slate-500 border-slate-200/50 hover:bg-slate-500/10 hover:border-orange-200 shadow-sm'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- RESTAURANT LIST --- */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                        {searchQuery ? 'Search Results' : 'Popular Near You'}
                    </h2>
                </div>

                {filteredRestaurants.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 pb-20">
                        {filteredRestaurants.map((restaurant) => {
                            const isClosed = restaurant.is_available === 0 || restaurant.is_available === false;
                            return (
                                <div
                                    key={restaurant.id}
                                    onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                                    className={`bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-50 group cursor-pointer active:scale-[0.98] transition-all duration-300 hover:shadow-xl ${isClosed ? 'opacity-60' : ''}`}
                                >
                                    {/* Image */}
                                    <div className="h-32 bg-slate-100 relative overflow-hidden">
                                        <img
                                            src={restaurant.image_url}
                                            alt={restaurant.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWRlZGVkIi8+PC9zdmc+'}
                                        />
                                        {/* Rating Badge */}
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl text-[10px] font-black shadow-lg flex items-center gap-1 border border-white/50">
                                            <Star size={10} className="text-orange-500 fill-orange-500" /> {restaurant.rating}
                                        </div>
                                        {/* CLOSED Badge */}
                                        {isClosed && (
                                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                                                <span className="bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-xl shadow-2xl uppercase tracking-widest border border-red-500/50">
                                                    CLOSED
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="font-black text-gray-900 text-sm leading-tight line-clamp-1 tracking-tight group-hover:text-orange-600 transition-colors uppercase">{restaurant.name}</h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{restaurant.cuisine_type}</span>
                                            <span className="text-slate-200">•</span>
                                            <div className="flex items-center gap-1 text-orange-600">
                                                <Clock size={10} strokeWidth={3} />
                                                <span className="text-[10px] font-black italic">{restaurant.delivery_time_min}m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        No restaurants found.
                    </div>
                )}
            </div>
        </div>
    );
}
