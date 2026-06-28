'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Share2, Flame, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BottomNav } from '@/components/layouts/BottomNav';

const STORE_DATA = {
  1: {
    name: 'Delisas Agency',
    category: 'Pizza Italiana',
    rating: 4.8,
    reviews: 2200,
    eta: '20-30 min',
    deliveryFee: 'Free',
    image: '🍕',
  },
  2: {
    name: 'Burger House',
    category: 'American Fast Food',
    rating: 4.7,
    reviews: 1800,
    eta: '15-25 min',
    deliveryFee: '$2',
    image: '🍔',
  },
};

const PRODUCTS = [
  {
    id: 1,
    name: 'Melting Cheese Pizza',
    price: 10.99,
    rating: 4.8,
    reviews: 2200,
    image: '🍕',
    category: 'Pizza',
  },
  {
    id: 2,
    name: 'Pepperoni Special',
    price: 12.99,
    rating: 4.7,
    reviews: 1800,
    image: '🍕',
    category: 'Pizza',
  },
  {
    id: 3,
    name: 'Cheese Burger',
    price: 4.99,
    rating: 4.8,
    reviews: 2200,
    image: '🍔',
    category: 'Burgers',
  },
  {
    id: 4,
    name: 'Classic Sushi Roll',
    price: 8.99,
    rating: 4.9,
    reviews: 3100,
    image: '🍣',
    category: 'Sushi',
  },
];

export default function StorePage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const store = STORE_DATA[storeId as keyof typeof STORE_DATA];
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['Pizza', 'Burgers', 'Sushi'];
  const filteredProducts =
    selectedCategory === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === selectedCategory);

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Store not found</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-24 md:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero Image */}
      <div className="relative bg-gray-100 h-40 flex items-center justify-center text-7xl md:h-64">
        {store.image}
        <Link href="/delivery">
          <button className="absolute top-4 left-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
        </Link>
        <button className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
          <Heart className="w-5 h-5 text-gray-600 hover:text-red-500" />
        </button>
        <button className="absolute top-16 right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100">
          <Share2 className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Store Info */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
        <p className="text-sm text-gray-600 mt-1">{store.category}</p>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-yellow-500 font-semibold">★ {store.rating}</span>
          <span className="text-gray-500 text-sm">({store.reviews / 100}k reviews)</span>
          <span className="text-gray-600 text-sm">•</span>
          <span className="text-gray-600 text-sm">{store.eta}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-4 pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-4 space-y-3">
        {filteredProducts.map((product, idx) => (
          <Link key={product.id} href={`/delivery/${storeId}/product/${product.id}`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex gap-4 p-4"
            >
              <div className="bg-gray-100 rounded-xl h-24 w-24 flex items-center justify-center text-4xl flex-shrink-0">
                {product.image}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600 mt-1">${product.price.toFixed(2)}</p>

                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-yellow-500">★ {product.rating}</span>
                  <span className="text-gray-500">({product.reviews / 100}k)</span>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="bg-gray-100 hover:bg-gray-200 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg"
                >
                  +
                </motion.button>
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
