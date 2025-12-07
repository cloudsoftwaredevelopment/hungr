import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, Trash2, ShoppingBag, Banknote, Wallet, Coins, Loader, CheckCircle } from 'lucide-react';

const API_URL = '/api';

const CartView = ({ cart, setCart, setView }) => {
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'wallet', 'coins'
    const [balances, setBalances] = useState({ wallet: 0, coins: 0 });
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
                    paymentMethod
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
        <div className="animate-in slide-in-from-right pb-24 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-white shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => setView('home')}
                    className="p-2 hover:bg-gray-100 rounded-full transition"
                >
                    <ChevronLeft size={24} className="text-gray-700" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">Your Basket</h2>
            </div>

            <div className="px-4">
                {validCartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag size={40} className="text-orange-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Your cart is empty</h3>
                        <p className="text-gray-500 text-sm mt-2 max-w-[200px]">
                            Looks like you haven't added anything to your cart yet.
                        </p>
                        <button
                            onClick={() => setView('home')}
                            className="mt-6 bg-orange-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-200 active:scale-95 transition"
                        >
                            Start Ordering
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Items List */}
                        <div className="space-y-4 mb-6">
                            {validCartItems.map((item, index) => (
                                <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-gray-200" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">No Img</div>
                                    )}
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{item.name || 'Unknown Item'}</h3>
                                        <p className="text-orange-600 font-bold text-sm">₱{parseFloat(item.price || 0).toFixed(2)}</p>
                                    </div>
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Payment Options */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                            <h3 className="font-bold text-gray-900 mb-3">Payment Method</h3>
                            <div className="space-y-2">

                                {/* Cash */}
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${paymentMethod === 'cash' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                            <Banknote size={20} />
                                        </div>
                                        <span className="font-bold text-sm text-gray-700">Cash on Delivery</span>
                                    </div>
                                    {paymentMethod === 'cash' && <CheckCircle size={18} className="text-orange-500" />}
                                </button>

                                {/* Wallet */}
                                <button
                                    onClick={() => balances.wallet >= total && setPaymentMethod('wallet')}
                                    disabled={balances.wallet < total}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${paymentMethod === 'wallet' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'} ${balances.wallet < total ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                            <Wallet size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-bold text-sm text-gray-700 block">Hungr Wallet</span>
                                            <span className="text-xs text-gray-500">Bal: ₱{balances.wallet.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    {paymentMethod === 'wallet' && <CheckCircle size={18} className="text-orange-500" />}
                                </button>

                                {/* Coins */}
                                <button
                                    onClick={() => balances.coins >= total && setPaymentMethod('coins')}
                                    disabled={balances.coins < total}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition ${paymentMethod === 'coins' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'} ${balances.coins < total ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                                            <Coins size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-bold text-sm text-gray-700 block">Hungr Coins</span>
                                            <span className="text-xs text-gray-500">Bal: {balances.coins}</span>
                                        </div>
                                    </div>
                                    {paymentMethod === 'coins' && <CheckCircle size={18} className="text-orange-500" />}
                                </button>

                            </div>
                        </div>

                        {/* Bill Summary */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                            <h3 className="font-bold text-gray-900 mb-3">Payment Summary</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-gray-500">
                                    <span>Subtotal</span>
                                    <span>₱{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>Delivery Fee</span>
                                    <span>₱{deliveryFee.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-100 my-2 pt-2 flex justify-between font-bold text-lg text-gray-900">
                                    <span>Total</span>
                                    <span>₱{total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition flex justify-between px-6 mb-10 disabled:opacity-70"
                            onClick={handleCheckout}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2 mx-auto"><Loader className="animate-spin" size={20} /> Processing...</span>
                            ) : (
                                <>
                                    <span>Checkout ({paymentMethod.toUpperCase()})</span>
                                    <span>₱{total.toFixed(2)}</span>
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
