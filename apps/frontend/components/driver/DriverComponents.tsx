'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// lucide imports removed - not used in this component
import { cn } from '@/lib/utils/cn';

// Driver Status Toggle
interface DriverStatusToggleProps {
  isOnline: boolean;
  onToggle: () => void;
}

export function DriverStatusToggle({ isOnline, onToggle }: DriverStatusToggleProps) {
  return (
    <motion.div
      className="bg-white rounded-2xl p-6 flex items-center justify-between"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          isOnline ? 'bg-green-500' : 'bg-gray-300'
        )}>
          <span className="text-white text-lg">👨‍💼</span>
        </div>
        <div>
          <p className="font-bold text-gray-900">John Mwangi</p>
          <p className={cn(
            'text-sm font-semibold',
            isOnline ? 'text-green-600' : 'text-gray-600'
          )}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </p>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className={cn(
          'px-6 py-3 rounded-lg font-semibold transition-all',
          isOnline
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        )}
      >
        {isOnline ? 'Go Offline' : 'Go Online'}
      </motion.button>
    </motion.div>
  );
}

// Earnings Card
interface EarningsCardProps {
  todayEarnings: number;
  completedDeliveries: number;
  acceptanceRate: number;
}

export function EarningsCard({
  todayEarnings,
  completedDeliveries,
  acceptanceRate,
}: EarningsCardProps) {
  return (
    <motion.div
      className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-green-100 mb-1">Today&apos;s Earnings</p>
          <motion.p
            animate={{ scale: 1.05 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 2 }}
            className="text-2xl font-bold"
          >
            KES {todayEarnings}
          </motion.p>
        </div>
        <div>
          <p className="text-sm text-green-100 mb-1">Deliveries</p>
          <p className="text-2xl font-bold">{completedDeliveries}</p>
        </div>
        <div>
          <p className="text-sm text-green-100 mb-1">Acceptance Rate</p>
          <p className="text-2xl font-bold">{acceptanceRate}%</p>
        </div>
      </div>
    </motion.div>
  );
}

// Incoming Offer Modal
interface IncomingOfferProps {
  pickupLocation: string;
  dropoffLocation: string;
  distance: string;
  estimatedEarnings: number;
  expiresIn: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingOfferModal({
  pickupLocation,
  dropoffLocation,
  distance,
  estimatedEarnings,
  expiresIn,
  onAccept,
  onDecline,
}: IncomingOfferProps) {
  const [timeLeft, setTimeLeft] = React.useState(expiresIn);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl p-8 max-w-md w-full"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          {/* Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">New Delivery Request</h2>
          <p className="text-gray-600 mb-6">Expires in {timeLeft}s</p>

          {/* Progress bar */}
          <motion.div
            className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: expiresIn }}
          >
            <div className="h-full bg-red-500" />
          </motion.div>

          {/* Pickup */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-600 font-semibold mb-2">PICKUP</p>
            <p className="font-semibold text-gray-900">{pickupLocation}</p>
          </div>

          {/* Dropoff */}
          <div className="mb-6 p-4 bg-green-50 rounded-xl">
            <p className="text-xs text-green-600 font-semibold mb-2">DROPOFF</p>
            <p className="font-semibold text-gray-900">{dropoffLocation}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Distance</p>
              <p className="text-lg font-bold text-gray-900">{distance}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">Est. Earnings</p>
              <p className="text-lg font-bold text-green-600">KES {estimatedEarnings}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDecline}
              className="py-3 px-4 border-2 border-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Decline
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAccept}
              className="py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
            >
              Accept
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Active Delivery Screen
interface ActiveDeliveryProps {
  customerName: string;
  merchantName: string;
  pickupETA: string;
  dropoffETA: string;
  distance: string;
  earnings: number;
}

export function ActiveDeliveryScreen({
  customerName,
  merchantName,
  pickupETA,
  dropoffETA,
  distance,
  earnings,
}: ActiveDeliveryProps) {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Pickup Route */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-bold text-gray-900 mb-4">Pickup Merchant</h3>
        <div className="mb-4 h-40 bg-gray-200 rounded-xl flex items-center justify-center">
          📍 Pickup Route Map
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Merchant</p>
          <p className="font-bold text-gray-900">{merchantName}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">ETA: {pickupETA}</span>
          <span className="text-gray-600">{distance}</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Call Merchant
        </motion.button>
      </div>

      {/* Dropoff Route */}
      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-bold text-gray-900 mb-4">Dropoff Customer</h3>
        <div className="mb-4 h-40 bg-gray-200 rounded-xl flex items-center justify-center">
          📍 Dropoff Route Map
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Customer</p>
          <p className="font-bold text-gray-900">{customerName}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">ETA: {dropoffETA}</span>
          <span className="text-green-600 font-bold">+KES {earnings}</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Call Customer
        </motion.button>
      </div>
    </motion.div>
  );
}

// Performance Stats
interface PerformanceStatsProps {
  rating: number;
  acceptanceRate: number;
  completionRate: number;
  totalDeliveries: number;
}

export function PerformanceStats({
  rating,
  acceptanceRate,
  completionRate,
  totalDeliveries,
}: PerformanceStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div
        className="bg-white rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-gray-600 text-sm mb-2">Rating</p>
        <p className="text-3xl font-bold text-gray-900">{rating}⭐</p>
      </motion.div>

      <motion.div
        className="bg-white rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-gray-600 text-sm mb-2">Acceptance Rate</p>
        <p className="text-3xl font-bold text-green-600">{acceptanceRate}%</p>
      </motion.div>

      <motion.div
        className="bg-white rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-gray-600 text-sm mb-2">Completion Rate</p>
        <p className="text-3xl font-bold text-blue-600">{completionRate}%</p>
      </motion.div>

      <motion.div
        className="bg-white rounded-2xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-gray-600 text-sm mb-2">Total Deliveries</p>
        <p className="text-3xl font-bold text-purple-600">{totalDeliveries}</p>
      </motion.div>
    </div>
  );
}

// Earnings History
interface EarningHistoryProps {
  deliveries: Array<{
    id: string;
    customer: string;
    time: string;
    earnings: number;
    status: 'completed' | 'pending';
  }>;
}

export function EarningsHistory({ deliveries }: EarningHistoryProps) {
  return (
    <div className="bg-white rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Earnings</h3>

      <div className="space-y-3">
        {deliveries.map((delivery) => (
          <motion.div
            key={delivery.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            whileHover={{ x: 4 }}
          >
            <div>
              <p className="font-semibold text-gray-900">{delivery.customer}</p>
              <p className="text-sm text-gray-600">{delivery.time}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-600">+KES {delivery.earnings}</p>
              <p className="text-xs text-gray-600">
                {delivery.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
