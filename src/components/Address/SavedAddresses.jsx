import React from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SavedAddresses = ({ setView }) => {
    const { user } = useAuth();
    return (
        <div className="animate-in slide-in-from-right pb-20">
            <h2 className="text-lg font-bold mb-4">Saved Addresses</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded">Home</span>
                        <p className="mt-2 text-sm text-gray-700">{user?.address || 'No address set'}</p>
                    </div>
                </div>
            </div>
            <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-bold text-sm mt-4 flex items-center justify-center gap-2 hover:border-orange-300 hover:text-orange-500 transition">
                <Plus size={16} /> Add New Address
            </button>
            <button onClick={() => setView('profile')} className="mt-6 text-center w-full text-gray-400 text-sm">Back to Profile</button>
        </div>
    )
}

export default SavedAddresses;
