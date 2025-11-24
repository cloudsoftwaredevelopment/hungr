// ========================================
// FILE 5: src/components/Address/SavedAddresses.jsx
// ========================================

import React, { useState, useEffect } from 'react';
import { MapPin, Edit2, Trash2, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';
import AddressForm from './AddressForm';

export default function SavedAddresses() {
  const { accessToken } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
        }
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (addressId) => {
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

  const handleSetDefault = async (addressId) => {
    try {
      logApiCall('POST', `${API_ENDPOINTS.USER_ADDRESSES}/${addressId}/default`);
      const response = await fetch(`${API_ENDPOINTS.USER_ADDRESSES}/${addressId}/default`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        fetchAddresses();
      }
    } catch (err) {
      console.error('Error setting default:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <MapPin className="text-orange-600" />
        Saved Addresses
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <MapPin size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No addresses saved yet</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {addresses.map(address => (
            <div key={address.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900">{address.label}</h3>
                {address.is_default && (
                  <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-1 rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{address.address}</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingAddress(address);
                    setShowForm(true);
                  }}
                  className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-1"
                >
                  <Edit2 size={14} />
                  Edit
                </button>

                {!address.is_default && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="flex-1 py-2 bg-gray-100 text-gray-600 font-bold text-xs rounded-lg hover:bg-gray-200 transition"
                  >
                    Set Default
                  </button>
                )}

                <button
                  onClick={() => handleDelete(address.id)}
                  className="flex-1 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-lg hover:bg-red-100 transition flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addresses.length < 5 && (
        <button
          onClick={() => {
            setEditingAddress(null);
            setShowForm(true);
          }}
          className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition"
        >
          + Add New Address
        </button>
      )}

      {showForm && (
        <AddressForm
          address={editingAddress}
          onClose={() => {
            setShowForm(false);
            setEditingAddress(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingAddress(null);
            fetchAddresses();
          }}
        />
      )}
    </div>
  );
}
