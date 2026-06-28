'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Phone, MessageSquare, CheckCircle, Navigation } from 'lucide-react';
import { deliveryAPI, ActiveDelivery } from '@/lib/services/delivery';

export default function DeliveryDetailPage() {
  const params = useParams();
  const deliveryId = params.id as string;
  const [token, setToken] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextStep, setNextStep] = useState<'pickup' | 'delivery' | 'proof'>('pickup');

  const loadDelivery = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      const data = await deliveryAPI.getDelivery(token, deliveryId);
      setDelivery(data);

      // Determine next step based on status
      if (data.status === 'pending' || data.status === 'accepted') {
        setNextStep('pickup');
      } else if (data.status === 'picked_up') {
        setNextStep('delivery');
      } else if (data.status === 'in_transit') {
        setNextStep('delivery');
      } else {
        setNextStep('proof');
      }
    } catch (error) {
      console.error('Failed to load delivery:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      loadDelivery(storedToken);
    }
  }, [loadDelivery]);

  const handleUpdateStatus = async (status: 'picked_up' | 'in_transit' | 'delivered') => {
    if (!token || !delivery) return;
    try {
      const updated = await deliveryAPI.updateDeliveryStatus(token, delivery.id, status);
      setDelivery(updated);

      if (status === 'picked_up') {
        setNextStep('delivery');
      } else if (status === 'delivered') {
        setNextStep('proof');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (isLoading || !delivery) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-20">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-white">Delivery Details</h1>
        <p className="text-sm text-slate-400">Order #{delivery.order_id.slice(0, 8)}</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Customer Info Card */}
        <div className="bg-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Customer</h2>
          <div className="space-y-3">
            <p className="text-white font-semibold text-lg">{delivery.customer_name}</p>
            <a
              href={`tel:${delivery.customer_phone}`}
              className="flex items-center gap-2 text-blue-400 hover:underline"
            >
              <Phone className="w-4 h-4" />
              {delivery.customer_phone}
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-blue-400 hover:underline"
            >
              <MessageSquare className="w-4 h-4" />
              Send Message
            </a>
          </div>
        </div>

        {/* Delivery Route */}
        <div className="bg-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Route</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full ${
                    nextStep === 'pickup' ? 'bg-blue-500' : 'bg-green-500'
                  }`}
                />
                {nextStep === 'pickup' && <div className="w-1 h-8 bg-blue-500" />}
              </div>
              <div>
                <p className="text-sm text-slate-400">Pickup</p>
                <p className="text-white font-semibold">{delivery.pickup_address}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full ${
                    nextStep === 'delivery' ? 'bg-green-500' : 'bg-slate-400'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-slate-400">Delivery</p>
                <p className="text-white font-semibold">{delivery.dropoff_address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="bg-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Status</h2>

          <div className="mb-6">
            <p className="text-2xl font-bold text-blue-400 capitalize">
              {delivery.status.replace('_', ' ')}
            </p>
            <p className="text-sm text-slate-400 mt-1">ETA: {delivery.eta_minutes} minutes</p>
          </div>

          <div className="space-y-3">
            {nextStep === 'pickup' && delivery.status !== 'picked_up' && (
              <button
                onClick={() => handleUpdateStatus('picked_up')}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Pickup Complete
              </button>
            )}

            {nextStep === 'delivery' && delivery.status === 'picked_up' && (
              <button
                onClick={() => handleUpdateStatus('in_transit')}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation className="w-5 h-5" />
                Start Delivery
              </button>
            )}

            {delivery.status === 'in_transit' && (
              <button
                onClick={() => handleUpdateStatus('delivered')}
                className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Mark Delivered
              </button>
            )}

            <button
              onClick={() => window.location.href = '/driver/delivery'}
              className="w-full bg-slate-600 text-white py-3 rounded-lg font-semibold hover:bg-slate-500 transition-colors text-center"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-gradient-to-br from-emerald-600 to-green-700 rounded-lg p-6">
          <p className="text-emerald-100 text-sm">Delivery Fee</p>
          <h3 className="text-3xl font-bold text-white">KES {delivery.delivery_fee}</h3>
        </div>
      </div>
    </div>
  );
}
