import React, { useMemo } from 'react';
import { ShoppingBag, CheckCircle2, Package, Truck, Utensils } from 'lucide-react';

const ActiveOrderCard = ({ order, onClick }) => {
    if (!order) return null;

    const progress = useMemo(() => {
        const status = order.status?.toLowerCase();
        if (['pending', 'paid'].includes(status)) return 15;
        if (['preparing', 'assigned', 'preparing_order'].includes(status)) return 40;
        if (['ready_for_pickup'].includes(status)) return 70;
        if (['delivering', 'in_transit'].includes(status)) return 90;
        return 0;
    }, [order.status]);

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
                <h4 className="font-extrabold text-gray-900 text-sm mb-0.5">{statusText}</h4>
                <p className="text-xs text-gray-500 font-medium">From {order.merchant_name}</p>
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
