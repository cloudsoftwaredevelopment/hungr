import React, { useMemo } from 'react';
import { ChevronLeft, Trash2, ShoppingBag } from 'lucide-react';

const CartView = ({ cart, setCart, setView }) => {
  
  // Safety: Filter out null/undefined items to prevent crashes
  const validCartItems = useMemo(() => {
    return Array.isArray(cart) ? cart.filter(item => item && typeof item === 'object') : [];
  }, [cart]);

  // Safety: Ensure price is a number
  const total = validCartItems.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    return sum + price;
  }, 0);

  const removeItem = (index) => {
    const newCart = [...cart]; // Use original cart to maintain index sync if needed, or filter validCartItems
    newCart.splice(index, 1);
    setCart(newCart);
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

                {/* Bill Summary */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <h3 className="font-bold text-gray-900 mb-3">Payment Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span>
                            <span>₱{total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>Delivery Fee</span>
                            <span>₱49.00</span>
                        </div>
                        <div className="border-t border-gray-100 my-2 pt-2 flex justify-between font-bold text-lg text-gray-900">
                            <span>Total</span>
                            <span>₱{(total + 49).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <button 
                    className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 active:scale-95 transition flex justify-between px-6 mb-10"
                    onClick={() => alert("Checkout not implemented yet")}
                >
                    <span>Checkout</span>
                    <span>₱{(total + 49).toFixed(2)}</span>
                </button>
            </>
        )}
      </div>
    </div>
  );
};

export default CartView;
