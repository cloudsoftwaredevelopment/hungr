/**
 * CoinDisplay.jsx
 * Displays Hungr Coins icon (clickable to go to wallet)
 */

import React from 'react';

export default function CoinDisplay({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1 cursor-pointer hover:opacity-80 transition p-2"
      title="Hungr Coins - Click to view wallet"
    >
      <span className="text-lg">🪙</span>
    </button>
  );
}
