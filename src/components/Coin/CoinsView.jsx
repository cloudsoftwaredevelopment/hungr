import React, { useState, useEffect } from 'react';
import { Coins, History, Gift, TrendingUp, ShoppingBag, ArrowRight, Star, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const CoinsView = ({ setView }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCoinsData();
    }
  }, [user]);

  const fetchCoinsData = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/coins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBalance(data.data.balance);
        setTransactions(data.data.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch coins", error);
    } finally {
      setLoading(false);
    }
  };

  // Simulated Earning Actions
  const handleSimulateEarn = async (action) => {
    try {
        const token = sessionStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/coins/earn`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ action })
        });
        const data = await response.json();
        if (data.success) {
            alert(`Hooray! You earned ${data.data.amount} coins!`);
            fetchCoinsData();
        }
    } catch (e) {
        console.error(e);
        alert("Failed to earn coins.");
    }
  };

  return (
    <div className="animate-in slide-in-from-right pb-24 relative min-h-screen bg-gray-50">
      
      {/* Coin Card */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 pt-12 rounded-b-3xl shadow-xl mb-6 relative overflow-hidden">
        
        {/* Back Button */}
        <div className="absolute top-4 left-4 z-20">
            <button 
                onClick={() => setView('home')} 
                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition shadow-sm"
            >
                <ChevronLeft size={24} />
            </button>
        </div>

        <div className="absolute top-0 right-0 p-4 opacity-20">
            <Coins size={120} />
        </div>
        
        <p className="text-yellow-100 text-sm font-medium mb-1 mt-4">Hungr Rewards</p>
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
            <span className="text-5xl">🪙</span> {loading ? '...' : balance}
        </h1>
        <p className="text-xs text-yellow-50 opacity-90 mb-6">
            Use coins to redeem exclusive food vouchers.
        </p>
        
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-white/30 transition">
            <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-full text-orange-500">
                    <Gift size={20} />
                </div>
                <div className="text-left">
                    <p className="text-xs font-bold">Rewards Shop</p>
                    <p className="text-[10px] opacity-80">Tap to redeem</p>
                </div>
            </div>
            <ArrowRight size={16} />
        </div>
      </div>

      {/* Ways to Earn */}
      <div className="px-4 mb-6">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-orange-600" /> Ways to Earn
        </h3>
        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={() => handleSimulateEarn('pickup_order')}
                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
            >
                <div className="bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 mb-2">
                    <ShoppingBag size={16} />
                </div>
                <p className="text-xs font-bold text-gray-900">Pick-up Order</p>
                <p className="text-[10px] text-gray-500">+10 Coins</p>
            </button>
            <button 
                onClick={() => handleSimulateEarn('bulk_order')}
                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
            >
                <div className="bg-purple-100 w-8 h-8 rounded-lg flex items-center justify-center text-purple-600 mb-2">
                    <Gift size={16} />
                </div>
                <p className="text-xs font-bold text-gray-900">Bulk Order</p>
                <p className="text-[10px] text-gray-500">+50 Coins</p>
            </button>
            <button 
                onClick={() => handleSimulateEarn('browse_menu')}
                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
            >
                <div className="bg-green-100 w-8 h-8 rounded-lg flex items-center justify-center text-green-600 mb-2">
                    <ArrowRight size={16} />
                </div>
                <p className="text-xs font-bold text-gray-900">Browse Menu</p>
                <p className="text-[10px] text-gray-500">+1 Coin</p>
            </button>
            <button 
                onClick={() => handleSimulateEarn('feedback')}
                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
            >
                <div className="bg-yellow-100 w-8 h-8 rounded-lg flex items-center justify-center text-yellow-600 mb-2">
                    <Star size={16} />
                </div>
                <p className="text-xs font-bold text-gray-900">Give Feedback</p>
                <p className="text-[10px] text-gray-500">+5 Coins</p>
            </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="px-4">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <History size={18} className="text-gray-500" /> Coin History
        </h3>
        
        {loading ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
                <p className="text-gray-400 text-sm">No coin activity yet</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 border-b border-gray-100 last:border-b-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'earned' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
                                {tx.type === 'earned' ? <TrendingUp size={16} /> : <ShoppingBag size={16} />}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-900 capitalize">{tx.description || tx.type}</p>
                                <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className={`font-bold text-sm ${tx.type === 'earned' ? 'text-green-600' : 'text-gray-900'}`}>
                            {tx.type === 'earned' ? '+' : '-'} {parseInt(tx.amount)}
                        </span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default CoinsView;
