/**
 * TransactionHistory.jsx
 * Display coin and wallet transaction history
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS, handleApiError, logApiCall } from '../../config/api';

export default function TransactionHistory() {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('coins'); // 'coins' or 'wallet'

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchTransactions();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken, activeTab]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = activeTab === 'coins'
        ? API_ENDPOINTS.USER_COINS_TRANSACTIONS
        : API_ENDPOINTS.USER_WALLET_TRANSACTIONS;

      logApiCall('GET', endpoint);

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTransactions(data.data);
        }
      } else {
        throw new Error('Failed to fetch transactions');
      }
    } catch (err) {
      const errorMsg = handleApiError(err);
      setError(errorMsg);
      console.error('Fetch transactions error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="pb-20 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Please login to view transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('coins')}
          className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition ${
            activeTab === 'coins'
              ? 'bg-orange-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          🪙 Coins
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition ${
            activeTab === 'wallet'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          💳 Wallet
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size={32} className="animate-spin text-orange-600" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.amount >= 0
                      ? 'bg-green-100'
                      : 'bg-red-100'
                  }`}
                >
                  {transaction.amount >= 0 ? (
                    <TrendingUp size={18} className="text-green-600" />
                  ) : (
                    <TrendingDown size={18} className="text-red-600" />
                  )}
                </div>

                {/* Transaction Details */}
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900 capitalize">
                    {transaction.type}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {transaction.description || 'Transaction'}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right">
                <p
                  className={`font-bold text-sm ${
                    transaction.amount >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {transaction.amount >= 0 ? '+' : ''}
                  {activeTab === 'coins'
                    ? transaction.amount
                    : `₱${transaction.amount.toFixed(2)}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(transaction.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
