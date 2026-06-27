'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, MapPin, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Timeline Item
interface TimelineItemProps {
  status: 'completed' | 'active' | 'pending';
  label: string;
  time?: string;
}

export function TimelineItem({ status, label, time }: TimelineItemProps) {
  const isCompleted = status === 'completed';
  const isActive = status === 'active';

  return (
    <div className="flex gap-4">
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
            isCompleted && 'bg-green-500',
            isActive && 'bg-green-500 ring-4 ring-green-100',
            status === 'pending' && 'bg-gray-300'
          )}
        >
          {isCompleted && <CheckCircle size={20} />}
          {isActive && <motion.div className="w-4 h-4 bg-green-200 rounded-full animate-pulse" />}
        </motion.div>
      </div>

      {/* Timeline content */}
      <div className="pb-8">
        <p className={cn(
          'font-semibold',
          isCompleted && 'text-gray-900',
          isActive && 'text-green-600',
          status === 'pending' && 'text-gray-500'
        )}>
          {label}
        </p>
        {time && <p className="text-sm text-gray-600 mt-1">{time}</p>}
      </div>
    </div>
  );
}

// Delivery Timeline
export function DeliveryTimeline() {
  const stages = [
    { status: 'completed' as const, label: 'Order Confirmed', time: '2:15 PM' },
    { status: 'completed' as const, label: 'Merchant Preparing', time: '2:20 PM' },
    { status: 'active' as const, label: 'Driver Heading to Store', time: 'Now' },
    { status: 'pending' as const, label: 'Picked Up Order' },
    { status: 'pending' as const, label: 'On The Way' },
    { status: 'pending' as const, label: 'Delivered' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Order Status</h3>
      <div className="space-y-2">
        {stages.map((stage, idx) => (
          <TimelineItem key={idx} {...stage} />
        ))}
      </div>
    </div>
  );
}

// Driver Card
interface DriverCardProps {
  name: string;
  rating: number;
  vehicle: string;
  avatar?: string;
  phone?: string;
}

export function DriverCard({ name, rating, vehicle, avatar, phone }: DriverCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-3xl text-white">
          {avatar || '👤'}
        </div>
        <div>
          <p className="font-bold text-gray-900">{name}</p>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>⭐ {rating}</span>
            <span>•</span>
            <span>{vehicle}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {phone && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
          >
            <Phone size={20} />
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-3 bg-gray-100 text-gray-900 rounded-full hover:bg-gray-200 transition-colors"
        >
          <MessageCircle size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ETA Card
interface ETACardProps {
  eta: string;
  distance: string;
  address: string;
}

export function ETACard({ eta, distance, address }: ETACardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-6"
    >
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-green-100 mb-1">Estimated Time</p>
          <motion.p
            animate={{ scale: 1.1 }}
            transition={{ yoyo: Infinity, duration: 2 }}
            className="text-2xl font-bold"
          >
            {eta}
          </motion.p>
        </div>
        <div>
          <p className="text-sm text-green-100 mb-1">Distance</p>
          <p className="text-2xl font-bold">{distance}</p>
        </div>
        <div>
          <p className="text-sm text-green-100 mb-1">Dropoff</p>
          <p className="text-sm font-semibold truncate">{address}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Live Map Placeholder
export function LiveMapPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-64 bg-gray-200 rounded-2xl flex items-center justify-center relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-green-400/20" />

      {/* Animated driver marker */}
      <motion.div
        animate={{
          x: [0, 20, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="z-10"
      >
        <div className="text-4xl">🚙</div>
      </motion.div>

      {/* Distance lines */}
      <motion.div
        className="absolute top-4 left-4 text-sm text-gray-700 font-semibold"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        📍 Live Location
      </motion.div>
    </motion.div>
  );
}

// Map Actions
export function MapActions() {
  return (
    <div className="flex gap-3 mt-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-green-500 text-green-600 font-semibold py-3 rounded-lg hover:bg-green-50 transition-colors"
      >
        <MapPin size={20} />
        Track on Map
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <MessageCircle size={20} />
        Chat
      </motion.button>
    </div>
  );
}
