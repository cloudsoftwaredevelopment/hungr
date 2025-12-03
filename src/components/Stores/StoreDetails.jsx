import React, { useState, useEffect } from 'react';
import { Star, Clock, MapPin, Phone, ChevronLeft, Loader, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS, handleApiResponse, handleApiError, logApiCall } from '../../config/api';

export default function StoreDetails({ 
  storeId,
  allStores,
  setView,
  setSelectedStoreId
}) {
  const [storeData, setStoreData] = useState(null);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch store details and products
  useEffect(() => {
    const fetchStoreDetails = async () => {
      if (!storeId) {
        setError('No store selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        logApiCall('GET', API_ENDPOINTS.STORE_DETAILS(storeId));

        const response = await fetch(API_ENDPOINTS.STORE_DETAILS(storeId));
        const data = await handleApiResponse(response);

        if (data.success) {
          setStoreData(data.data?.store || null);
          setProducts(data.data?.products || {});
          console.log('Store details loaded:', data.data?.store?.name);
        } else {
          throw new Error(data.error || 'Failed to fetch store details');
        }
      } catch (err) {
        const errorMsg = handleApiError(err);
        setError(errorMsg);
        console.error('Failed to fetch store details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreDetails();
  }, [storeId]);

  // Handle back button
  const handleBack = () => {
    setSelectedStoreId(null);
    setView('stores');
  };

  // Loading State
  if (loading) {
    return (
      <div className="pb-20">
        <button 
          onClick={handleBack}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ChevronLeft size={16} /> Back
        </button>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Loader size={40} className="text-orange-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading store...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !storeData) {
    return (
      <div className="pb-20">
        <button 
          onClick={handleBack}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
        >
          <ChevronLeft size={16} /> Back
        </button>
        
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle size={40} className="text-red-600 mb-4" />
          <p className="text-gray-600 font-medium text-center">{error || 'Store not found'}</p>
          <button 
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm"
          >
            Back to Stores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Back Button */}
      <button 
        onClick={handleBack}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600 transition"
      >
        <ChevronLeft size={16} /> Back to Stores
      </button>

      {/* Store Header with Image */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6 border border-gray-100">
        {/* Store Image */}
        <div className="relative w-full h-40 bg-gray-200 overflow-hidden">
          <img 
            src={storeData.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400'} 
            alt={storeData.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400';
            }}
          />
        </div>

        {/* Store Info */}
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{storeData.name}</h1>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg text-green-700 font-bold">
              <Star size={14} fill="currentColor" /> {storeData.rating || '4.5'}
            </div>
          </div>

          {storeData.description && (
            <p className="text-sm text-gray-600 mb-4">{storeData.description}</p>
          )}

          {/* Store Details Grid */}
          <div className="space-y-3 text-sm">
            {/* Address */}
            {storeData.address && (
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-700">Location</p>
                  <p className="text-gray-500">{storeData.address}</p>
                </div>
              </div>
            )}

            {/* Phone */}
            {storeData.phone && (
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-700">Phone</p>
                  <p className="text-gray-500">{storeData.phone}</p>
                </div>
              </div>
            )}

            {/* Delivery Info */}
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-700">Delivery Time</p>
                <p className="text-gray-500">{storeData.delivery_time || '30-45 minutes'}</p>
              </div>
            </div>

            {/* Delivery Fee */}
            {storeData.delivery_fee !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-bold">₱</span>
                <div>
                  <p className="font-medium text-gray-700">Delivery Fee</p>
                  <p className="text-gray-500">₱{storeData.delivery_fee || 'FREE'}</p>
                </div>
              </div>
            )}

            {/* Min Order */}
            {storeData.min_order && (
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-bold">₱</span>
                <div>
                  <p className="font-medium text-gray-700">Minimum Order</p>
                  <p className="text-gray-500">₱{storeData.min_order}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Products Section */}
      <h2 className="text-lg font-bold mb-4">Products</h2>

      {Object.keys(products).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(products).map(([categoryName, categoryProducts]) => (
            <div key={categoryName}>
              <h3 className="font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                {categoryName}
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {categoryProducts.map((product) => (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition"
                  >
                    {/* Product Image */}
                    {product.image_url && (
                      <div className="w-full h-24 bg-gray-200 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Product Info */}
                    <div className="p-2">
                      <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">{product.name}</h4>
                      
                      {product.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{product.description}</p>
                      )}

                      {product.brand && (
                        <p className="text-xs text-gray-400 mt-0.5">Brand: {product.brand}</p>
                      )}

                      {product.size && (
                        <p className="text-xs text-gray-400">Size: {product.size}</p>
                      )}

                      {/* Price and Stock */}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                        <span className="font-bold text-orange-600 text-sm">
                          ₱{parseFloat(product.price || 0).toFixed(2)}
                        </span>
                        <span className={`text-xs font-medium ${
                          product.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {product.stock_quantity > 0 ? `${product.stock_quantity} left` : 'Out of stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-gray-500 font-medium">No products available</p>
        </div>
      )}
    </div>
  );
}
