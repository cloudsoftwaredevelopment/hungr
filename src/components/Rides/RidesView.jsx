import React, { useState } from 'react';
import { MapPin, Navigation, ChevronLeft, Bike, Car, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RidesView() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedType, setSelectedType] = useState('bike');

  return (
    <div className="pb-24 font-sans bg-gray-50 min-h-screen flex flex-col">
      
      {/* --- HEADER --- */}
      <div className="bg-white sticky top-0 z-30 px-4 py-3 shadow-sm border-b border-gray-100">
         <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-black text-gray-800 tracking-tight">BOOK A RIDE</h1>
         </div>

         {/* Ride Type Selector (Themed) */}
         <div className="grid grid-cols-2 gap-3">
             <button 
               onClick={() => setSelectedType('bike')} 
               className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border transition-all ${
                 selectedType === 'bike' 
                   ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200' 
                   : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200'
               }`}
             >
                 <Bike size={18} /> <span className="font-bold text-xs">Motorbike</span>
             </button>
             <button 
               onClick={() => setSelectedType('car')} 
               className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border transition-all ${
                 selectedType === 'car' 
                   ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-200' 
                   : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200'
               }`}
             >
                 <Car size={18} /> <span className="font-bold text-xs">Car</span>
             </button>
        </div>
      </div>

      {/* --- INPUTS --- */}
      <div className="p-4 space-y-4 flex-1">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            {/* Pickup */}
            <div className="flex gap-3">
                <div className="mt-3 flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="w-0.5 h-8 bg-gray-100"></div>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Pick-up Location</label>
                    <div className="relative">
                        <input type="text" value={pickup} onChange={e => setPickup(e.target.value)} className="w-full bg-gray-50 border-none text-gray-800 rounded-lg py-2.5 px-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all" placeholder="Current Location" />
                        <Navigation size={14} className="absolute right-3 top-3 text-blue-500" />
                    </div>
                </div>
            </div>

            {/* Dropoff */}
            <div className="flex gap-3">
                <div className="mt-3 flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Drop-off Location</label>
                    <div className="relative">
                        <input type="text" value={dropoff} onChange={e => setDropoff(e.target.value)} className="w-full bg-gray-50 border-none text-gray-800 rounded-lg py-2.5 px-3 text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all" placeholder="Where to?" />
                        <MapPin size={14} className="absolute right-3 top-3 text-orange-500" />
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      {/* Action Button (Themed) */}
      <div className="p-4 bg-white border-t border-gray-100 sticky bottom-0">
          <button className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center gap-2 hover:bg-orange-700 transition-all active:scale-[0.98]">
              Find Driver <ArrowRight size={20}/>
          </button>
      </div>

    </div>
  );
}
