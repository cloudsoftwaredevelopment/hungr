// ========================================
// FILE 1: src/components/Address/DeliveryToggle.jsx
// ========================================

import React from 'react';
import { MapPin, Package } from 'lucide-react';

export default function DeliveryToggle({ deliveryType, setDeliveryType }) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setDeliveryType('delivery')}
        className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${
          deliveryType === 'delivery'
            ? 'bg-orange-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <MapPin size={16} />
        Delivery
      </button>
      <button
        onClick={() => setDeliveryType('pickup')}
        className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${
          deliveryType === 'pickup'
            ? 'bg-orange-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <Package size={16} />
        Pickup
      </button>
    </div>
  );
}
