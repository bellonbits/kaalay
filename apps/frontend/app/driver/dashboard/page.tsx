'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/layouts/BottomNav';
import {
  DriverStatusToggle,
  EarningsCard,
  IncomingOfferModal,
  PerformanceStats,
  EarningsHistory,
} from '@/components/driver/DriverComponents';

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = React.useState(false);
  const [showOffer, setShowOffer] = React.useState(false);

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-20 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Driver Dashboard</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Status Toggle */}
        <DriverStatusToggle
          isOnline={isOnline}
          onToggle={() => setIsOnline(!isOnline)}
        />

        {/* Earnings Card */}
        {isOnline && (
          <EarningsCard
            todayEarnings={2450}
            completedDeliveries={12}
            acceptanceRate={95}
          />
        )}

        {/* Show Incoming Offer when online */}
        {isOnline && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowOffer(true)}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-4 rounded-lg transition-colors text-lg"
          >
            📞 Incoming Delivery Request (Tap to view)
          </motion.button>
        )}

        {/* Performance Stats */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Performance</h2>
          <PerformanceStats
            rating={4.9}
            acceptanceRate={95}
            completionRate={99}
            totalDeliveries={342}
          />
        </div>

        {/* Earnings History */}
        <EarningsHistory
          deliveries={[
            {
              id: '1',
              customer: 'Nairobi - CBD',
              time: '2:45 PM',
              earnings: 250,
              status: 'completed',
            },
            {
              id: '2',
              customer: 'Westlands - Gigiri',
              time: '2:15 PM',
              earnings: 380,
              status: 'completed',
            },
            {
              id: '3',
              customer: 'Upper Hill - Karen',
              time: '1:30 PM',
              earnings: 450,
              status: 'completed',
            },
            {
              id: '4',
              customer: 'Kilimani - Parklands',
              time: '12:50 PM',
              earnings: 320,
              status: 'pending',
            },
          ]}
        />
      </div>

      {/* Incoming Offer Modal */}
      {showOffer && (
        <IncomingOfferModal
          pickupLocation="KFC Restaurant, Nairobi CBD"
          dropoffLocation="123 Main Street, Westlands"
          distance="3.2 km"
          estimatedEarnings={450}
          expiresIn={30}
          onAccept={() => {
            setShowOffer(false);
            // Handle accept
          }}
          onDecline={() => setShowOffer(false)}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
