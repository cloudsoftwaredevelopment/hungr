// FILE: src/components/Stores/StoreDetailView.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, fetchWithAuth } from '../../config/api';

const StoreDetailView = () => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { storeId } = useParams();
  const navigate = useNavigate();

  // Get token from session storage
  const getToken = () => sessionStorage.getItem('accessToken');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch store details
        const storeResponse = await fetchWithAuth(
          API_ENDPOINTS.STORE_DETAILS(storeId),
          { method: 'GET' },
          getToken()
        );
        console.log('Store detail response:', storeResponse);
        setStore(storeResponse.data.store);
        setProducts(storeResponse.data.products || {});
        
      } catch (err) {
        console.error('Error fetching store data:', err);
        setError('Failed to load store data');
      } finally {
        setLoading(false);
      }
    };

    if (storeId) {
      fetchData();
    }
  }, [storeId]);

  if (loading) {
    return <div className="p-4">Loading store details...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!store) {
    return <div className="p-4">Store not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <button 
        onClick={() => navigate('/stores')}
        className="mb-4 text-blue-500 hover:underline flex items-center"
      >
        ← Back to Categories
      </button>
      
      {/* Store Banner/Header */}
      {store.banner_url && (
        <div className="relative h-48 rounded-lg overflow-hidden mb-4">
          <img 
            src={store.banner_url} 
            alt={store.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end">
            <div className="p-4 text-white">
              <h1 className="text-2xl font-bold">{store.name}</h1>
              {store.description && (
                <p className="text-sm">{store.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Store Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {!store.banner_url && (
          <h1 className="text-2xl font-bold mb-2">{store.name}</h1>
        )}
        {store.description && !store.banner_url && (
          <p className="text-gray-600 mb-4">{store.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {store.address && (
            <div>
              <strong>Address:</strong> {store.address}
            </div>
          )}
          {store.phone && (
            <div>
              <strong>Phone:</strong> {store.phone}
            </div>
          )}
          {store.rating && (
            <div>
              <strong>Rating:</strong> 
              <span className="text-yellow-600 ml-1">★ {store.rating}</span>
            </div>
          )}
          {store.delivery_time && (
            <div>
              <strong>Delivery Time:</strong> {store.delivery_time}
            </div>
          )}
          {store.delivery_fee && (
            <div>
              <strong>Delivery Fee:</strong> ₱{store.delivery_fee}
            </div>
          )}
          {store.min_order && (
            <div>
              <strong>Minimum Order:</strong> ₱{store.min_order}
            </div>
          )}
        </div>
      </div>

      {/* Products Section */}
      <h2 className="text-xl font-semibold mb-4">Products</h2>
      
      {Object.keys(products).length > 0 ? (
        <div>
          {Object.entries(products).map(([categoryName, categoryProducts]) => (
            <div key={categoryName} className="mb-8">
              <h3 className="text-lg font-medium mb-3 border-b pb-1">{categoryName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryProducts.map((product) => (
                  <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    {product.image_url && (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-32 object-cover rounded mb-3"
                      />
                    )}
                    <h4 className="font-semibold">{product.name}</h4>
                    {product.description && (
                      <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    )}
                    {product.brand && (
                      <p className="text-gray-500 text-xs mt-1">Brand: {product.brand}</p>
                    )}
                    {product.size && (
                      <p className="text-gray-500 text-xs">Size: {product.size}</p>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                      <span className="font-bold text-green-600">
                        ₱{parseFloat(product.price).toFixed(2)}
                      </span>
                      {product.stock_quantity > 0 ? (
                        <span className="text-xs text-green-600">
                          {product.stock_quantity} in stock
                        </span>
                      ) : (
                        <span className="text-xs text-red-600">Out of stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No products available
        </div>
      )}
    </div>
  );
};

export default StoreDetailView;
