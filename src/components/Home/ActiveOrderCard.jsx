import React, { useMemo, useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle2, Package, Truck, Utensils } from 'lucide-react';

const ActiveOrderCard = ({ order, onClick }) => {
    if (!order) return null;

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const totalPrepTime = useMemo(() => {
        let mins = 0;
        let secs = 0;
        order.items?.forEach(item => {
            mins += (item.preparation_time_min || 0) * (item.quantity || 1);
            secs += (item.preparation_time_sec || 0) * (item.quantity || 1);
        });
        mins += Math.floor(secs / 60);
        secs = secs % 60;
        return { mins, secs };
    }, [order.items]);

    const progress = useMemo(() => {
        const status = order.status?.toLowerCase();
        const totalPrepSeconds = totalPrepTime.mins * 60 + totalPrepTime.secs;

        if (['pending', 'paid'].includes(status)) return 10;

        if (['preparing', 'assigned', 'preparing_order'].includes(status)) {
            if (!order.accepted_at || totalPrepSeconds === 0) return 40;

            const acceptedTime = new Date(order.accepted_at).getTime();
            const elapsedSeconds = Math.max(0, (now - acceptedTime) / 1000);

            // 15% base start + (elapsed / total) * 55% (range up to 70%)
            const prepProgress = (elapsedSeconds / totalPrepSeconds) * 55;
            return Math.min(70, 15 + Math.round(prepProgress));
        }

        if (['ready_for_pickup'].includes(status)) return 80;
        if (['delivering', 'in_transit'].includes(status)) return 95;
        return 0;
    }, [order.status, order.accepted_at, totalPrepTime, now]);

    const statusText = useMemo(() => {
        const status = order.status?.toLowerCase();
        if (['pending', 'paid'].includes(status)) return 'Order Placed';
        if (['preparing', 'assigned'].includes(status)) return 'Preparing your order';
        if (['ready_for_pickup'].includes(status)) return 'Order is Ready';
        if (['delivering', 'in_transit'].includes(status)) return 'Out for Delivery';
        return status;
    }, [order.status]);

    const StatusIcon = useMemo(() => {
        const status = order.status?.toLowerCase();
        if (['pending', 'paid'].includes(status)) return ShoppingBag;
        if (['preparing', 'assigned'].includes(status)) return Utensils;
        if (['ready_for_pickup'].includes(status)) return Package;
        if (['delivering', 'in_transit'].includes(status)) return Truck;
        return CheckCircle2;
    }, [order.status]);


    // SVG for circular progress
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div
            onClick={onClick}
            className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-[2rem] p-5 shadow-2xl mb-8 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group"
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-600 group-hover:w-2 transition-all"></div>
            {/* Progress Circle */}
            <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full -rotate-90">
                    <circle
                        cx="32" cy="32" r={radius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="5"
                    />
                    <circle
                        cx="32" cy="32" r={radius}
                        fill="transparent"
                        stroke="#ea580c" // orange-600
                        strokeWidth="5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-in-out shadow-sm"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-orange-600 scale-110">
                    <StatusIcon size={24} />
                </div>
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-black text-gray-900 text-[15px] leading-tight mb-0.5 tracking-tight group-hover:text-orange-600 transition-colors">{statusText}</h4>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500 font-semibold italic truncate max-w-[120px]">From {order.merchant_name}</p>
                            {order.dispatch_code && (
                                <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md border border-blue-200 uppercase tracking-tighter">
                                    #{order.dispatch_code}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* TIME DISPLAY (PREP COUNTDOWN or RIDER ETA) */}
                    {(['preparing', 'assigned', 'preparing_order'].includes(order.status?.toLowerCase())) ? (
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-black uppercase tracking-widest leading-none mb-1">ETA</span>
                            <span className="text-sm font-black text-orange-600 tabular-nums bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                                {(() => {
                                    const totalPrepSeconds = totalPrepTime.mins * 60 + totalPrepTime.secs;
                                    if (!order.accepted_at || totalPrepSeconds === 0) return `${totalPrepTime.mins}:${totalPrepTime.secs.toString().padStart(2, '0')}`;

                                    const acceptedTime = new Date(order.accepted_at).getTime();
                                    const elapsedSeconds = Math.max(0, (now - acceptedTime) / 1000);
                                    const remainingSeconds = Math.max(0, totalPrepSeconds - elapsedSeconds);

                                    const m = Math.floor(remainingSeconds / 60);
                                    const s = Math.floor(remainingSeconds % 60);
                                    return `${m}:${s.toString().padStart(2, '0')}`;
                                })()}
                            </span>
                        </div>
                    ) : order.delivery_eta_arrival && (['ready_for_pickup', 'delivering', 'in_transit'].includes(order.status?.toLowerCase())) ? (
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-black uppercase tracking-widest leading-none mb-1">Arrival</span>
                            <span className="text-sm font-black text-orange-600 tabular-nums bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                                {(() => {
                                    const eta = new Date(order.delivery_eta_arrival).getTime();
                                    const diff = Math.max(0, eta - now);
                                    const m = Math.floor(diff / 60000);
                                    const s = Math.floor((diff % 60000) / 1000);
                                    return `${m}:${s.toString().padStart(2, '0')}`;
                                })()}
                            </span>
                        </div>
                    ) : null}
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-orange-600 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(234,88,12,0.4)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-black text-orange-600 whitespace-nowrap">{progress}%</span>
                </div>
            </div>

            <div className="px-3 py-1 bg-orange-600 rounded-full shadow-lg shadow-orange-600/20">
                <span className="text-[10px] font-black text-white italic tracking-widest">LIVE</span>
            </div>
        </div>
    );
};

export default ActiveOrderCard;
