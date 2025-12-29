import React, { useState, useEffect } from 'react';
import { Coins, History, Gift, TrendingUp, ShoppingBag, ArrowRight, Star, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const CoinsView = ({ setView }) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyTransactions, setHistoryTransactions] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [fetchingHistory, setFetchingHistory] = useState(false);
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
                setTransactions(data.data.transactions || []);
            }
        } catch (error) {
            console.error("Failed to fetch coins", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFullHistory = async (page = 1) => {
        if (fetchingHistory) return;
        setFetchingHistory(true);
        try {
            const token = sessionStorage.getItem('accessToken');
            const response = await fetch(`${API_URL}/coins/history?page=${page}&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                if (page === 1) {
                    setHistoryTransactions(data.data.transactions);
                } else {
                    setHistoryTransactions(prev => [...prev, ...data.data.transactions]);
                }
                setHasMoreHistory(data.data.transactions.length === 20);
                setHistoryPage(page);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setFetchingHistory(false);
        }
    };

    const handleShowHistory = () => {
        setShowHistory(true);
        fetchFullHistory(1);
    };

    // Simulated Earning Actions
    const handleSimulateEarn = async (actionCode) => {
        try {
            const token = sessionStorage.getItem('accessToken');
            const response = await fetch(`${API_URL}/coins/earn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ actionCode })
            });
            const data = await response.json();
            if (data.success) {
                if (data.data.alreadyEarned) {
                    alert('You already earned coins for this action!');
                } else {
                    alert(`🎉 Hooray! You earned ${data.data.amount} coins!`);
                }
                fetchCoinsData();
            } else {
                alert(data.error || 'Failed to earn coins');
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
                    <span className="text-5xl">🪙</span> {loading ? '...' : (balance || 0)}
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
                        onClick={() => handleSimulateEarn('order_complete')}
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
                    >
                        <div className="bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 mb-2">
                            <ShoppingBag size={16} />
                        </div>
                        <p className="text-xs font-bold text-gray-900">Complete Order</p>
                        <p className="text-[10px] text-gray-500">+10 Coins</p>
                    </button>
                    <button
                        onClick={() => handleSimulateEarn('bulk_order')}
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
                    >
                        <div className="bg-purple-100 w-8 h-8 rounded-lg flex items-center justify-center text-purple-600 mb-2">
                            <Gift size={16} />
                        </div>
                        <p className="text-xs font-bold text-gray-900">Bulk Order (5+)</p>
                        <p className="text-[10px] text-gray-500">+50 Coins</p>
                    </button>
                    <button
                        onClick={() => handleSimulateEarn('wallet_payment')}
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
                    >
                        <div className="bg-green-100 w-8 h-8 rounded-lg flex items-center justify-center text-green-600 mb-2">
                            <Coins size={16} />
                        </div>
                        <p className="text-xs font-bold text-gray-900">Pay with Wallet</p>
                        <p className="text-[10px] text-gray-500">+5 Coins</p>
                    </button>
                    <button
                        onClick={() => handleSimulateEarn('advance_booking')}
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-left hover:border-orange-200 transition active:scale-95"
                    >
                        <div className="bg-yellow-100 w-8 h-8 rounded-lg flex items-center justify-center text-yellow-600 mb-2">
                            <Star size={16} />
                        </div>
                        <p className="text-xs font-bold text-gray-900">Advance Booking</p>
                        <p className="text-[10px] text-gray-500">+15 Coins</p>
                    </button>
                </div>
            </div>

            {/* Transaction History */}
            <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <History size={18} className="text-gray-500" /> Coin History
                    </h3>
                    <button
                        onClick={handleShowHistory}
                        className="text-orange-600 text-xs font-bold hover:underline"
                    >
                        View Full History
                    </button>
                </div>

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
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.entry_type === 'credit' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {tx.entry_type === 'credit' ? <Star size={16} /> : <ShoppingBag size={16} />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 capitalize">{tx.description || tx.transaction_type}</p>
                                        <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <span className={`font-bold text-sm ${tx.entry_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                    {tx.entry_type === 'credit' ? '+' : '-'} {parseInt(tx.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Full History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-0 animate-in slide-in-from-bottom duration-300 h-[85vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 rounded-t-3xl sm:rounded-t-2xl z-10">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <span className="p-2 bg-yellow-100 text-yellow-600 rounded-xl"><History size={20} /></span>
                                    Coin Transactions
                                </h3>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Earnings & Redemptions</p>
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
                            >
                                <span className="font-bold">✕</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {historyTransactions.length === 0 && !fetchingHistory ? (
                                <div className="text-center py-20 text-gray-400">
                                    <div className="w-20 h-20 bg-gray-50 flex items-center justify-center rounded-full mx-auto mb-4 border-2 border-dashed border-gray-200">
                                        <Coins size={32} className="opacity-20" />
                                    </div>
                                    <p className="font-medium">No coin history found</p>
                                    <p className="text-xs mt-1">Start earning by ordering!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historyTransactions.map((tx) => (
                                        <div key={tx.id} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm hover:border-yellow-200 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${tx.entry_type === 'credit' ? 'bg-yellow-400 text-white' : 'bg-orange-500 text-white'}`}>
                                                    {tx.entry_type === 'credit' ? <Star size={24} fill="currentColor" /> : <ShoppingBag size={24} />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900 leading-tight">{tx.description || tx.transaction_type}</p>
                                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                                                        {new Date(tx.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-black text-base ${tx.entry_type === 'credit' ? 'text-yellow-600' : 'text-orange-600'}`}>
                                                    {tx.entry_type === 'credit' ? '+' : '-'} {parseInt(tx.amount || 0)}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-0.5 font-bold">Total: {parseInt(tx.running_balance || 0)}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {hasMoreHistory ? (
                                        <button
                                            onClick={() => fetchFullHistory(historyPage + 1)}
                                            disabled={fetchingHistory}
                                            className="w-full py-4 text-yellow-600 text-sm font-bold hover:bg-yellow-50 rounded-2xl transition border-2 border-dashed border-yellow-200 mt-4 mb-6 shadow-sm active:scale-[0.98]"
                                        >
                                            {fetchingHistory ? '⌛ Loading more...' : 'Load More History'}
                                        </button>
                                    ) : (historyTransactions?.length || 0) > 0 && (
                                        <div className="flex flex-col items-center py-8 opacity-40">
                                            <div className="w-1 h-8 bg-gradient-to-b from-yellow-400 to-transparent rounded-full mb-2"></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Journey Complete</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoinsView;
