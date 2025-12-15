import React, { useState, useRef } from 'react';
import { MapPin, Wallet, List, AlertCircle, Phone, Mail, ChevronRight, LogOut, Camera, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LocationSettings from './LocationSettings';

const API_URL = '/api';

const ProfileView = ({ setView }) => {
  const { user, logout, login } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      setView('home');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 5MB.");
      return;
    }

    setUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result;

      try {
        const token = sessionStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/users/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ profile_image: base64Image })
        });

        // Check for Session Expiry (403/401)
        if (response.status === 403 || response.status === 401) {
          alert("Session expired. Please login again.");
          logout();
          return;
        }

        const data = await response.json();
        if (data.success) {
          const updatedUser = { ...user, profile_image: base64Image };
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          alert("Profile photo updated!");
          window.location.reload();
        } else {
          alert("Failed to update profile: " + data.error);
        }
      } catch (err) {
        console.error(err);
        alert("Error uploading image. Server might be offline or busy.");
      } finally {
        setUploading(false);
      }
    };
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
    { label: 'Payment Methods', icon: Wallet, action: () => setView('wallet') },
    { label: 'Order History', icon: List, action: () => setView('transactions') },
    { label: 'Help Center', icon: AlertCircle, action: () => { } },
  ];

  return (
    <div className="pb-20 animate-in slide-in-from-right">
      {/* Profile Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-orange-50 overflow-hidden bg-gray-100 flex items-center justify-center">
            {user.profile_image ? (
              <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-orange-300">{user.username?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current.click()}
            className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full shadow-md hover:bg-orange-700 transition"
            disabled={uploading}
          >
            {uploading ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="text-center w-full">
          <h3 className="font-bold text-xl text-gray-900">{user.username}</h3>

          {user.phone_number && (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
              <Phone size={14} /> {user.phone_number}
            </p>
          )}

          <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-0.5">
            <Mail size={14} /> {user.email}
          </p>

          {/* Added Address Display/Edit Link */}
          {user.address ? (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1 px-4 text-center">
              <MapPin size={14} className="flex-shrink-0" />
              <span className="truncate max-w-[200px]">{user.address}</span>
            </p>
          ) : (
            <button
              onClick={() => setView('addresses')}
              className="text-sm text-orange-600 font-bold flex items-center justify-center gap-1 mt-2 mx-auto hover:underline"
            >
              <MapPin size={14} /> Add Address
            </button>
          )}
        </div>
      </div>

      {/* GPS Location Settings */}
      <div className="mb-6">
        <LocationSettings />
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
};

export default ProfileView;
