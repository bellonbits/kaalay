'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  LiveMapPlaceholder,
  DriverCard,
  ETACard,
  DeliveryTimeline,
  MapActions,
} from '@/components/tracking/TrackingComponents';
import { BottomNav } from '@/components/layouts/BottomNav';

export default function TrackingPage() {
  const params = useParams();
  const orderId = params.orderId;

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-20 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
        <Link href="/delivery/cart">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-900" />
          </motion.button>
        </Link>
        <div>
          <p className="text-sm text-gray-600">Order #{orderId}</p>
          <p className="font-bold text-gray-900">Tracking Delivery</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Live Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <LiveMapPlaceholder />
          <MapActions />
        </motion.div>

        {/* ETA Card */}
        <ETACard
          eta="12 min"
          distance="2.5 km"
          address="123 Main Street, Nairobi"
        />

        {/* Driver Card */}
        <DriverCard
          name="John Mwangi"
          rating={4.9}
          vehicle="Honda Civic - KCC 123A"
          avatar="👨‍💼"
          phone="0712345678"
        />

        {/* Timeline */}
        <DeliveryTimeline />

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

          <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-600">Melting Cheese Pizza</span>
              <span className="font-semibold">KES 11.88</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Coca Cola</span>
              <span className="font-semibold">KES 2.50</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>KES 14.38</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span>KES 5.00</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service Fee</span>
              <span>KES 1.50</span>
            </div>
          </div>

          <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-lg text-green-600">KES 20.88</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
