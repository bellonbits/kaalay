'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckoutForm } from '@/components/delivery/DeliveryComponents';
import { BottomNav } from '@/components/layouts/BottomNav';

export default function CartPage() {
  const [cartItems] = React.useState([
    { id: '1', name: 'Melting Cheese Pizza', price: 11.88, quantity: 1 },
    { id: '2', name: 'Coca Cola', price: 2.50, quantity: 2 },
  ]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 5.0;
  const serviceFee = 1.5;
  const total = subtotal + deliveryFee + serviceFee;

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-24 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
        <Link href="/delivery">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-900" />
          </motion.button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Cart Items */}
        <motion.div
          className="bg-white rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {cartItems.map((item, idx) => (
            <motion.div
              key={item.id}
              className="flex items-center justify-between p-4 border-b border-gray-200 last:border-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-600">x{item.quantity}</p>
              </div>
              <p className="font-bold text-green-600">KES {(item.price * item.quantity).toFixed(2)}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Order Summary */}
        <motion.div
          className="bg-white rounded-2xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

          <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span className="font-semibold">KES {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Delivery Fee</span>
              <span className="font-semibold">KES {deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Service Fee</span>
              <span className="font-semibold">KES {serviceFee.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-lg text-green-600">KES {total.toFixed(2)}</span>
          </div>
        </motion.div>

        {/* Checkout Form */}
        <motion.div
          className="bg-white rounded-2xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-6">Delivery Details</h3>
          <CheckoutForm />
        </motion.div>

        {/* Promo Code */}
        <motion.div
          className="bg-white rounded-2xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Promo Code (Optional)
          </label>
          <input
            type="text"
            placeholder="Enter promo code"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </motion.div>
      </div>

      {/* Sticky Checkout Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 md:relative md:border-0 md:bg-transparent md:px-0 md:py-0 md:mt-6">
        <Link href={`/delivery/tracking?id=order-123`}>
          <Button
            fullWidth
            size="lg"
            className="md:mb-6"
          >
            Proceed to Checkout (KES {total.toFixed(2)})
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
