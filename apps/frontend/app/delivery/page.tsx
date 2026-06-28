'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layouts/BottomNav';

const CATEGORIES = [
  { id: 'food', label: 'Food', emoji: '🍕', color: 'from-red-50 to-red-100' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒', color: 'from-yellow-50 to-yellow-100' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊', color: 'from-blue-50 to-blue-100' },
  { id: 'beauty', label: 'Beauty', emoji: '💄', color: 'from-pink-50 to-pink-100' },
  { id: 'electronics', label: 'Electronics', emoji: '📱', color: 'from-purple-50 to-purple-100' },
  { id: 'flowers', label: 'Flowers', emoji: '🌹', color: 'from-rose-50 to-rose-100' },
  { id: 'local', label: 'Local Shops', emoji: '🏪', color: 'from-orange-50 to-orange-100' },
];

const STORES = [
  {
    id: 1,
    name: 'Delisas Agency',
    category: 'Pizza Italiana',
    rating: 4.8,
    reviews: 2200,
    eta: '20-30 min',
    deliveryFee: 'Free',
    image: '🍕',
  },
  {
    id: 2,
    name: 'Burger House',
    category: 'American Fast Food',
    rating: 4.7,
    reviews: 1800,
    eta: '15-25 min',
    deliveryFee: '$2',
    image: '🍔',
  },
  {
    id: 3,
    name: 'Sushi Master',
    category: 'Japanese',
    rating: 4.9,
    reviews: 3100,
    eta: '25-35 min',
    deliveryFee: '$3',
    image: '🍣',
  },
  {
    id: 4,
    name: 'Salad Bowl',
    category: 'Healthy Food',
    rating: 4.6,
    reviews: 950,
    eta: '20-30 min',
    deliveryFee: '$1',
    image: '🥗',
  },
];

export default function DeliveryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredStores =
    selectedCategory && selectedCategory !== 'all'
      ? STORES.filter((s) => s.category.toLowerCase().includes(selectedCategory.toLowerCase()))
      : STORES;

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-24 md:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white px-4 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Suqafuran Express</h1>
        <p className="text-sm text-gray-600 mb-4">Delivering food, groceries, pharmacy and more</p>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search stores..."
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl border-0 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Location Selector */}
      <div className="px-4 py-3 flex items-center gap-2 text-gray-600">
        <MapPin className="w-4 h-4" />
        <span className="text-sm">Deliver to: Home</span>
        <ChevronRight className="w-4 h-4 ml-auto" />
      </div>

      {/* Categories */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-4 gap-3 md:grid-cols-7">
          {CATEGORIES.map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                selectedCategory === cat.id
                  ? 'bg-green-50 border-2 border-green-500'
                  : `bg-gradient-to-br ${cat.color}`
              }`}
            >
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-xs font-semibold text-gray-900 text-center">{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Stores */}
      <div className="px-4 py-4 space-y-3">
        {filteredStores.map((store, idx) => (
          <Link key={store.id} href={`/delivery/${store.id}`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="bg-gray-100 h-32 flex items-center justify-center text-6xl">{store.image}</div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-lg">{store.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{store.category}</p>

                <div className="flex items-center justify-between mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500 font-semibold">★ {store.rating}</span>
                    <span className="text-gray-500">({store.reviews / 100}k)</span>
                  </div>
                  <span className="text-gray-600">{store.eta}</span>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-green-600 font-semibold">Delivery {store.deliveryFee}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
