import React from 'react';

const CoinDisplay = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-yellow-300 transition cursor-pointer">
    <div className="w-4 h-4 rounded-full bg-yellow-200 border-2 border-yellow-600 flex items-center justify-center text-[8px]">$</div>
    <span>150</span>
  </button>
);

export default CoinDisplay;
