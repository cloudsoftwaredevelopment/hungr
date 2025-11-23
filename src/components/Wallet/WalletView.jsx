/**
 * WalletView.jsx
 * Wallet page showing coins and real money balance
 */

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Plus, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';

export default function WalletView() {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [coinBalance, setCoinBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch coin and wallet balance on mount
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchBalances();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  const fetchBalances = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch coin balance
      logApiCall('GET', API_ENDPOINTS.USER_COINS);
      const coinResponse = await fetch(API_ENDPOINTS.USER_COINS, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (coinResponse.ok) {
        const coinData = await coinResponse.json();
        if (coinData.success) {
          setCoinBalance(Number(coinData.data.balance) || 0);
          console.log('✅ Coin balance fetched:', coinData.data.balance);
        }
      } else {
        console.error('Coin balance fetch failed:', coinResponse.status);
      }

      // Fetch wallet balance
      logApiCall('GET', API_ENDPOINTS.USER_WALLET);
      const walletResponse = await fetch(API_ENDPOINTS.USER_WALLET, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        if (walletData.success) {
          setWalletBalance(Number(walletData.data.balance) || 0);
          console.log('✅ Wallet balance fetched:', walletData.data.balance);
        }
      } else {
        console.error('Wallet balance fetch failed:', walletResponse.status);
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      console.error('Fetch balances error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="pb-20 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Please login to view your wallet</p>
        </div>
      </div>
    );
  }

  console.log('WalletView render:', { loading, coinBalance, walletBalance, error });

  if (loading) {
    return (
      <div className="pb-20 flex items-center justify-center min-h-screen">
        <Loader size={32} className="animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Coins Section */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm font-medium opacity-90">Hungr Coins</p>
            <h2 className="text-4xl font-bold mt-1">🪙 {coinBalance}</h2>
          </div>
          <div className="bg-white/20 p-3 rounded-full">
            <TrendingUp size={24} />
          </div>
        </div>
        <p className="text-sm opacity-90">Earned from orders and rewards</p>
      </div>

      {/* Wallet Section */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm font-medium opacity-90">Wallet Balance</p>
            <h2 className="text-4xl font-bold mt-1">₱ {walletBalance.toFixed(2)}</h2>
          </div>
          <div className="bg-white/20 p-3 rounded-full">
            <Wallet size={24} />
          </div>
        </div>

        {/* Top Up Button */}
        <button className="w-full bg-white text-blue-600 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition">
          <Plus size={18} />
          Top Up
        </button>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-800 text-sm px-1">Quick Actions</h3>

        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 bg-white rounded-xl shadow-sm text-center hover:shadow-md transition">
            <div className="text-2xl mb-2">💳</div>
            <p className="text-xs font-medium text-gray-700">Payment Methods</p>
          </button>

          <button className="p-4 bg-white rounded-xl shadow-sm text-center hover:shadow-md transition">
            <div className="text-2xl mb-2">🎁</div>
            <p className="text-xs font-medium text-gray-700">Rewards</p>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-xs text-blue-700 text-center border border-blue-100">
        <p>💡 Coins expire after 6 months of inactivity</p>
      </div>
    </div>
  );
}
