// FILE: src/components/Stores/StoresCategories.jsx
import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS, handleApiResponse, handleApiError, logApiCall } from '../../config/api';

export default function StoresCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);

    try {
      logApiCall('GET', API_ENDPOINTS.STORES_CATEGORIES);

      const response = await fetch(API_ENDPOINTS.STORES_CATEGORIES);
      const data = await handleApiResponse(response);

      if (data.success) {
        setCategories(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch categories');
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🔄</div>
      <p className="text-gray-500">Loading store categories...</p>
    </div>
  );
  }

  return (
    <div className="pb-20">
      <h1 className="text-2xl font-bold mb-6">Store Categories</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {categories.map((category) => (
          <div
            key={category.id}
            onClick={() => window.location.href = `/stores/category/${category.id}`)}
        >
          <div className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border border-gray-100">
            <div className="text-3xl mb-2">{category.icon_url || '🏪'}</div>
            <h3 className="font-semibold text-sm text-center line-clamp-2">{category.name}</h3>
            <p className="text-xs text-gray-500 text-center">
              {category.store_count || 0} stores
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
