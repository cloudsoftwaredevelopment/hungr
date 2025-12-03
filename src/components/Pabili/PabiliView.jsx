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
    <div className="pb-20 animate-in slide-in-from-right">
        {/* Local Header / Breadcrumbs could go here if needed, but we rely on App header for now */}
        {error && <ErrorBanner message={error} />}

        {/* PABILI: STORE LIST VIEW */}
        {internalView === 'stores' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-700 mb-2">Select a Store</h2>
            {loading ? <Loader className="animate-spin mx-auto text-orange-600" /> : 
              pabiliStores.length === 0 ? <p className="text-center text-gray-400">No stores found nearby.</p> :
              pabiliStores.map(store => (
                <div 
                  key={store.id} 
                  onClick={() => handlePabiliStoreSelect(store)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-orange-200 transition"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🏪</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">{store.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {store.address || '1.2 km away'}
                    </p>
                    <p className="text-xs text-orange-600 font-semibold mt-1">
                      ~10-15 mins travel time
                    </p>
                  </div>
                  <ChevronLeft size={20} className="rotate-180 text-gray-300" />
                </div>
              ))
            }
          </div>
        )}

        {/* PABILI: ORDER FORM VIEW */}
        {internalView === 'form' && (
          <div className="space-y-6">
            <button 
                onClick={() => setInternalView('stores')}
                className="flex items-center gap-1 text-gray-500 hover:text-orange-600 transition mb-2"
            >
                <ChevronLeft size={20} /> Change Store
            </button>
            <h2 className="text-xl font-bold mb-4">Buy from {selectedPabiliStore?.name}</h2>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <ShoppingBag size={18} className="text-orange-600" /> Shopping List
              </h3>
              
              <div className="space-y-3">
                {pabiliItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="Item Name (e.g., Eggs)"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-l-xl focus:border-orange-500 outline-none text-sm"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-1/3">
                      <input 
                        type="text" 
                        placeholder="Qty"
                        className="w-full p-3 bg-gray-50 border-y border-r border-gray-200 rounded-r-xl focus:border-orange-500 outline-none text-sm"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => removePabiliItem(idx)}
                      className={`p-3 text-gray-400 hover:text-red-500 transition ${pabiliItems.length === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={addPabiliItem}
                className="mt-4 text-orange-600 text-sm font-bold flex items-center gap-2 hover:bg-orange-50 px-3 py-2 rounded-lg transition"
              >
                <Plus size={16} /> Add another item
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <DollarSign size={18} className="text-orange-600" /> Estimated Cost
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                How much cash should the rider bring to purchase these items?
              </p>
              <div className="relative">
                <span className="absolute left-4 top-3.5 font-bold text-gray-400">₱</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full p-3 pl-8 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:border-orange-500 outline-none"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin size={18} className="text-orange-600" /> Delivery Address
              </h3>
              <p className="text-sm bg-gray-50 p-3 rounded-xl text-gray-600 border border-gray-200">
                {user?.address || "Please set your address in profile"}
              </p>
            </div>

            <button 
              onClick={submitPabiliOrder}
              disabled={loading}
              className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Finding Rider...' : 'Find Rider'}
            </button>
          </div>
        )}

        {/* PABILI: TRACKING VIEW */}
        {internalView === 'tracking' && pabiliOrder && (
          <div className="text-center py-10 animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <Bike size={48} className="text-green-600" />
              <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-md">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Sent!</h2>
            <p className="text-gray-500 mb-8 px-8">
              We are looking for a rider near <b>{selectedPabiliStore?.name}</b>.
            </p>

            <div className="bg-white rounded-2xl mx-4 p-6 shadow-sm border border-gray-100 text-left space-y-6 relative overflow-hidden">
               <div className="absolute left-9 top-10 bottom-10 w-0.5 bg-gray-100"></div>

               {['Pending Confirmation', 'Driving to store', 'Gathering Items', 'Falling in line to pay', 'Coming to your address'].map((step, i) => (
                 <div key={i} className="flex items-center gap-4 relative z-10">
                   <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 
                     ${i === 0 ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-300'}`}>
                     {i === 0 ? '✓' : i + 1}
                   </div>
                   <span className={i === 0 ? 'font-bold text-green-700' : 'text-gray-400'}>{step}</span>
                 </div>
               ))}
            </div>

            <button onClick={() => setView('home')} className="mt-8 text-orange-600 font-bold text-sm">
              Back to Home
            </button>
          </div>
        )}
    </div>
  );
};

export default PabiliView;
