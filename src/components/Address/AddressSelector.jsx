// ========================================
// FILE 3: src/components/Address/AddressSelector.jsx
// ========================================

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, X, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';
import AddressSearch from './AddressSearch';
import AddressForm from './AddressForm';

export default function AddressSelector({ onAddressSelect }) {
  const { accessToken } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    if (accessToken) {
      fetchAddresses();
    }
  }, [accessToken]);

  const fetchAddresses = async () => {
    setLoading(true);
    setError(null);

    try {
      logApiCall('GET', API_ENDPOINTS.USER_ADDRESSES);
      const response = await fetch(API_ENDPOINTS.USER_ADDRESSES, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAddresses(data.data);
          // Auto-select default address
          const defaultAddr = data.data.find(a => a.is_default);
          if (defaultAddr) {
            setSelectedAddress(defaultAddr.id);
            onAddressSelect(defaultAddr);
          }
        }
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (addressId) => {
    setSelectedAddress(addressId);
    const address = addresses.find(a => a.id === addressId);
    if (address) {
      onAddressSelect(address);
    }
  };

  const handleAddressAdded = () => {
    setShowForm(false);
    setEditingAddress(null);
    fetchAddresses();
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;

    try {
      logApiCall('DELETE', `${API_ENDPOINTS.USER_ADDRESSES}/${addressId}`);
      const response = await fetch(`${API_ENDPOINTS.USER_ADDRESSES}/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        fetchAddresses();
      }
    } catch (err) {
      console.error('Error deleting address:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader size={24} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Saved Addresses */}
      <div className="space-y-2 mb-4">
        {addresses.length > 0 && (
          <p className="text-xs font-medium text-gray-500">Saved Addresses:</p>
        )}
        
        {addresses.map(address => (
          <div
            key={address.id}
            onClick={() => handleAddressSelect(address.id)}
            className={`p-3 rounded-xl cursor-pointer transition border-2 ${
              selectedAddress === address.id
                ? 'border-orange-600 bg-orange-50'
                : 'border-gray-100 bg-white hover:border-orange-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-900">{address.label}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{address.address}</p>
              </div>
              {address.is_default && (
                <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-1 rounded ml-2">
                  Default
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowSearch(true)}
          className="flex-1 py-2.5 bg-orange-100 text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-200 transition flex items-center justify-center gap-2"
        >
          <MapPin size={16} />
          Search Address
        </button>

        {addresses.length < 5 && (
          <button
            onClick={() => {
              setEditingAddress(null);
              setShowForm(true);
            }}
            className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add Address
          </button>
        )}
      </div>

      {/* Search Modal */}
      {showSearch && (
        <AddressSearch
          onAddressSelect={(addr) => {
            if (addresses.length < 5) {
              setEditingAddress({
                ...addr,
                label: 'Other'
              });
              setShowForm(true);
            }
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <AddressForm
          address={editingAddress}
          onClose={() => {
            setShowForm(false);
            setEditingAddress(null);
          }}
          onSuccess={handleAddressAdded}
        />
      )}
    </div>
  );
}

