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
        <div className="pb-32 font-sans bg-slate-50 min-h-screen">

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-6 pb-4 border-b border-slate-100 shadow-sm flex items-center gap-4">
                <button
                    onClick={() => setView('home')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95"
                >
                    <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                        Hungr <span className="text-orange-600 italic">Coins</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Collect & Redeem Rewards</p>
                </div>
            </div>

            {/* Coin Card */}
            <div className="m-5 relative group">
                <div className="absolute inset-0 bg-yellow-500 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-orange-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Coins size={160} strokeWidth={1} />
                    </div>

                    <div className="relative z-10">
                        <p className="text-yellow-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Accumulated Points</p>
                        <h1 className="text-5xl font-black mb-4 tracking-tighter flex items-center gap-3">
                            <span className="text-4xl">🪙</span>
                            {loading ? '...' : balance}
                        </h1>

                        <p className="text-[11px] font-bold text-yellow-50/80 mb-6 leading-relaxed max-w-[200px]">
                            Your loyalty Pays Off. Redeem these for exclusive vouchers and discounts!
                        </p>

                        <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-white/30 transition-all border border-white/10 group/btn active:scale-[0.98]">
                            <div className="flex items-center gap-4">
                                <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center text-orange-600 shadow-lg">
                                    <Gift size={20} strokeWidth={2.5} />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black uppercase tracking-widest">Rewards Shop</p>
                                    <p className="text-[10px] font-bold text-yellow-50/70">Exclusive Deals Waiting</p>
                                </div>
                            </div>
                            <ArrowRight size={18} strokeWidth={3} className="text-yellow-100 group-hover/btn:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ways to Earn */}
            <div className="px-5 mb-8">
                <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                    <TrendingUp size={18} className="text-orange-600" strokeWidth={3} /> Ways to Earn
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        { id: 'order_complete', label: 'Order Complete', coins: '+10', icon: ShoppingBag, color: 'blue' },
                        { id: 'bulk_order', label: 'Bulk Order (5+)', coins: '+50', icon: Gift, color: 'purple' },
                        { id: 'wallet_payment', label: 'Wallet Payment', coins: '+5', icon: Coins, color: 'emerald' },
                        { id: 'advance_booking', label: 'Advance Booking', coins: '+15', icon: Star, color: 'amber' }
                    ].map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleSimulateEarn(action.id)}
                            className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm text-left hover:shadow-xl hover:border-orange-200 transition-all duration-300 active:scale-95 group"
                        >
                            <div className={`bg-${action.color}-50 w-11 h-11 rounded-2xl flex items-center justify-center text-${action.color}-600 mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
                                <action.icon size={20} strokeWidth={2.5} />
                            </div>
                            <p className="text-xs font-black text-gray-900 tracking-tight leading-tight uppercase">{action.label}</p>
                            <p className="text-[10px] font-black text-orange-600 mt-1 uppercase italic">{action.coins} Coins</p>
                        </button>
                    ))}
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
                                                    {tx.entry_type === 'credit' ? '+' : '-'} {parseInt(tx.amount)}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-0.5 font-bold">Total: {parseInt(tx.running_balance)}</p>
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
