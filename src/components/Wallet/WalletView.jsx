import React, { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Upload, X, History, Clock, CheckCircle, XCircle, Building2, Smartphone, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const WalletView = () => {
  console.log("[WalletView] Initializing...");
  const { user } = useAuth();
  console.log("[WalletView] User:", user);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTransactions, setHistoryTransactions] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
        setTransactions(data.data.transactions || []);
        setPendingRequests(data.data.pendingRequests || 0);
      }
    } catch (error) {
      console.error("Failed to fetch wallet", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullHistory = async (page = 1) => {
    if (fetchingHistory) return;
    setFetchingHistory(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/wallet/history?page=${page}&limit=20`, {
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result);
        setProofPreview(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || isNaN(topUpAmount) || parseFloat(topUpAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!proofImage) {
      setError('Please upload proof of payment');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(topUpAmount),
          paymentMethod,
          paymentReference,
          proofImage,
          idempotencyKey: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
      });
      const data = await response.json();
      if (data.success) {
        alert("✅ Top-up request submitted! Please wait for admin approval.");
        setShowTopUp(false);
        setTopUpAmount('');
        setPaymentMethod('gcash');
        setPaymentReference('');
        setProofImage(null);
        setProofPreview(null);
        fetchWalletData();
      } else {
        setError(data.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error("Top-up failed", error);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const presetAmounts = [100, 200, 500, 1000];

  return (
    <div className="pb-32 font-sans bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-6 pb-4 border-b border-slate-100 shadow-sm flex items-center gap-4">
        <button
          onClick={() => window.history.back()}
          className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95"
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
            My <span className="text-orange-600 italic">Wallet</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Manage your balance</p>
        </div>
      </div>

      {/* Wallet Card */}
      <div className="m-5 relative group">
        <div className="absolute inset-0 bg-orange-600 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
        <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Wallet size={160} strokeWidth={1} />
          </div>

          <div className="relative z-10">
            <p className="text-orange-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Available Balance</p>
            <h1 className="text-5xl font-black mb-4 tracking-tighter">
              <span className="text-2xl mr-1 opacity-80">₱</span>
              {parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h1>

            {pendingRequests > 0 && (
              <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 mb-6">
                <Clock size={12} className="text-orange-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-200">{pendingRequests} Pending Top-ups</span>
              </div>
            )}

            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setShowTopUp(true)}
                className="flex-1 bg-white text-orange-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-orange-50"
              >
                <Plus size={18} strokeWidth={3} /> Top Up
              </button>
              <button className="flex-1 bg-white/20 backdrop-blur-md text-white/40 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed" disabled>
                <ArrowUpRight size={18} strokeWidth={3} /> Transfer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <History size={18} className="text-gray-500" /> Recent Transactions
          </h3>
          <button
            onClick={handleShowHistory}
            className="text-orange-600 text-xs font-bold hover:underline"
          >
            View History
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
            <Wallet size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No transactions yet</p>
            <p className="text-gray-400 text-sm mt-1">Top up to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden px-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-5 border-b border-slate-50 last:border-b-0 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                    {tx.type === 'topup' ? <ArrowDownLeft size={22} strokeWidth={2.5} /> : <ArrowUpRight size={22} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <p className="font-black text-sm text-gray-900 tracking-tight leading-tight uppercase">{tx.description || tx.type}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-black text-base tracking-tight ${tx.type === 'topup' ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {tx.type === 'topup' ? '+' : '-'} ₱{parseFloat(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div >
        )}
      </div >

      {/* Full History Modal */}
      {
        showHistory && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-0 animate-in slide-in-from-bottom duration-300 h-[85vh] flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 rounded-t-3xl sm:rounded-t-2xl z-10">
                <div>
                  <h3 className="text-xl font-bold">Transaction History</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Your complete wallet audit trail</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {historyTransactions.length === 0 && !fetchingHistory ? (
                  <div className="text-center py-20 text-gray-400">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No transaction history found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyTransactions.map((tx) => (
                      <div key={tx.id} className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 hover:border-orange-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm ${tx.entry_type === 'credit' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {tx.entry_type === 'credit' ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900 leading-tight">{tx.description || tx.transaction_type}</p>
                            <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 uppercase tracking-wider font-semibold">
                              <Clock size={10} /> {new Date(tx.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-black text-sm ${tx.entry_type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                            {tx.entry_type === 'credit' ? '+' : '-'} ₱{parseFloat(tx.amount || 0).toFixed(2)}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">Bal: ₱{parseFloat(tx.running_balance || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}

                    {hasMoreHistory ? (
                      <button
                        onClick={() => fetchFullHistory(historyPage + 1)}
                        disabled={fetchingHistory}
                        className="w-full py-4 text-orange-600 text-sm font-bold hover:bg-orange-50 rounded-2xl transition border-2 border-dashed border-orange-200 mt-4 mb-6"
                      >
                        {fetchingHistory ? 'Loading...' : 'Load More Transactions'}
                      </button>
                    ) : (historyTransactions?.length || 0) > 0 && (
                      <p className="text-center text-xs text-gray-400 py-6 font-medium italic">End of transaction history</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Top Up Modal */}
      {
        showTopUp && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Top Up Wallet</h3>
                <button onClick={() => setShowTopUp(false)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-2">Select Amount</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {presetAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopUpAmount(amt.toString())}
                    className={`py-2 rounded-lg border text-sm font-medium transition ${topUpAmount === amt.toString() ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600'}`}
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <span className="absolute left-4 top-3.5 font-bold text-gray-400">₱</span>
                <input
                  type="number"
                  className="w-full p-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 outline-none"
                  placeholder="Enter amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
              </div>

              <p className="text-sm text-gray-600 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { id: 'gcash', name: 'GCash', icon: Smartphone },
                  { id: 'maya', name: 'Maya', icon: CreditCard },
                  { id: 'bank_deposit', name: 'Bank', icon: Building2 }
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition ${paymentMethod === method.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                  >
                    <method.icon size={20} className={paymentMethod === method.id ? 'text-orange-500' : 'text-gray-500'} />
                    <span className={`text-xs font-bold mt-1 ${paymentMethod === method.id ? 'text-orange-600' : 'text-gray-600'}`}>{method.name}</span>
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-4 focus:border-orange-500 outline-none"
                placeholder="Reference number (optional)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />

              <p className="text-sm text-gray-600 mb-2">Proof of Payment *</p>
              {proofPreview ? (
                <div className="relative mb-4">
                  <img src={proofPreview} alt="Proof" className="w-full h-48 object-cover rounded-xl border-2 border-gray-200" />
                  <button
                    onClick={() => { setProofImage(null); setProofPreview(null); }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition mb-4">
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Upload screenshot</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm mb-4">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTopUp(false)}
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopUp}
                  disabled={submitting || !topUpAmount || !proofImage}
                  className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-3">Your request will be reviewed within 24 hours</p>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default WalletView;
