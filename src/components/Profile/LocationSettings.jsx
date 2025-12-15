import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Loader, CheckCircle, AlertCircle, Save, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = '/api';

export default function LocationSettings() {
    const { user } = useAuth();
    const [location, setLocation] = useState({ latitude: '', longitude: '', address: '' });
    const [loading, setLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    // Load existing location on mount
    useEffect(() => {
        const fetchLocation = async () => {
            try {
                const token = sessionStorage.getItem('accessToken');
                const res = await fetch(`${API_URL}/users/location`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success && data.data) {
                    setLocation({
                        latitude: data.data.latitude || '',
                        longitude: data.data.longitude || '',
                        address: data.data.address || ''
                    });
                }
            } catch (e) {
                console.error('Failed to fetch location:', e);
            }
        };
        fetchLocation();
    }, []);

    // Get current location using browser geolocation
    const getCurrentLocation = () => {
        if (!('geolocation' in navigator)) {
            setStatus({ type: 'error', message: 'Geolocation not supported by your browser' });
            return;
        }

        setGeoLoading(true);
        setStatus({ type: '', message: '' });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation(prev => ({
                    ...prev,
                    latitude: position.coords.latitude.toFixed(8),
                    longitude: position.coords.longitude.toFixed(8)
                }));
                setGeoLoading(false);
                setStatus({ type: 'success', message: 'Location detected! Click Save to update.' });
            },
            (error) => {
                setGeoLoading(false);
                setStatus({ type: 'error', message: `Location error: ${error.message}` });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Save location to server
    const saveLocation = async () => {
        if (!location.latitude || !location.longitude) {
            setStatus({ type: 'error', message: 'Please set latitude and longitude first' });
            return;
        }

        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const token = sessionStorage.getItem('accessToken');
            const res = await fetch(`${API_URL}/users/location`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    latitude: parseFloat(location.latitude),
                    longitude: parseFloat(location.longitude),
                    address: location.address
                })
            });

            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Location saved! Riders will deliver here.' });
            } else {
                setStatus({ type: 'error', message: data.error || 'Failed to save location' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                <MapPin className="text-orange-600" size={20} /> GPS Location
            </h3>
            <p className="text-gray-500 text-xs mb-4">
                Set your delivery location for accurate order dispatch.
            </p>

            {status.message && (
                <div className={`p-3 rounded-xl flex items-center gap-2 mb-4 text-sm ${status.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {status.message}
                </div>
            )}

            {/* Auto-detect Button */}
            <button
                type="button"
                onClick={getCurrentLocation}
                disabled={geoLoading}
                className="w-full mb-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
                {geoLoading ? (
                    <><Loader className="animate-spin" size={18} /> Detecting Location...</>
                ) : (
                    <><Navigation size={18} /> Use My Current Location</>
                )}
            </button>

            {/* Manual Coordinates */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Latitude</label>
                    <input
                        type="text"
                        value={location.latitude}
                        onChange={(e) => setLocation(prev => ({ ...prev, latitude: e.target.value }))}
                        placeholder="e.g. 10.7202"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-orange-500 focus:outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Longitude</label>
                    <input
                        type="text"
                        value={location.longitude}
                        onChange={(e) => setLocation(prev => ({ ...prev, longitude: e.target.value }))}
                        placeholder="e.g. 122.5621"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-orange-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Address (optional) */}
            <div className="space-y-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Street Address (Optional)</label>
                <input
                    type="text"
                    value={location.address}
                    onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street, Barangay, City"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-orange-500 focus:outline-none"
                />
            </div>

            {/* Location Preview */}
            {location.latitude && location.longitude && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Location Preview</p>
                    <p className="text-gray-800 font-mono text-sm">
                        📍 {location.latitude}, {location.longitude}
                    </p>
                    <a
                        href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 text-xs hover:underline mt-2 inline-flex items-center gap-1"
                    >
                        View on Google Maps <ExternalLink size={12} />
                    </a>
                </div>
            )}

            {/* Save Button */}
            <button
                type="button"
                onClick={saveLocation}
                disabled={loading || !location.latitude || !location.longitude}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                {loading ? 'Saving...' : <><Save size={16} /> Save GPS Location</>}
            </button>
        </div>
    );
}
