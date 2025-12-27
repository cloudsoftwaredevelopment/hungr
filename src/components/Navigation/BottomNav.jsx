import React from 'react';
import { Home, List, ShoppingBag, Wallet, User as UserIcon } from 'lucide-react';

const BottomNav = ({ view, setView, cartCount }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-100 px-6 py-4 flex justify-between items-center z-50 md:max-w-md md:mx-auto rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
    <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 transition-all ${view === 'home' ? 'text-orange-600 scale-110' : 'text-slate-400 opacity-60'}`}>
      <Home size={22} strokeWidth={view === 'home' ? 3 : 2} />
      <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
    </button>
    <button onClick={() => setView('transactions')} className={`flex flex-col items-center gap-1 transition-all ${view === 'transactions' ? 'text-orange-600 scale-110' : 'text-slate-400 opacity-60'}`}>
      <List size={22} strokeWidth={view === 'transactions' ? 3 : 2} />
      <span className="text-[9px] font-black uppercase tracking-widest">Orders</span>
    </button>

    <div className="relative -top-3">
      <div className="absolute inset-0 bg-orange-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
      <button
        onClick={() => setView('cart')}
        className="relative bg-gradient-to-br from-orange-600 to-red-600 text-white p-5 rounded-full shadow-[0_15px_30px_rgba(234,88,12,0.4)] hover:scale-110 active:scale-95 transition-all border-4 border-white"
      >
        <ShoppingBag size={24} strokeWidth={2.5} />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-lg">
            {cartCount}
          </span>
        )}
      </button>
    </div>

    <button onClick={() => setView('wallet')} className={`flex flex-col items-center gap-1 transition-all ${view === 'wallet' ? 'text-orange-600 scale-110' : 'text-slate-400 opacity-60'}`}>
      <Wallet size={22} strokeWidth={view === 'wallet' ? 3 : 2} />
      <span className="text-[9px] font-black uppercase tracking-widest">Wallet</span>
    </button>
    <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 transition-all ${view === 'profile' ? 'text-orange-600 scale-110' : 'text-slate-400 opacity-60'}`}>
      <UserIcon size={22} strokeWidth={view === 'profile' ? 3 : 2} />
      <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
    </button>
  </div>
);

export default BottomNav;
