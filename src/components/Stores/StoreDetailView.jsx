import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Clock, Plus, Minus, ShoppingBag } from 'lucide-react';

export default function StoreDetailView({ addToCart }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStoreDetails();
    }, [id]);

    const fetchStoreDetails = async () => {
        setLoading(true);
        try {
            // 1. Fetch Store Info
            // Note: In a real optimized app we might pass this via state, but fetching ensures freshness
            const storeRes = await fetch(`https://nfcrevolution.com/hungr/api/pabili/stores`);
            const storeData = await storeRes.json();
            // Mock finding the specific store from the list for now if single endpoint doesn't exist
            const foundStore = storeData.data.find(s => s.id == id);
            setStore(foundStore);

            // 2. Fetch Products
            const prodRes = await fetch(`https://nfcrevolution.com/hungr/api/stores/${id}/products`);
            const prodData = await prodRes.json();
            if (prodData.success) {
                setProducts(prodData.data);
            } else {
                // Mock products if API fails or is empty for dev
                setProducts([
                    { id: 101, name: "Premium Widget", price: 150.00, image: "https://via.placeholder.com/150", description: "High quality widget for all needs." },
                    { id: 102, name: "Super Gadget", price: 2999.00, image: "https://via.placeholder.com/150", description: "Latest tech gadget." },
                    { id: 103, name: "Daily Necessity", price: 50.00, image: "https://via.placeholder.com/150", description: "Essential daily item." },
                ]);
            }

        } catch (e) {
            console.error(e);
            // Fallback Mock
            if (!store) setStore({ name: "Store " + id, image_url: "", rating: 4.8, category: "General" });
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (product) => {
        // Create a cart item object
        const item = {
            ...product,
            storeId: id,
            storeName: store?.name,
            quantity: 1
        };
        // Call prop function to add to global context
        if (addToCart) addToCart(item);
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
    );

    return (
        <div className="bg-gray-50 min-h-screen pb-20 relative">
            {/* Header Image */}
            <div className="relative h-48 bg-gray-300">
                <img
                    src={store?.image_url || "https://via.placeholder.com/800x400"}
                    className="w-full h-full object-cover"
                    alt={store?.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

                <button
                    onClick={() => navigate('/stores')}
                    className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition"
                >
                    <ChevronLeft size={24} />
                </button>
            </div>

            {/* Store Info */}
            <div className="relative -mt-6 rounded-t-3xl bg-gray-50 px-4 pt-6 pb-4 shadow-sm z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{store?.name}</h1>
                        <p className="text-gray-500 text-sm mt-1">{store?.category || 'Retail Store'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">
                            <Star size={12} fill="currentColor" /> {store?.rating || '4.5'}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                            <Clock size={12} /> 20-40 min
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="px-4">
                <h2 className="font-bold text-lg mb-4 text-gray-800">Products</h2>
                <div className="grid grid-cols-2 gap-4">
                    {products.map(product => (
                        <div key={product.id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col h-full">
                            <div className="aspect-square bg-gray-100 rounded-xl mb-3 overflow-hidden">
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight mb-1">{product.name}</h3>
                                <p className="text-orange-600 font-bold text-sm">₱{parseFloat(product.price).toFixed(2)}</p>
                            </div>
                            <button
                                onClick={() => handleAdd(product)}
                                className="mt-3 w-full bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition-colors py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> Add
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating Cart Button (if items in cart) */}
            <div className="fixed bottom-24 right-4 z-40">
                <button
                    onClick={() => navigate('/cart')}
                    className="bg-orange-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition active:scale-95 flex items-center justify-center"
                >
                    <ShoppingBag size={24} />
                </button>
            </div>

        </div>
    );
}
