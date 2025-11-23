/**
 * BottomNav.jsx
 * Updated bottom navigation: Home, Wallet, Transactions, Inbox
 * Cart button only visible inside restaurant view (floating)
 */

import React from 'react';
import { Home, Wallet, History, Mail } from 'lucide-react';

export default function BottomNav({ view, setView, cartCount }) {
  const navItems = [
    { label: 'Home', view: 'home', icon: Home },
    { label: 'Wallet', view: 'wallet', icon: Wallet },
    { label: 'Transactions', view: 'transactions', icon: History },
    { label: 'Inbox', view: 'inbox', icon: Mail },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-3 px-6 flex justify-between items-center z-50 safe-area-pb md:left-1/2 md:transform md:-translate-x-1/2 md:w-96 md:rounded-t-3xl md:bottom-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = view === item.view;

        return (
          <button
            key={item.view}
            onClick={() => setView(item.view)}
            className={`flex flex-col items-center gap-1 transition ${
              isActive ? 'text-orange-600' : 'text-gray-400'
            }`}
          >
            <Icon size={24} />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
