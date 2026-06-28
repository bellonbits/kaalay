'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Heart } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/store';
import { BottomNav } from '@/components/layouts/BottomNav';

const CATEGORIES = [
  { id: 'meat', label: 'Meat', emoji: '🥩', color: 'from-red-50 to-red-100' },
  { id: 'fastfood', label: 'Fast Food', emoji: '🍔', color: 'from-orange-50 to-orange-100' },
  { id: 'sushi', label: 'Sushi', emoji: '🍣', color: 'from-green-50 to-green-100' },
  { id: 'drinks', label: 'Drinks', emoji: '🥤', color: 'from-blue-50 to-blue-100' },
];

const PROMOS = [
  {
    id: 1,
    title: 'New Year Offer',
    discount: '30% OFF',
    dates: '16 - 31 Dec',
    image: 'from-green-600 to-green-700',
  },
  {
    id: 2,
    title: 'Holiday Special',
    discount: 'FREE Delivery',
    dates: 'This Week',
    image: 'from-blue-600 to-blue-700',
  },
];

const BEST_SELLERS = [
  {
    id: 1,
    name: 'Melting Cheese Pizza',
    price: '$10.99',
    rating: 4.8,
    reviews: 2200,
    calories: 44,
    time: '20 min',
    image: '🍕',
  },
  {
    id: 2,
    name: 'Cheese Burger',
    price: '$4.99',
    rating: 4.8,
    reviews: 2200,
    calories: 44,
    time: '20 min',
    image: '🍔',
  },
];

export default function HomePage() {
  const { user } = useAuthStore();
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % PROMOS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-24 md:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600">Hello 👋</p>
            <h1 className="text-lg font-bold text-gray-900">{user?.full_name || 'Delisas Agency'}</h1>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search rides, stores, food..."
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl border-0 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Category Cards */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <Link key={cat.id} href={`/delivery?category=${cat.id}`}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 text-center cursor-pointer shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="text-3xl mb-2">{cat.emoji}</div>
                <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Promotional Banner */}
      <div className="px-4 py-4">
        <motion.div
          key={currentPromoIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`bg-gradient-to-br ${PROMOS[currentPromoIndex].image} rounded-2xl p-6 text-white shadow-lg overflow-hidden relative`}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-90">{PROMOS[currentPromoIndex].title}</p>
            <h2 className="text-3xl font-bold mt-1">{PROMOS[currentPromoIndex].discount}</h2>
            <p className="text-xs opacity-75 mt-2">{PROMOS[currentPromoIndex].dates}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-4 bg-white text-green-600 px-6 py-2 rounded-full text-sm font-semibold"
            >
              Get Now
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Best Sellers */}
      <div className="py-4">
        <div className="flex items-center justify-between px-4 mb-4">
          <h3 className="text-lg font-bold text-gray-900">Best Sellers</h3>
          <Link href="/delivery" className="text-sm text-green-600 font-semibold hover:text-green-700">
            See All
          </Link>
        </div>

        <div className="overflow-x-auto px-4 pb-2">
          <div className="flex gap-4">
            {BEST_SELLERS.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -4 }}
                className="flex-shrink-0 w-40 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative bg-gray-100 h-32 flex items-center justify-center text-4xl">
                  {item.image}
                  <button className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm hover:bg-gray-100">
                    <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{item.name}</h4>
                  <p className="text-xs text-gray-600 mt-1">{item.price}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-yellow-500">★ {item.rating}</span>
                    <span className="text-gray-500">({item.reviews / 100}k)</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                    <span>🔥 {item.calories} Calories</span>
                    <span>⏱️ {item.time}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full mt-3 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg text-xs font-semibold transition-colors"
                  >
                    +
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
