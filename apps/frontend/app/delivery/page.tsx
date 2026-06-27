'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import {
  DeliveryHeader,
  DeliveryCategoriesGrid,
} from '@/components/delivery/DeliveryComponents';
import { BottomNav } from '@/components/layouts/BottomNav';

export default function DeliveryPage() {
  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-20 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <DeliveryHeader />

      {/* Categories Grid */}
      <DeliveryCategoriesGrid />

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
