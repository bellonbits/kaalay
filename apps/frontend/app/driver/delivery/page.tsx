'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, Phone, Navigation } from 'lucide-react';
import { deliveryAPI, DeliveryOffer, ActiveDelivery } from '@/lib/services/delivery';

export default function DeliveryPage() {
  const [token, setToken] = useState<string | null>(null);
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      loadData(storedToken);
    }
  }, []);

  const loadData = async (token: string) => {
    try {
      setIsLoading(true);
      const [offersData, deliveriesData, earningsData] = await Promise.all([
        deliveryAPI.getOffers(token),
        deliveryAPI.getActiveDeliveries(token),
        deliveryAPI.getTodayEarnings(token),
      ]);
      setOffers(offersData);
      setActiveDeliveries(deliveriesData);
      setTodayEarnings(earningsData.total || 0);
    } catch (error) {
      console.error('Failed to load delivery data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!token) return;
    try {
      await deliveryAPI.acceptOffer(token, offerId);
      loadData(token);
    } catch (error) {
      console.error('Failed to accept offer:', error);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    if (!token) return;
    try {
      await deliveryAPI.rejectOffer(token, offerId);
      loadData(token);
    } catch (error) {
      console.error('Failed to reject offer:', error);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-20">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Suqafuran Express</h1>
              <p className="text-slate-400 text-sm">Delivery Dashboard</p>
            </div>
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isOnline
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
              }`}
            >
              {isOnline ? '🟢 Online' : '⚫ Offline'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-600 rounded-lg p-4">
              <p className="text-emerald-100 text-sm">Today&apos;s Earnings</p>
              <h3 className="text-2xl font-bold text-white">KES {todayEarnings.toLocaleString()}</h3>
            </div>
            <div className="bg-blue-600 rounded-lg p-4">
              <p className="text-blue-100 text-sm">Active Deliveries</p>
              <h3 className="text-2xl font-bold text-white">{activeDeliveries.length}</h3>
            </div>
            <div className="bg-orange-600 rounded-lg p-4">
              <p className="text-orange-100 text-sm">Pending Offers</p>
              <h3 className="text-2xl font-bold text-white">{offers.length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Job Offers Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">🆕 Available Offers</h2>

          {offers.length === 0 ? (
            <div className="bg-slate-700 rounded-lg p-8 text-center">
              <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                {isOnline ? 'Waiting for delivery offers...' : 'Go online to receive offers'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.map((offer) => (
                <div key={offer.id} className="bg-slate-700 rounded-lg p-4 border-l-4 border-orange-500">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-bold">{offer.order_type}</h3>
                      <p className="text-sm text-slate-400">{offer.estimated_distance} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">KES {offer.delivery_fee}</p>
                      <p className="text-xs text-slate-400">{offer.estimated_duration} min</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex gap-2">
                      <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300">{offer.pickup_address}</p>
                    </div>
                    <div className="flex gap-2">
                      <Navigation className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300">{offer.dropoff_address}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptOffer(offer.id)}
                      className="flex-1 bg-green-500 text-white py-2 rounded font-semibold hover:bg-green-600 transition-colors text-sm"
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => handleRejectOffer(offer.id)}
                      className="flex-1 bg-red-500/20 text-red-400 py-2 rounded font-semibold hover:bg-red-500/30 transition-colors text-sm"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">📍 Active Deliveries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeDeliveries.map((delivery) => (
                <div key={delivery.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-bold">{delivery.customer_name}</h3>
                      <p className="text-sm text-slate-400">
                        {delivery.status.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">KES {delivery.delivery_fee}</p>
                      <p className="text-xs text-slate-400">{delivery.eta_minutes} min</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex gap-2">
                      <Phone className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <a
                        href={`tel:${delivery.customer_phone}`}
                        className="text-sm text-blue-400 hover:underline"
                      >
                        {delivery.customer_phone}
                      </a>
                    </div>
                  </div>

                  <a
                    href={`/driver/delivery/${delivery.id}`}
                    className="w-full bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-600 transition-colors text-center text-sm block"
                  >
                    View Details
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
