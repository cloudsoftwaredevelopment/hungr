import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, MapPin, ChevronLeft, X, Plus, DollarSign, Bike, Loader, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const PabiliView = ({ setView }) => {
  const { user, isAuthenticated } = useAuth();

  // Internal State
  const [internalView, setInternalView] = useState('stores'); // stores, form, tracking
  const [pabiliStores, setPabiliStores] = useState([]);
  const [selectedPabiliStore, setSelectedPabiliStore] = useState(null);
  const [pabiliItems, setPabiliItems] = useState([{ name: '', qty: '' }]);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [pabiliOrder, setPabiliOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false); // Local auth modal trigger if needed

  useEffect(() => {
    fetchPabiliStores();
  }, []);

  const fetchPabiliStores = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/pabili/stores`);
      const data = await response.json();
      if (data.success) setPabiliStores(data.data);
      else throw new Error("No stores");
    } catch (err) {
      // Demo Data Fallback
      setPabiliStores([
        { id: 101, name: "7-Eleven", address: "Corner St.", rating: 4.5 },
        { id: 102, name: "Mercury Drug", address: "Main Ave.", rating: 4.8 },
        { id: 103, name: "Uncle John's", address: "Plaza", rating: 4.2 },
        { id: 104, name: "Robinsons Supermarket", address: "Mall Level 1", rating: 4.7 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submitPabiliOrder = async () => {
    if (!isAuthenticated) {
      // If not authenticated, we redirect to profile which handles auth or show alert
      alert("Please login to continue");
      // In a full implementation, you might pass a prop to trigger the global auth modal
      return;
    }

    const validItems = pabiliItems.filter(i => i.name.trim() !== '');
    if (validItems.length === 0) return setError('Please add at least one item');
    if (!estimatedCost) return setError('Please enter an estimated cost');

    setLoading(true);
    const payload = {
      storeId: selectedPabiliStore.id,
      items: validItems,
      estimatedCost: parseFloat(estimatedCost),
      deliveryAddress: user?.address || 'Current Location',
      recipient: user?.username,
      mobile: user?.phone_number
    };

    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/pabili/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        setPabiliOrder({ ...payload, id: data.data.orderId, status: 'pending' });
        setInternalView('tracking');
        setPabiliItems([{ name: '', qty: '' }]);
        setEstimatedCost('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      // Demo Success Logic
      setPabiliOrder({ ...payload, id: Date.now(), status: 'pending' });
      setInternalView('tracking');
      setPabiliItems([{ name: '', qty: '' }]);
      setEstimatedCost('');
    } finally {
      setLoading(false);
    }
  };

  const handlePabiliStoreSelect = (store) => {
    setSelectedPabiliStore(store);
    setInternalView('form');
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...pabiliItems];
    newItems[index][field] = value;
    setPabiliItems(newItems);
  };

  const addPabiliItem = () => setPabiliItems([...pabiliItems, { name: '', qty: '' }]);

  const removePabiliItem = (index) => {
    if (pabiliItems.length > 1) {
      const newItems = pabiliItems.filter((_, i) => i !== index);
      setPabiliItems(newItems);
    }
  };

  const ErrorBanner = ({ message }) => (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
      <AlertCircle size={18} />
      <span className="text-sm">{message}</span>
      <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
    </div>
  );

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
            Hungr <span className="text-orange-600 italic">Pabili</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Buy anything, anytime</p>
        </div>
      </div>

      <div className="p-5">
        {error && <ErrorBanner message={error} />}

        {/* PABILI: STORE LIST VIEW */}
        {internalView === 'stores' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Select a Merchant</h2>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-orange-100 rounded-full border-t-orange-600 animate-spin mb-4"></div>
                <p className="text-sm font-black text-slate-400">Finding nearby shops...</p>
              </div>
            ) : pabiliStores.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100">
                <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">No shops available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pabiliStores.map(store => (
                  <div
                    key={store.id}
                    onClick={() => handlePabiliStoreSelect(store)}
                    className="bg-white p-5 rounded-[2.2rem] shadow-sm border border-slate-50 flex items-center gap-5 cursor-pointer hover:shadow-xl hover:border-orange-200 transition-all duration-300 group active:scale-[0.98]"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                      🏪
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-gray-900 uppercase tracking-tight group-hover:text-orange-600 transition-colors">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <MapPin size={12} className="text-slate-300" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">
                          {store.address || 'Near your location'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black italic">
                          ~15 MINS TRAVEL
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-orange-600 group-hover:text-white transition-all">
                      <ChevronLeft size={20} className="rotate-180" strokeWidth={3} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PABILI: ORDER FORM VIEW */}
        {internalView === 'form' && (
          <div className="space-y-8 pb-10">
            <button
              onClick={() => setInternalView('stores')}
              className="inline-flex items-center gap-2 bg-slate-100 py-2.5 px-5 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
            >
              <ChevronLeft size={16} strokeWidth={3} /> Change Shop
            </button>

            <div className="relative">
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-tight">
                Shopping at<br />
                <span className="text-orange-600">{selectedPabiliStore?.name}</span>
              </h2>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50">
              <h3 className="font-black text-gray-900 mb-6 flex items-center gap-3 text-sm uppercase tracking-widest">
                <ShoppingBag size={18} className="text-orange-600" strokeWidth={3} /> Shopping List
              </h3>

              <div className="space-y-4">
                {pabiliItems.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-center group">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="What to buy? (e.g. Eggs)"
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all text-sm font-black shadow-inner"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="text"
                        placeholder="Qty"
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all text-sm font-black text-center shadow-inner"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => removePabiliItem(idx)}
                      className={`p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all active:scale-90 ${pabiliItems.length === 1 ? 'hidden' : ''}`}
                    >
                      <X size={18} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addPabiliItem}
                className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs font-black uppercase tracking-widest hover:border-orange-200 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={3} /> Add Item
              </button>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50">
              <h3 className="font-black text-gray-900 mb-2 flex items-center gap-3 text-sm uppercase tracking-widest">
                <DollarSign size={18} className="text-orange-600" strokeWidth={3} /> Estimated Cost
              </h3>
              <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                Cash amount for the rider
              </p>
              <div className="relative">
                <span className="absolute left-5 top-5 font-black text-slate-300 text-xl">₱</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full p-5 pl-10 bg-slate-50 border-none rounded-[1.8rem] font-black text-2xl focus:ring-4 focus:ring-orange-600/10 focus:bg-white transition-all shadow-inner"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <MapPin size={100} strokeWidth={1} />
              </div>
              <h3 className="font-black text-gray-900 mb-4 flex items-center gap-3 text-sm uppercase tracking-widest">
                <MapPin size={18} className="text-orange-600" strokeWidth={3} /> Delivery Goal
              </h3>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Address</p>
                <p className="text-sm font-black text-gray-800 leading-tight">
                  {user?.address || "NO ADDRESS SET"}
                </p>
              </div>
            </div>

            <button
              onClick={submitPabiliOrder}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-orange-900/40 active:scale-95 transition-all text-sm uppercase tracking-[0.2em] transform hover:-translate-y-1"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader className="animate-spin" size={20} strokeWidth={3} />
                  FINDING RIDER...
                </div>
              ) : 'BROADCAST REQUEST'}
            </button>
          </div>
        )}

        {/* PABILI: TRACKING VIEW */}
        {internalView === 'tracking' && pabiliOrder && (
          <div className="text-center py-10 animate-in zoom-in duration-500">
            <div className="relative w-48 h-48 mx-auto mb-10">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
              <div className="absolute inset-4 bg-emerald-500/20 rounded-full animate-pulse delay-75"></div>
              <div className="relative w-48 h-48 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)] border-8 border-white">
                <Bike size={80} className="text-white drop-shadow-lg" strokeWidth={1.5} />
              </div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight uppercase">Searching!</h2>
            <p className="text-slate-400 font-bold text-sm px-8 leading-relaxed uppercase tracking-widest">
              Looking for a nearby rider at <b>{selectedPabiliStore?.name}</b>
            </p>

            <div className="bg-white rounded-[2.5rem] m-6 p-8 shadow-2xl border border-slate-50 text-left space-y-8 relative overflow-hidden">
              <div className="absolute left-[3.1rem] top-12 bottom-12 w-0.5 bg-slate-100"></div>

              {[
                { label: 'Broadcast Sent', active: true },
                { label: 'Rider Acceptance', active: false },
                { label: 'Shopping Progress', active: false },
                { label: 'Final Delivery', active: false }
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-5 relative z-10 group">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-lg transition-all 
                         ${step.active ? 'bg-emerald-500 text-white scale-110' : 'bg-slate-100 text-slate-300'}`}>
                    {step.active ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-black uppercase tracking-widest ${step.active ? 'text-gray-900' : 'text-slate-300'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setView('home')}
              className="mt-6 px-10 py-4 bg-slate-900 text-white font-black rounded-full text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
            >
              TRACK IN HISTORY
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PabiliView;
