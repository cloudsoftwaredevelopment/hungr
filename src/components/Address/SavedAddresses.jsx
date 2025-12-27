import React, { useState, useEffect } from 'react';
import { Plus, MapPin, ChevronLeft, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const SavedAddresses = ({ setView }) => {
    const { user } = useAuth();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${API_URL}/users/addresses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setAddresses(data.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this address?')) return;

        try {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${API_URL}/users/addresses/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                // Optimistic UI update or Refetch
                setAddresses(prev => prev.filter(a => a.id !== id));
            } else {
                alert(data.error || "Failed to delete");
            }
        } catch (e) {
            alert("Delete failed");
        }
    };

    return (
        <div className="pb-32 font-sans bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 px-5 pt-6 pb-4 border-b border-slate-100 shadow-sm flex items-center gap-4">
                <button
                    onClick={() => setView('profile')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-all active:scale-95"
                >
                    <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                        Saved <span className="text-orange-600 italic">Places</span>
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Manage your locations</p>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-orange-100 rounded-full border-t-orange-600 animate-spin mb-4"></div>
                        <p className="text-sm font-black text-slate-400">Loading addresses...</p>
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100">
                        <MapPin size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-black text-sm uppercase tracking-widest">No saved addresses</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {addresses.map(addr => (
                            <div key={addr.id} className="bg-white p-5 rounded-[2.2rem] shadow-sm border border-slate-50 flex items-start gap-5 group hover:shadow-xl hover:border-orange-200 transition-all duration-300">
                                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                                    <MapPin size={24} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1">
                                    <span className="inline-block bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest mb-1.5 shadow-sm">
                                        {addr.label}
                                    </span>
                                    <p className="text-sm font-black text-gray-800 leading-tight uppercase tracking-tight">{addr.address}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(addr.id)}
                                    className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                >
                                    <Trash2 size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        ))
                        }
                    </div>
                )}

                <button
                    onClick={() => setView('address-editor')}
                    className="w-full py-5 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all duration-300 active:scale-95 shadow-sm"
                >
                    <Plus size={20} strokeWidth={3} /> Add New Address
                </button>
            </div>
        </div>
    )
}

export default SavedAddresses;
