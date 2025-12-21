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
    <div className="animate-in slide-in-from-right pb-24">
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
      <div className="flex items-center justify-between px-4 pt-4 mb-4">
        <h2 className="text-xl font-bold">Order History</h2>

        <div className="flex gap-2 no-print">
          <button
            onClick={handlePrintPDF}
            className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition"
            title="Print / Save as PDF"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-full text-xs font-bold hover:bg-green-200 transition"
            title="Export to Excel (CSV)"
          >
            <FileText size={14} /> Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading history...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 m-4 rounded-xl">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No orders yet</p>
        </div>
      ) : (
        <div id="transaction-list" className="space-y-3 px-4">

          {/* Header for Print View Only */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold mb-2">Hungr Transaction Report</h1>
            <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-gray-500">User: {user?.username || 'Guest'}</p>
          </div>

          {orders.map((order) => (
            <div key={`${order.type}-${order.id}`} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between print:border-b print:shadow-none print:rounded-none">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${order.type === 'food' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'} print:hidden`}>
                  {order.type === 'food' ? <ShoppingBag size={20} /> : <Bike size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{order.merchant_name || 'Store'}</h3>
                  <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString()}</p>
                  <p className="text-xs text-gray-400 capitalize print:block hidden">Type: {order.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">₱{parseFloat(order.amount).toFixed(2)}</p>
                <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${getStatusColor(order.status, order)} print:bg-transparent print:text-black print:p-0`}>
                  <span className="print:hidden">{getStatusIcon(order.status, order)}</span>
                  <span className="capitalize">{getStatusMessage(order.status, order)}</span>
                </div>
                {order.status === 'delivering' && order.delivery_eta_arrival && (
                  <ETACountdown arrivalTime={order.delivery_eta_arrival} />
                )}
              </div>
            </div>
          ))}

          {/* Summary Footer for Print */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
            <div className="flex justify-between font-bold text-lg">
              <span>Total Orders: {orders.length}</span>
              <span>Total Value: ₱{orders.reduce((sum, o) => sum + parseFloat(o.amount), 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsView;
