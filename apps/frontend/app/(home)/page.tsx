'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  HeroSection,
  QuickActions,
  NearbyStores,
  PromoBanner,
  PopularRestaurants,
} from '@/components/home/HomePageComponents';
import { BottomNav } from '@/components/layouts/BottomNav';

export default function HomePage() {
  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-20 md:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header & Search */}
      <HeroSection />

      {/* Quick Actions */}
      <QuickActions />

      {/* Promo Banner - Auto rotating */}
      <PromoBanner />

      {/* Nearby Stores */}
      <NearbyStores />

      {/* Popular Restaurants */}
      <PopularRestaurants />

      {/* Bottom Navigation */}
      <BottomNav />
    </motion.div>
  );
}
