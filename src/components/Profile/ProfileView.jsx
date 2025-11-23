/**
 * ProfileView.jsx
 * User profile page with settings and logout
 */

import React from 'react';
import { ChevronRight, LogOut, MapPin, Phone, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileView({ setView }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
      setView('home');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-400">Please login to view your profile</p>
      </div>
    );
  }

  const menuItems = [
    { label: 'Saved Addresses', icon: MapPin, action: () => setView('addresses') },
    { label: 'Payment Methods', icon: null, action: () => {} },
    { label: 'Order History', icon: null, action: () => {} },
    { label: 'Help Center', icon: null, action: () => {} },
  ];

  return (
    <div className="pb-20">
      {/* Profile Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-2xl font-bold text-orange-600">
          {user.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900">{user.username}</h3>
          {user.phone_number && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <Phone size={14} /> {user.phone_number}
            </p>
          )}
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <Mail size={14} /> {user.email}
          </p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-2 mb-6">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full text-left p-4 bg-white rounded-xl shadow-sm text-sm font-medium text-gray-700 flex justify-between items-center hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2">
              {item.icon && <item.icon size={18} className="text-gray-400" />}
              {item.label}
            </span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full p-4 bg-red-50 rounded-xl text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition"
      >
        <LogOut size={18} />
        Logout
      </button>

      {/* Account Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
        <p>Account created on {new Date(user.created_at || Date.now()).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
