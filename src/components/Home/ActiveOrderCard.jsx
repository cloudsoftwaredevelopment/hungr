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
            className="bg-white/80 backdrop-blur-md border border-white/50 rounded-3xl p-4 shadow-xl mb-6 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all"
        >
            {/* Progress Circle */}
            <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full -rotate-90">
                    <circle
                        cx="28" cy="28" r={radius}
                        fill="transparent"
                        stroke="#f3f4f6"
                        strokeWidth="4"
                    />
                    <circle
                        cx="28" cy="28" r={radius}
                        fill="transparent"
                        stroke="#ea580c" // orange-600
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-in-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-orange-600">
                    <StatusIcon size={20} />
                </div>
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-extrabold text-gray-900 text-sm mb-0.5">{statusText}</h4>
                        <p className="text-xs text-gray-500 font-medium">From {order.merchant_name}</p>
                    </div>
                    {/* TIME DISPLAY (PREP COUNTDOWN or RIDER ETA) */}
                    {(['preparing', 'assigned', 'preparing_order'].includes(order.status?.toLowerCase())) ? (
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-tighter">Est. Ready in</span>
                            <span className="text-xs font-black text-orange-600 tabular-nums">
                                {(() => {
                                    const totalPrepSeconds = totalPrepTime.mins * 60 + totalPrepTime.secs;
                                    if (!order.accepted_at || totalPrepSeconds === 0) return `${totalPrepTime.mins}m ${totalPrepTime.secs}s`;

                                    const acceptedTime = new Date(order.accepted_at).getTime();
                                    const elapsedSeconds = Math.max(0, (now - acceptedTime) / 1000);
                                    const remainingSeconds = Math.max(0, totalPrepSeconds - elapsedSeconds);

                                    const m = Math.floor(remainingSeconds / 60);
                                    const s = Math.floor(remainingSeconds % 60);
                                    return `${m}m ${s}s`;
                                })()}
                            </span>
                        </div>
                    ) : order.delivery_eta_arrival && (['ready_for_pickup', 'delivering', 'in_transit'].includes(order.status?.toLowerCase())) ? (
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-tighter">
                                {order.status?.toLowerCase() === 'ready_for_pickup' ? 'Rider Arriving' : 'Arriving at Destination'}
                            </span>
                            <span className="text-xs font-black text-orange-600 tabular-nums">
                                {(() => {
                                    const eta = new Date(order.delivery_eta_arrival).getTime();
                                    const diff = Math.max(0, eta - now);
                                    const m = Math.floor(diff / 60000);
                                    const s = Math.floor((diff % 60000) / 1000);
                                    return `${m}m ${s}s`;
                                })()}
                            </span>
                        </div>
                    ) : null}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div
                            className="bg-orange-600 h-full transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-orange-600 whitespace-nowrap">{progress}%</span>
                </div>
            </div>

            <div className="px-3 py-1 bg-orange-50 rounded-full">
                <span className="text-[10px] font-bold text-orange-600">LIVE</span>
            </div>
        </div>
    );
};

export default ActiveOrderCard;
