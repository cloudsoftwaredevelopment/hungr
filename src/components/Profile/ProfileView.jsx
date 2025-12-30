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
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Profile Header */}
      <div className="hero-gradient p-8 pt-12 rounded-b-[3rem] shadow-2xl relative overflow-hidden flex flex-col items-center gap-6 mb-8">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600/20 rounded-full -ml-24 -mb-24 blur-3xl"></div>

        <div className="relative group">
          <div className="w-28 h-28 rounded-[2.5rem] border-4 border-white/30 overflow-hidden bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
            {user.profile_image ? (
              <img src={user.profile_image} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-black text-white drop-shadow-lg">{user.username?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current.click()}
            className="absolute -bottom-2 -right-2 bg-white text-orange-600 p-3 rounded-2xl shadow-xl hover:scale-110 hover:rotate-12 transition-all active:scale-90 border border-orange-100"
            disabled={uploading}
          >
            {uploading ? <Loader size={16} className="animate-spin" /> : <Camera size={16} strokeWidth={3} />}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <div className="text-center w-full relative z-10">
          <h3 className="font-black text-3xl text-white tracking-tight drop-shadow-sm mb-2">{user.username}</h3>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {user.phone_number && (
              <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/20">
                <Phone size={12} strokeWidth={3} /> {user.phone_number}
              </div>
            )}
            <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/20">
              <Mail size={12} strokeWidth={3} /> {user.email}
            </div>
          </div>

          {user.address ? (
            <div className="mt-4 bg-black/20 backdrop-blur-md px-5 py-2 rounded-2xl text-[12px] font-semibold text-orange-50 inline-flex items-center gap-2 border border-white/10 max-w-[80%] mx-auto">
              <MapPin size={14} className="flex-shrink-0 text-orange-300" />
              <span className="truncate">{user.address}</span>
            </div>
          ) : (
            <button
              onClick={() => setView('addresses')}
              className="mt-4 bg-white text-orange-600 px-6 py-2.5 rounded-2xl text-[12px] font-black tracking-tight flex items-center gap-2 mx-auto hover:scale-105 transition-transform shadow-xl shadow-orange-950/20"
            >
              <MapPin size={14} strokeWidth={3} /> SETUP ADDRESS
            </button>
          )}
        </div>
      </div>

      {/* GPS Location Settings */}
      <div className="px-5 mb-8">
        <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-50">
          <LocationSettings />
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-5 mb-10 space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-4">Account Overview</h3>
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full text-left p-5 bg-white rounded-[1.8rem] shadow-sm flex items-center justify-between group hover:bg-slate-50 transition-all border border-slate-50/50 active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors border border-slate-100 group-hover:border-orange-100">
                {item.icon && <item.icon size={20} strokeWidth={2.5} />}
              </div>
              <span className="text-sm font-extrabold text-slate-700 tracking-tight">{item.label}</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-orange-500 transition-colors">
              <ChevronRight size={20} strokeWidth={3} />
            </div>
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="px-5 mb-10">
        <button
          onClick={handleLogout}
          className="w-full p-5 bg-red-50 rounded-[2rem] text-red-600 font-extrabold text-sm flex items-center justify-center gap-3 hover:bg-red-100 transition-all active:scale-95 border border-red-100"
        >
          <LogOut size={20} strokeWidth={3} />
          Sign Out of Hungr
        </button>
      </div>

      {/* Account Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
        <p>Account created on {new Date(user.created_at || Date.now()).toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default ProfileView;
