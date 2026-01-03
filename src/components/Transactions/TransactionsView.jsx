import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, ShoppingBag, Bike, Download, FileText, Printer, Package, Truck } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../UI/Toast';

const API_URL = '/api';

const ETA_TIMER_MS = 1000;

const ETACountdown = ({ arrivalTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      if (!arrivalTime) return;
      const diff = new Date(arrivalTime) - new Date();
      if (diff <= 0) {
        setTimeLeft('Arriving soon');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, ETA_TIMER_MS);
    return () => clearInterval(timer);
  }, [arrivalTime]);

  if (!arrivalTime) return null;

  return (
    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 mt-1">
      <Clock size={10} />
      <span>Arriving in {timeLeft}</span>
    </div>
  );
};

const TransactionsView = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHistory();

      // Socket.IO for real-time updates
      const socket = io(window.location.origin, {
        path: '/hungr/socket.io'
      });

      const eventName = `user_${user.id}_order_update`;
      socket.on(eventName, (data) => {
        console.log('[Socket] Order Update:', data);

        // 1. Immediate visual feedback (local state update)
        setOrders(prevOrders => prevOrders.map(order =>
          order.id === parseInt(data.orderId)
            ? {
              ...order,
              status: data.status,
              rider_id: data.riderId || order.riderId || order.rider_id,
              delivery_eta_arrival: data.delivery_eta_arrival || order.delivery_eta_arrival
            }
            : order
        ));

        // 2. Full synchronization (re-fetch history)
        fetchHistory();

        // 3. User notification
        if (data.message) {
          showToast(data.message, 'success');
        }
      });

      return () => {
        socket.off(eventName);
        socket.disconnect();
      };
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/orders/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status, order = {}) => {
    switch (status) {
      case 'completed':
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-orange-600 bg-orange-50';
      case 'preparing':
      case 'ready_for_pickup':
      case 'assigned':
      case 'delivering':
        return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status, order = {}) => {
    switch (status) {
      case 'completed':
      case 'delivered': return <CheckCircle size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      case 'preparing':
      case 'assigned':
        return <Package size={14} className="animate-pulse" />;
      case 'ready_for_pickup':
        return <Clock size={14} />;
      case 'delivering':
        return <Truck size={14} className="animate-bounce" />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusMessage = (status, order = {}) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing':
        return order.rider_id ? 'Rider picking up order and on Queue' : 'Your order is being prepared';
      case 'ready_for_pickup': return 'Waiting for rider';
      case 'assigned': return 'Rider picking up order and on Queue';
      case 'delivering': return 'Rider on the way to deliver';
      case 'completed':
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  // --- EXPORT FUNCTIONS ---

  const handleExportCSV = () => {
    if (orders.length === 0) return alert("No transactions to export.");

    // 1. Define Headers
    const headers = ["Order ID", "Date", "Merchant", "Type", "Status", "Amount"];

    // 2. Format Data
    const rows = orders.map(order => [
      order.id,
      new Date(order.created_at).toLocaleDateString(),
      `"${order.merchant_name || 'Store'}"`, // Quote strings to handle commas
      order.type,
      order.status,
      parseFloat(order.amount).toFixed(2)
    ]);

    // 3. Construct CSV Content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // 4. Create Download Link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Hungr_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="pb-32 bg-slate-50 min-h-screen">
      {/* Print Styles */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #transaction-list, #transaction-list * { visibility: visible; }
            #transaction-list { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Header Actions */}
      <div className="flex items-center justify-between p-5 bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Order History</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{orders.length} Total Bookings</p>
        </div>

        <div className="flex gap-2 no-print">
          <button
            onClick={handlePrintPDF}
            className="p-2.5 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-all active:scale-90"
            title="Print / Save as PDF"
          >
            <Printer size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100 shadow-sm"
            title="Export to Excel (CSV)"
          >
            <FileText size={14} strokeWidth={3} /> EXPORT
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white m-5 rounded-[2.5rem] shadow-sm">
          <div className="w-12 h-12 border-4 border-orange-100 rounded-full border-t-orange-600 animate-spin mb-4"></div>
          <p className="text-sm font-bold text-slate-400">Loading your history...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 m-5 bg-white rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
            <ShoppingBag size={48} className="text-slate-200" />
          </div>
          <h3 className="text-lg font-black text-gray-900 tracking-tight">No Orders Found</h3>
          <p className="text-slate-400 font-medium text-sm mt-2">Time to start your first Hungr journey!</p>
        </div>
      ) : (
        <div id="transaction-list" className="space-y-4 p-5">

          {/* Header for Print View Only */}
          <div className="hidden print:block mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white font-black text-xl">H</div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Hungr Transaction Report</h1>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generated On: {new Date().toLocaleDateString()}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer: {user?.username || 'Guest'}</p>
          </div>

          {orders.map((order) => (
            <div key={`${order.type}-${order.id}`} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:shadow-xl transition-all duration-300 active:scale-[0.99] print:border-b print:shadow-none print:rounded-none">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative shadow-inner overflow-hidden flex-shrink-0 ${order.type === 'food' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-blue-50 text-blue-600 border border-blue-100'} print:hidden`}>
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {order.type === 'food' ? <ShoppingBag size={24} strokeWidth={2.5} /> : <Bike size={24} strokeWidth={2.5} />}
                </div>
                <div>
                  <h3 className="font-black text-[15px] text-gray-900 leading-snug tracking-tight truncate max-w-[150px]">{order.merchant_name || 'Merchant Partner'}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] font-bold text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                    {order.dispatch_code && (
                      <>
                        <p className="text-[11px] font-bold text-slate-300">•</p>
                        <p className="text-[11px] font-black text-blue-600 uppercase">#{order.dispatch_code}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900 text-lg tracking-tight">₱{parseFloat(order.amount).toFixed(2)}</p>
                <div className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full mt-1.5 shadow-sm border ${getStatusColor(order.status, order)} print:bg-transparent print:text-black print:p-0 print:border-none uppercase tracking-widest`}>
                  <span className="print:hidden scale-90">{getStatusIcon(order.status, order)}</span>
                  <span>{getStatusMessage(order.status, order)}</span>
                </div>
                {order.status === 'delivering' && order.delivery_eta_arrival && (
                  <div className="mt-2 scale-90 origin-right">
                    <ETACountdown arrivalTime={order.delivery_eta_arrival} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Summary Footer for Print */}
          <div className="hidden print:block mt-12 py-6 border-t-4 border-slate-900">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Orders</p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">{orders.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Transaction Value</p>
                <p className="text-3xl font-black text-orange-600 tracking-tight italic">₱{orders.reduce((sum, o) => sum + parseFloat(o.amount), 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pt-8 border-t border-slate-100">
              End of Transaction Report • NFC Revolution Inc.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsView;
