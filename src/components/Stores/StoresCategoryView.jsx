import React, { useEffect, useState } from 'react';
import { Star, Clock, MapPin, Loader } from 'lucide-react';

export default function StoresCategoryView({ 
  setView, 
  selectedCategoryId,
  setSelectedStoreId,
  fetchStoresByCategory,
  stores,
  storeCategories
}) {
  const [loading, setLoading] = useState(false);

  // Trigger fetch when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      setLoading(true);
      fetchStoresByCategory(selectedCategoryId);
      // Simulate loading - adjust timing based on your API speed
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedCategoryId, fetchStoresByCategory]);

  // Get current category name for display
  const currentCategory = storeCategories.find(cat => cat.id === selectedCategoryId);
  const categoryName = currentCategory?.name || 'Stores';

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold mb-1">{categoryName}</h2>
      <p className="text-sm text-gray-500 mb-6">{stores?.length || 0} stores available</p>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader size={32} className="text-orange-600 animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Loading stores...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && (!stores || stores.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-4xl mb-3">🏪</div>
          <p className="text-gray-500 text-sm">No stores found in this category</p>
        </div>
      )}

      {/* Stores List */}
      {!loading && stores && stores.length > 0 && (
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.id}
              onClick={() => {
                setSelectedStoreId(store.id);
                setView('store-detail');
              }}
              className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition active:scale-[0.98] border border-gray-100"
            >
              <div className="flex items-center gap-4 p-4">
                <img 
                  src={store.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400'} 
                  alt={store.name} 
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 line-clamp-1">{store.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-yellow-400 fill-current flex-shrink-0" />
                      <span className="font-medium">{store.rating || '4.5'}</span>
                    </div>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="flex-shrink-0" />
                      {store.delivery_time || '30 min'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="flex-shrink-0" />
                      {store.distance || '1.2 km'}
                    </span>
                  </div>
                  {store.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{store.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {store.is_premium && (
                    <div className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full mb-1">
                      Premium
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
