
import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PabiliOrderForm = ({ store, onCancel }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([{ name: '', quantity: '' }]);
    const [estimatedCost, setEstimatedCost] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddItem = () => {
        setItems([...items, { name: '', quantity: '' }]);
    };

    const handleRemoveItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!estimatedCost || items.some(i => !i.name || !i.quantity)) {
            alert("Please fill in all fields");
            return;
        }

        setLoading(true);
        try {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`https://nfcrevolution.com/hungr/api/pabili/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    store_id: store.id,
                    items,
                    estimated_cost: parseFloat(estimatedCost),
                    delivery_address: user?.address || 'Current Location'
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Order placed! Notified ${data.data.ridersNotified} riders.`);
                // Navigate to order status or back home
                navigate('/');
            } else {
                alert("Failed to place order: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-1 text-gray-800">Order from {store.name}</h2>
            <p className="text-sm text-gray-500 mb-6">List the items you need.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Item (e.g. Eggs)"
                                    value={item.name}
                                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                    required
                                />
                            </div>
                            <div className="w-24">
                                <input
                                    type="text"
                                    placeholder="Qty (1 doz)"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                    required
                                />
                            </div>
                            {items.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-start pt-2">
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-sm font-bold text-orange-600 flex items-center gap-1 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Plus size={16} /> Add More Item
                    </button>
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Total Estimated Cost (₱)
                    </label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                        className="w-full text-lg font-bold bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        required
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                        This amount will be used to match you with riders who have enough wallet balance.
                    </p>
                </div>

                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-3 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {loading ? <Loader className="animate-spin" size={18} /> : <>Submit Request <ArrowRight size={18} /></>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PabiliOrderForm;
