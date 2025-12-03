import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Star, ChevronRight, Plus, Loader 
} from 'lucide-react';

const StoresView = ({ setView, addToCart }) => {
  const [internalView, setInternalView] = useState('categories'); // categories, list, detail
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeDetails, setStoreDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initial Load: Categories
  useEffect(() => {
    // Mock Categories for now
    setCategories([
        { id: 'groceries', name: 'Groceries', icon: '🥦', store_count: 12 },
        { id: 'pharmacy', name: 'Pharmacy', icon: '💊', store_count: 8 },
        { id: 'pet', name: 'Pet Supplies', icon: '🐾', store_count: 5 },
        { id: 'electronics', name: 'Electronics', icon: '📱', store_count: 4 }
    ]);
  }, []);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setLoading(true);
    // Mock Store Fetch
    setTimeout(() => {
        setStores([
            { id: 101, name: "All Day Supermarket", category: 'groceries', rating: 4.8, distance: '1.2km', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400' },
            { id: 102, name: "Puregold", category: 'groceries', rating: 4.5, distance: '2.0km', image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=400' },
            { id: 103, name: "Mercury Drug", category: 'pharmacy', rating: 4.9, distance: '0.8km', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=400' }
        ].filter(s => s.category === catId || catId === 'all'));
        setInternalView('list');
        setLoading(false);
    }, 500);
  };

  const handleStoreSelect = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    setSelectedStore(store);
    setLoading(true);
    // Mock Detail Fetch
    setTimeout(() => {
        setStoreDetails({
            ...store,
            products: {
                'Best Sellers': [
                    { id: 1, name: 'Fresh Milk 1L', price: 95, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200' },
                    { id: 2, name: 'Whole Wheat Bread', price: 75, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' }
                ],
                'Snacks': [
                    { id: 3, name: 'Potato Chips', price: 45, image: 'https://images.unsplash.com/photo-1566478919030-261744529942?auto=format&fit=crop&q=80&w=200' }
                ]
            }
        });
        setInternalView('detail');
        setLoading(false);
    }, 500);
  };

  return (
    <div className="pb-20 animate-in slide-in-from-right">
        {/* Navigation Header */}
        <div className="mb-4">
            {internalView === 'categories' ? (
                <h2 className="text-xl font-bold">Store Categories</h2>
            ) : (
                <button 
                    onClick={() => setInternalView(internalView === 'detail' ? 'list' : 'categories')}
                    className="flex items-center gap-1 text-gray-500 hover:text-orange-600 transition"
                >
                    <ChevronLeft size={20} /> Back
                </button>
            )}
        </div>

        {/* CATEGORIES GRID */}
        {internalView === 'categories' && (
            <div className="grid grid-cols-2 gap-4">
                {categories.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => handleCategorySelect(cat.id)}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-orange-200 transition"
                    >
                        <span className="text-4xl">{cat.icon}</span>
                        <div className="text-center">
                            <h3 className="font-bold text-gray-800">{cat.name}</h3>
                            <p className="text-xs text-gray-500">{cat.store_count} stores</p>
                        </div>
                    </button>
                ))}
            </div>
        )}

        {/* STORES LIST */}
        {internalView === 'list' && (
            <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4">{categories.find(c => c.id === selectedCategory)?.name}</h2>
                {loading ? <Loader className="mx-auto animate-spin text-orange-600" /> : stores.map(store => (
                    <div 
                        key={store.id} 
                        onClick={() => handleStoreSelect(store.id)}
                        className="bg-white rounded-xl shadow-sm overflow-hidden flex gap-4 p-3 border border-gray-100 cursor-pointer hover:shadow-md transition"
                    >
                        <img src={store.image} alt={store.name} className="w-20 h-20 object-cover rounded-lg bg-gray-200" />
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{store.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-current"/> {store.rating}</span>
                                <span>•</span>
                                <span>{store.distance}</span>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 self-center" />
                    </div>
                ))}
            </div>
        )}

        {/* STORE DETAILS */}
        {internalView === 'detail' && storeDetails && (
            <div>
                {/* Banner */}
                <div className="relative h-40 rounded-xl overflow-hidden mb-6">
                    <img src={storeDetails.image} alt={storeDetails.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                        <h1 className="text-white text-2xl font-bold">{storeDetails.name}</h1>
                    </div>
                </div>

                {/* Products */}
                {Object.entries(storeDetails.products).map(([cat, items]) => (
                    <div key={cat} className="mb-6">
                        <h3 className="font-bold text-gray-800 mb-3">{cat}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {items.map(item => (
                                <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2 bg-gray-100" />
                                    <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-orange-600 font-bold text-sm">₱{item.price}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); addToCart?.(item, storeDetails); }}
                                            className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center hover:bg-orange-200"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default StoresView;
