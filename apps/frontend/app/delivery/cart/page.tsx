'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Minus, Plus, Tag } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layouts/BottomNav';

const CART_ITEMS = [
  {
    id: 1,
    name: 'Melting Cheese Pizza',
    store: 'Pizza Italiano',
    price: 11.88,
    quantity: 1,
    image: '🍕',
  },
  {
    id: 2,
    name: 'Chicken Salad',
    store: 'Melt House',
    price: 4.56,
    quantity: 1,
    image: '🥗',
  },
  {
    id: 3,
    name: 'Cheese Burger',
    store: 'Burger Hunt',
    price: 4.99,
    quantity: 1,
    image: '🍔',
  },
];

export default function CartPage() {
  const [items, setItems] = useState(CART_ITEMS);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 5;
  const tax = 0.08;
  const total = subtotal + deliveryFee + (subtotal * tax);

  const handleQuantityChange = (id: number, delta: number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const handleRemove = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleApplyPromo = () => {
    if (promoCode === 'SAVE10') {
      setDiscount(subtotal * 0.1);
    } else {
      setDiscount(0);
    }
  };

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
          <div className="flex items-center gap-3">
            <Link href="/delivery">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-900" />
              </button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Cart</h1>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Trash2 className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Cart Items */}
      <div className="px-4 py-4 space-y-3">
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="flex gap-4 p-4">
              {/* Product Image */}
              <div className="bg-gray-100 rounded-xl h-20 w-20 flex items-center justify-center text-3xl flex-shrink-0">
                {item.image}
              </div>

              {/* Product Info */}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{item.store}</p>
                <p className="text-sm font-bold text-green-600 mt-2">${item.price.toFixed(2)}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuantityChange(item.id, -1)}
                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="w-3 h-3 text-gray-600" />
                </motion.button>
                <span className="w-6 text-center font-semibold text-gray-900 text-sm">{item.quantity}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuantityChange(item.id, 1)}
                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="w-3 h-3 text-gray-600" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Promo Code Section */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-gray-600" />
            <input
              type="text"
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="flex-1 bg-transparent border-0 placeholder-gray-500 focus:outline-none focus:ring-0 font-semibold"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleApplyPromo}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              Apply
            </motion.button>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-900">Order Summary</h3>

          <div className="space-y-2 border-b border-gray-200 pb-3">
            <div className="flex justify-between text-gray-700 text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700 text-sm">
              <span>Delivery</span>
              <span className="font-semibold">${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700 text-sm">
              <span>Tax</span>
              <span className="font-semibold">${(subtotal * tax).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600 text-sm">
                <span>Discount</span>
                <span className="font-semibold">-${discount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-lg text-green-600">${Math.max(0, total - discount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sticky Checkout Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 md:relative md:border-0 md:bg-transparent md:px-0 md:py-4">
        <Link href="/delivery/checkout">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-full transition-colors text-lg"
          >
            Checkout • ${Math.max(0, total - discount).toFixed(2)}
          </motion.button>
        </Link>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
