import React, { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, History } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const WalletView = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/wallet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBalance(data.data.balance);
        setTransactions(data.data.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch wallet", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || isNaN(topUpAmount) || parseFloat(topUpAmount) <= 0) return;

    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/wallet/topup`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ amount: parseFloat(topUpAmount), method: 'gcash' })
      });
      const data = await response.json();
      if (data.success) {
        alert("Top-up Successful!");
        setShowTopUp(false);
        setTopUpAmount('');
        fetchWalletData(); // Refresh balance
      }
    } catch (error) {
      console.error("Top-up failed", error);
      alert("Top-up failed. Please try again.");
    }
  };

  return (
    <div className="animate-in slide-in-from-right pb-24 relative min-h-screen bg-gray-50">
      
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-6 pt-8 rounded-b-3xl shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet size={120} />
        </div>
        
        <p className="text-orange-100 text-sm font-medium mb-1">Total Balance</p>
        <h1 className="text-4xl font-bold mb-6">₱ {parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h1>
        
        <div className="flex gap-3">
            <button 
                onClick={() => setShowTopUp(true)}
                className="flex-1 bg-white text-orange-600 py-3 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
                <Plus size={18} /> Top Up
            </button>
            <button className="flex-1 bg-orange-700/50 text-white py-3 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition backdrop-blur-sm">
                <ArrowUpRight size={18} /> Transfer
            </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <History size={18} className="text-gray-500" /> Recent Transactions
        </h3>
        
        {loading ? (
            <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
                <p className="text-gray-400 text-sm">No transactions yet</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 border-b border-gray-100 last:border-b-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'topup' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {tx.type === 'topup' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-900 capitalize">{tx.description || tx.type}</p>
                                <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className={`font-bold text-sm ${tx.type === 'topup' ? 'text-green-600' : 'text-gray-900'}`}>
                            {tx.type === 'topup' ? '+' : '-'} ₱{parseFloat(tx.amount).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom duration-300">
                <h3 className="text-xl font-bold mb-4">Top Up Wallet</h3>
                
                <p className="text-sm text-gray-600 mb-2">Select Amount</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {[100, 200, 500, 1000].map(amt => (
                        <button 
                            key={amt}
                            onClick={() => setTopUpAmount(amt.toString())}
                            className={`py-2 rounded-lg border text-sm font-medium transition ${topUpAmount === amt.toString() ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600'}`}
                        >
                            ₱{amt}
                        </button>
                    ))}
                </div>

                <div className="relative mb-6">
                    <span className="absolute left-4 top-3.5 font-bold text-gray-400">₱</span>
                    <input 
                        type="number" 
                        className="w-full p-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 outline-none"
                        placeholder="Enter amount"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                    />
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowTopUp(false)}
                        className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleTopUp}
                        className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition"
                    >
                        Confirm Top Up
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default WalletView;
