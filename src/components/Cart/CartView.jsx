import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, Trash2, ShoppingBag, Banknote, Wallet, Coins, Loader, CheckCircle } from 'lucide-react';

const API_URL = '/api';

const CartView = ({ cart, setCart, setView }) => {
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'wallet', 'coins'
    const [balances, setBalances] = useState({ wallet: 0, coins: 0 });
    const [instructions, setInstructions] = useState('');
    const [substitutionPreference, setSubstitutionPreference] = useState('call'); // 'cancel', 'call'
    const [loading, setLoading] = useState(false);
    const [fetchingBalances, setFetchingBalances] = useState(true);

    // Calculate Total
    const validCartItems = useMemo(() => {
        return Array.isArray(cart) ? cart.filter(item => item && typeof item === 'object') : [];
    }, [cart]);

    const subtotal = validCartItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const deliveryFee = 49.00;
    const total = subtotal + deliveryFee;

    // Fetch Balances on Mount
    useEffect(() => {
        const fetchBalances = async () => {
            try {
                const token = sessionStorage.getItem('accessToken');
                const headers = { 'Authorization': `Bearer ${token}` };

                // Parallel fetch for speed
                const [walletRes, coinsRes] = await Promise.all([
                    fetch(`${API_URL}/wallet`, { headers }),
                    fetch(`${API_URL}/coins`, { headers })
                ]);

                const walletData = await walletRes.json();
                const coinsData = await coinsRes.json();

                setBalances({
                    wallet: walletData.success ? parseFloat(walletData.data.balance) : 0,
                    coins: coinsData.success ? parseFloat(coinsData.data.balance) : 0
                });
            } catch (e) {
                console.error("Failed to fetch balances", e);
            } finally {
                setFetchingBalances(false);
            }
        };
        fetchBalances();
    }, []);

    const removeItem = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const handleCheckout = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('accessToken');

            // Check if it's a Store Order
            const isStoreOrder = validCartItems.some(item => item.storeId);
            const storeId = isStoreOrder ? validCartItems[0].storeId : null;
            const restaurantId = !isStoreOrder && validCartItems.length > 0 ? (validCartItems[0].restaurant_id || 1) : (!isStoreOrder ? 1 : null);

            const response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    restaurantId, // Will be null for store orders
                    storeId,      // New field
                    orderType: isStoreOrder ? 'store' : 'food',
                    items: validCartItems,
                    total,
                    paymentMethod,
                    instructions,
                    substitutionPreference
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Order Placed Successfully via ${paymentMethod.toUpperCase()}!`);
                setCart([]); // Clear cart
                setView('transactions'); // Redirect to orders
            } else {
                alert("Order Failed: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Checkout Error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-32 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 p-5 bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100 shadow-sm">
                <button
                    onClick={() => setView('home')}
                    className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
                >
                    <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Your Basket</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{validCartItems.length} Items</p>
                </div>
            </div>

            <div className="px-5 mt-6">

                {validCartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-32 h-32 bg-orange-50 rounded-[3rem] flex items-center justify-center mb-6 shadow-inner border border-orange-100/50">
                            <ShoppingBag size={56} className="text-orange-400 opacity-80" />
                        </div>
                        <h3 className="font-black text-gray-900 text-2xl tracking-tight">Empty Basket</h3>
                        <p className="text-slate-500 font-medium mt-3 max-w-[240px] leading-relaxed">
                            Your basket is hungry! Add some delicious treats to get started.
                        </p>
                        <button
                            onClick={() => setView('home')}
                            className="mt-10 hero-gradient text-white font-black py-4 px-12 rounded-[2rem] shadow-xl shadow-orange-600/20 active:scale-95 transition-all"
                        >
                            Browse Restaurants
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Items List */}
                        <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Order Items</h3>
                            {validCartItems.map((item, index) => (
                                <div key={index} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4 group">
                                    <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0 shadow-inner">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-300">NO IMAGE</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-extrabold text-gray-900 text-[15px] line-clamp-1 tracking-tight mb-1">{item.name || 'Unknown Item'}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-orange-600">₱{parseFloat(item.price || 0).toFixed(2)}</span>
                                            <span className="text-[10px] text-slate-300 font-bold">• Qty: 1</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                    >
                                        <Trash2 size={20} strokeWidth={2.5} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Payment Options */}
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 mb-8">
                            <h3 className="font-black text-gray-900 mb-5 tracking-tight flex items-center gap-2">
                                <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                    <Banknote size={18} />
                                </div>
                                Payment Method
                            </h3>
                            <div className="space-y-3">

                                {/* Cash */}
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] border-2 transition-all duration-300 active:scale-[0.98] ${paymentMethod === 'cash' ? 'border-orange-600 bg-orange-50/30' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-100'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl transition-colors ${paymentMethod === 'cash' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-slate-400 shadow-sm'}`}>
                                            <Banknote size={20} />
                                        </div>
                                        <span className={`font-black text-sm tracking-tight ${paymentMethod === 'cash' ? 'text-gray-900' : 'text-slate-500'}`}>Cash on Delivery</span>
                                    </div>
                                    {paymentMethod === 'cash' && <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/20"><CheckCircle size={14} className="text-white" strokeWidth={4} /></div>}
                                </button>

                                {/* Wallet */}
                                <button
                                    onClick={() => balances.wallet >= total && setPaymentMethod('wallet')}
                                    disabled={balances.wallet < total}
                                    className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] border-2 transition-all duration-300 active:scale-[0.98] ${paymentMethod === 'wallet' ? 'border-orange-600 bg-orange-50/30' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-100'} ${balances.wallet < total ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl transition-colors ${paymentMethod === 'wallet' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-slate-400 shadow-sm'}`}>
                                            <Wallet size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className={`font-black text-sm tracking-tight block ${paymentMethod === 'wallet' ? 'text-gray-900' : 'text-slate-500'}`}>Hungr Wallet</span>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Balance: ₱{balances.wallet.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    {paymentMethod === 'wallet' && <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/20"><CheckCircle size={14} className="text-white" strokeWidth={4} /></div>}
                                </button>

                                {/* Coins */}
                                <button
                                    onClick={() => balances.coins >= total && setPaymentMethod('coins')}
                                    disabled={balances.coins < total}
                                    className={`w-full flex items-center justify-between p-4 rounded-[1.5rem] border-2 transition-all duration-300 active:scale-[0.98] ${paymentMethod === 'coins' ? 'border-orange-600 bg-orange-50/30' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-100'} ${balances.coins < total ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl transition-colors ${paymentMethod === 'coins' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-slate-400 shadow-sm'}`}>
                                            <Coins size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className={`font-black text-sm tracking-tight block ${paymentMethod === 'coins' ? 'text-gray-900' : 'text-slate-500'}`}>Hungr Coins</span>
                                            <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">Balance: {balances.coins}</span>
                                        </div>
                                    </div>
                                    {paymentMethod === 'coins' && <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/20"><CheckCircle size={14} className="text-white" strokeWidth={4} /></div>}
                                </button>

                            </div>
                        </div>

                        {/* Bill Summary */}
                        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl mb-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <h3 className="font-black mb-5 tracking-widest text-[10px] uppercase text-slate-400">Payment Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm font-bold opacity-80">
                                    <span className="text-slate-400">Items Subtotal</span>
                                    <span className="text-white">₱{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold opacity-80">
                                    <span className="text-slate-400">Delivery Fee</span>
                                    <span className="text-emerald-400">₱{deliveryFee.toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-white/10 my-4 shadow-sm"></div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black tracking-tight">Total Amount</span>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-orange-500">₱{total.toFixed(2)}</span>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Tax Included</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Special Instructions */}
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 mb-8">
                            <h3 className="font-black text-gray-900 mb-4 tracking-tight flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <ShoppingBag size={18} />
                                </div>
                                Notes for Merchant
                            </h3>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder='e.g. "No onions please", "I have a peanut allergy"'
                                className="w-full p-5 rounded-2xl border-none bg-slate-50 text-[13px] font-semibold text-slate-700 focus:ring-4 focus:ring-orange-600/10 transition-all min-h-[120px] resize-none shadow-inner"
                            />

                            <div className="mt-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Substitution Preference</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setSubstitutionPreference('cancel')}
                                        className={`p-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${substitutionPreference === 'cancel' ? 'border-orange-600 bg-orange-50 text-orange-600 shadow-lg shadow-orange-600/10' : 'border-slate-50 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        Cancel Order
                                    </button>
                                    <button
                                        onClick={() => setSubstitutionPreference('call')}
                                        className={`p-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 ${substitutionPreference === 'call' ? 'border-orange-600 bg-orange-50 text-orange-600 shadow-lg shadow-orange-600/10' : 'border-slate-50 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        Call for Updates
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`w-full hero-gradient text-white font-black py-5 rounded-[2.5rem] shadow-2xl shadow-orange-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-4 mb-20 disabled:grayscale disabled:opacity-50`}
                            onClick={handleCheckout}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-3"><Loader className="animate-spin" size={24} strokeWidth={3} /> PROCESSING ORDER...</span>
                            ) : (
                                <>
                                    <span className="text-lg tracking-tight">PLACE ORDER</span>
                                    <div className="w-px h-6 bg-white/30 hidden sm:block"></div>
                                    <span className="text-lg tabular-nums">₱{total.toFixed(2)}</span>
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CartView;
