// ========================================
// FILE 4: src/components/Address/AddressForm.jsx
// ========================================

import React, { useState } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';

export default function AddressForm({ address, onClose, onSuccess }) {
  const { accessToken } = useAuth();
  const [label, setLabel] = useState(address?.label || 'Home');
  const [fullAddress, setFullAddress] = useState(address?.address || '');
  const [latitude, setLatitude] = useState(address?.latitude || '');
  const [longitude, setLongitude] = useState(address?.longitude || '');
  const [isDefault, setIsDefault] = useState(address?.is_default || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!label || !fullAddress || !latitude || !longitude) {
      setError('All fields are required');
      return;
    }

    setLoading(true);

    try {
      const method = address?.id ? 'PUT' : 'POST';
      const endpoint = address?.id
        ? `${API_ENDPOINTS.USER_ADDRESSES}/${address.id}`
        : API_ENDPOINTS.USER_ADDRESSES;

      logApiCall(method, endpoint);

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          label,
          address: fullAddress,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          is_default: isDefault
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Address saved successfully');
        onSuccess();
      } else {
        setError(data.error || 'Failed to save address');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Header */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {address?.id ? 'Edit Address' : 'Add New Address'}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="Home">🏠 Home</option>
              <option value="Work">💼 Work</option>
              <option value="Other">📍 Other</option>
            </select>
          </div>

          {/* Full Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              placeholder="Street address, building, etc."
              className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
              rows="3"
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
              <input
                type="number"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="10.6898"
                step="0.0001"
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
              <input
                type="number"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="122.5626"
                step="0.0001"
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>

          {/* Set as Default */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-700">Set as default address</span>
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              address?.id ? 'Update Address' : 'Add Address'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

