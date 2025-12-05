import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('https://nfcrevolution.com/hungr/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('token', data.data.token);
        sessionStorage.setItem('user', JSON.stringify(data.data));
        window.location.href = '/hungr/'; 
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          {/* Logo Only */}
          <div className="flex items-center justify-center">
            <img 
              src="https://nfcrevolution.com/hungr/registration/image_0.png" 
              alt="Hungr Official Logo" 
              className="h-32 w-auto object-contain"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 tracking-wide">Email Address</label>
            <div className="relative group">
              <User className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-800 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all placeholder:text-gray-400 font-medium"
                placeholder="name@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 tracking-wide">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-800 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all placeholder:text-gray-400 font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 transition-all mt-4 active:scale-[0.98]"
          >
            {loading ? <Loader className="animate-spin" /> : <>Login <ArrowRight size={20} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
                Don't have an account? <span className="text-orange-600 font-bold cursor-pointer hover:underline">Register (Closed)</span>
            </p>
        </div>
      </div>
    </div>
  );
}
