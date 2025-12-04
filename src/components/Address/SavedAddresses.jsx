import React, { useState, useEffect } from 'react';
import { Plus, MapPin, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const SavedAddresses = ({ setView }) => {
    const { user } = useAuth();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        fetchAddresses();
    }, []);

    return (
        <div className="animate-in slide-in-from-right pb-24">
            <div className="flex items-center gap-3 mb-6 p-4 border-b border-gray-50">
                <button onClick={() => setView('profile')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft size={24} />
                </button>
                <h2 className="text-xl font-bold">Saved Addresses</h2>
            </div>

            <div className="px-4 space-y-3">
                {loading ? <p className="text-center text-gray-400">Loading...</p> : addresses.length === 0 ? (
                    <p className="text-center text-gray-400 py-10">No addresses saved yet.</p>
                ) : (
                    addresses.map(addr => (
                        <div key={addr.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-3 items-start">
                            <MapPin className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                            <div>
                                <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase mb-1 inline-block">
                                    {addr.label}
                                </span>
                                <p className="text-sm text-gray-800 leading-snug">{addr.address}</p>
                            </div>
                        </div>
                    ))
                )}

                <button 
                    onClick={() => setView('address-editor')} // Switch to new Editor
                    className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-bold text-sm mt-4 flex items-center justify-center gap-2 hover:border-orange-300 hover:text-orange-500 transition hover:bg-orange-50"
                >
                    <Plus size={18} /> Add New Address
                </button>
            </div>
        </div>
    )
}

export default SavedAddresses;
