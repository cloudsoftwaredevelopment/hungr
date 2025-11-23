/**
 * AuthModal.jsx
 * Authentication modal with login/signup toggle
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

export default function AuthModal({ onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);

  const handleAuthSuccess = () => {
    onClose();
    if (onAuthSuccess) {
      onAuthSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Hungr Logo/Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-orange-600">Hungr</h1>
          <p className="text-sm text-gray-500 mt-1">Food Delivery App</p>
        </div>

        {/* Auth Forms */}
        <div className="mt-8">
          {isLogin ? (
            <LoginForm onSwitchToSignup={() => setIsLogin(false)} />
          ) : (
            <SignupForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>

        {/* Continue as Guest */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
