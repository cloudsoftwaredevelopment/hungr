import React from 'react';
import { Home, List, ShoppingBag, Wallet, User as UserIcon } from 'lucide-react';

const BottomNav = ({ view, setView, cartCount }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 md:max-w-md md:mx-auto">
    <button onClick={() => setView('home')} className={`flex flex-col items-center ${view === 'home' ? 'text-orange-600' : 'text-gray-400'}`}>
      <Home size={24} />
      <span className="text-[10px] font-bold mt-1">Home</span>
    </button>
    <button onClick={() => setView('transactions')} className={`flex flex-col items-center ${view === 'transactions' ? 'text-orange-600' : 'text-gray-400'}`}>
      <List size={24} />
      <span className="text-[10px] font-bold mt-1">Orders</span>
    </button>
    <div className="relative -top-5">
      <button onClick={() => setView('cart')} className="bg-orange-600 text-white p-4 rounded-full shadow-lg shadow-orange-200 hover:scale-105 transition">
        <ShoppingBag size={24} />
        {cartCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
            {cartCount}
          </span>
        )}
      </button>
    </div>
    <button onClick={() => setView('wallet')} className={`flex flex-col items-center ${view === 'wallet' ? 'text-orange-600' : 'text-gray-400'}`}>
      <Wallet size={24} />
      <span className="text-[10px] font-bold mt-1">Wallet</span>
    </button>
    <button onClick={() => setView('profile')} className={`flex flex-col items-center ${view === 'profile' ? 'text-orange-600' : 'text-gray-400'}`}>
      <UserIcon size={24} />
      <span className="text-[10px] font-bold mt-1">Profile</span>
    </button>
  </div>
);

export default BottomNav;
