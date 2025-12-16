import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

const CoinDisplay = ({ onClick }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/coins`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBalance(data.data.balance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch coin balance', error);
    }
  };

  // Don't show if not logged in
  if (!user) return null;

  return (
    <button onClick={onClick} className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-yellow-300 transition cursor-pointer">
      <div className="w-4 h-4 rounded-full bg-yellow-200 border-2 border-yellow-600 flex items-center justify-center text-[8px]">$</div>
      <span>{balance}</span>
    </button>
  );
};

export default CoinDisplay;
