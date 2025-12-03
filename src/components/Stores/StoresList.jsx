// FILE: src/components/Stores/StoresList.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Star, MapPin, Clock } from 'lucide-react';
import { API_ENDPOINTS, handleApiResponse, handleApiError, logApiCall } from '../../config/api';

export default function StoresList({ setView, categoryId, onSelectStore }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (categoryId) {
      fetchStores();
    }
  }, [categoryId]);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);

    try {
      logApiCall('GET', API_ENDPOINTS.STORES_BY_CATEGORY(categoryId));
      
      const response = await fetch(API_ENDPOINTS.STORES_BY_CATEGORY(categoryId));
      const data = await handleApiResponse(response);

      if (data.success) {
        setStores(data.data.stores || []);
      } else {
        throw new Error(data.error || 'Failed to fetch stores');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-500 text-center">Loading stores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-20 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center mb-6">
        <button
          onClick={() => setView('stores')}
          className="mr-3 p-2 rounded-full hover:bg-gray-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">Stores</h1>
      </div>

      <div className="space-y-4">
        {stores.map((store) => (
          <div
            key={store.id}
            onClick={() => onSelectStore(store.id)}
            className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border border-gray-100">
            <div className="flex items-center gap-4">
              <img
                src={store.image_url}
                alt={store.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{store.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <Star size={14} className="text-yellow-400 fill-current" />
                  <span>{store.rating}</span>
                  <span>•</span>
                  <MapPin size={14} />
                  <span>{store.distance || '1.2 km'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <Clock size={14} />
                  <span>{store.delivery_time || '30-45 min'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
