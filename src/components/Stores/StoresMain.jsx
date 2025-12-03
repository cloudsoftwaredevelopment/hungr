import React from 'react';
import { Star, Clock, MapPin, Loader } from 'lucide-react';

export default function StoresMain({ 
  setView, 
  setSelectedStoreId,
  storeCategories,
  filteredStores,
  selectedStoreFilter,
  setSelectedStoreFilter,
  storesLoading,
  storesError
}) {
  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold mb-6">All Stores</h2>
      
      {/* Error Banner */}
      {storesError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <div className="text-red-600 text-sm font-medium">{storesError}</div>
        </div>
      )}
      
      {/* Category Filter Buttons - Horizontal Scroll */}
      <div className="flex overflow-x-auto pb-3 mb-6 scrollbar-hide gap-2">
        {/* All Stores Button */}
        <button
          onClick={() => setSelectedStoreFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm transition whitespace-nowrap ${
            selectedStoreFilter === 'all'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Stores
        </button>
        
        {/* Category Buttons */}
        {storeCategories && storeCategories.length > 0 ? (
          storeCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedStoreFilter(category.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm transition whitespace-nowrap ${
                selectedStoreFilter === category.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))
        ) : (
          /* Loading skeleton for filter buttons */
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex-shrink-0 bg-gray-200 rounded-full h-8 w-24 animate-pulse"></div>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {storesLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader size={40} className="text-orange-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading stores...</p>
        </div>
      )}

      {/* Empty State - No Stores Match Filter */}
      {!storesLoading && filteredStores && filteredStores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-5xl mb-3">🏪</div>
          <p className="text-gray-600 font-medium">No stores found</p>
          <p className="text-gray-400 text-sm mt-1">Try selecting a different category</p>
        </div>
      )}

      {/* Stores Grid */}
      {!storesLoading && filteredStores && filteredStores.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              onClick={() => {
                setSelectedStoreId(store.id);
                setView('store-detail');
              }}
              className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98] border border-gray-100"
            >
              {/* Store Image */}
              <div className="relative">
                <img 
                  src={store.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400'} 
                  alt={store.name} 
                  className="w-full h-32 object-cover bg-gray-200"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400';
                  }}
                />
                {/* Delivery Time Badge */}
                <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded-lg text-xs font-bold shadow flex items-center gap-1">
                  <Clock size={12} className="text-orange-500" /> 
                  {store.delivery_time || '30-45 min'}
                </div>
              </div>
              
              {/* Store Info */}
              <div className="p-3">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className="font-bold text-gray-900 leading-tight text-sm line-clamp-1 flex-1">{store.name}</h3>
                  <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded text-green-700 font-bold text-xs whitespace-nowrap flex-shrink-0">
                    <Star size={10} fill="currentColor" /> {store.rating || '4.5'}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{store.category_name || 'Store'}</p>
                
                <div className="flex items-center text-xs text-gray-500 gap-1">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span>{store.distance || '1.2 km'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
