'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Search, MapPin, Clock, Star, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Hero Section
export function HeroSection() {
  return (
    <div className="bg-gradient-to-br from-green-50 to-white pt-6 pb-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-gray-600 text-sm font-medium mb-2">Good morning 👋</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Where would you like to go today?
        </h1>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search destinations, stores, restaurants..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
          />
        </div>
      </motion.div>
    </div>
  );
}

// Quick Actions
export function QuickActions() {
  const actions = [
    {
      icon: '🚗',
      label: 'Ride',
      href: '/ride',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: '🛵',
      label: 'Delivery',
      href: '/delivery',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: '🛒',
      label: 'Shop',
      href: '/delivery/stores',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: '📦',
      label: 'Send Package',
      href: '/delivery/send',
      color: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="px-4 py-6">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, idx) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href={action.href}>
              <div
                className={cn(
                  'relative overflow-hidden rounded-2xl p-6 text-white cursor-pointer group',
                  `bg-gradient-to-br ${action.color}`
                )}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-white transition-opacity" />
                <div className="relative z-10">
                  <div className="text-4xl mb-3">{action.icon}</div>
                  <p className="font-semibold text-base">{action.label}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Store Card
interface StoreCardProps {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  distance: string;
  deliveryTime: string;
  image?: string;
  badge?: string;
}

export function StoreCard({
  id,
  name,
  rating,
  reviews,
  distance,
  deliveryTime,
  image,
  badge,
}: StoreCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="flex-shrink-0 w-72 bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      <Link href={`/delivery/stores/${id}`}>
        <div className="relative h-48 bg-gray-200 overflow-hidden">
          {image && (
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
            />
          )}
          {badge && (
            <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              {badge}
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
            <p className="text-white font-semibold text-lg">{name}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              <span className="font-semibold text-gray-900">{rating}</span>
              <span className="text-gray-500 text-sm">({reviews})</span>
            </div>
            <span className="text-xs text-gray-500">{distance}</span>
          </div>

          <div className="flex items-center gap-1 text-gray-600 text-sm">
            <Clock size={14} />
            <span>{deliveryTime}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Nearby Stores Section
export function NearbyStores() {
  const stores = [
    {
      id: '1',
      name: 'KFC',
      rating: 4.8,
      reviews: 2234,
      distance: '2.5 km',
      deliveryTime: '15 min',
      badge: 'Free Delivery',
    },
    {
      id: '2',
      name: 'Naivas Supermarket',
      rating: 4.7,
      reviews: 1856,
      distance: '3.2 km',
      deliveryTime: '20 min',
    },
    {
      id: '3',
      name: 'QuickMart',
      rating: 4.6,
      reviews: 1542,
      distance: '2.8 km',
      deliveryTime: '18 min',
      badge: 'Promo',
    },
  ];

  return (
    <div className="py-6">
      <div className="px-4 flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Nearby Stores</h2>
        <Link href="/delivery/stores" className="text-green-500 text-sm font-semibold flex items-center gap-1">
          See All
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="overflow-x-auto px-4 pb-2">
        <div className="flex gap-4">
          {stores.map((store) => (
            <StoreCard key={store.id} {...store} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Promo Banner
export function PromoBanner() {
  const banners = [
    {
      title: '30% OFF Delivery',
      subtitle: 'Use code DELIV30',
      color: 'from-orange-400 to-red-500',
      icon: '🎉',
    },
    {
      title: 'Free Delivery',
      subtitle: 'Orders above KES 500',
      color: 'from-green-400 to-emerald-500',
      icon: '🚀',
    },
    {
      title: 'Earn Points',
      subtitle: 'Every order counts',
      color: 'from-purple-400 to-pink-500',
      icon: '⭐',
    },
  ];

  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="px-4 py-6">
      <motion.div
        key={current}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          'relative overflow-hidden rounded-2xl p-6 text-white',
          `bg-gradient-to-r ${banners[current].color}`
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl mb-2">{banners[current].icon}</p>
            <h3 className="text-2xl font-bold">{banners[current].title}</h3>
            <p className="text-white/80 mt-1">{banners[current].subtitle}</p>
          </div>
        </div>

        {/* Carousel dots */}
        <div className="flex gap-2 mt-4">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                idx === current ? 'bg-white w-8' : 'bg-white/50'
              )}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Popular Restaurants Section
export function PopularRestaurants() {
  const restaurants = [
    {
      id: '1',
      name: 'Melting Cheese Pizza',
      store: 'Pizza Italiano',
      rating: 4.8,
      price: 'KES 11.88',
      badge: '30% OFF',
    },
    {
      id: '2',
      name: 'Chicken Salad',
      store: 'Melt House',
      rating: 4.6,
      price: 'KES 4.56',
    },
    {
      id: '3',
      name: 'Cheese Burger',
      store: 'Burger Hunt',
      rating: 4.7,
      price: 'KES 4.99',
      badge: 'Popular',
    },
  ];

  return (
    <div className="py-6">
      <div className="px-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Popular Now</h2>
      </div>

      <div className="px-4 space-y-4">
        {restaurants.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ x: 4 }}
            className="flex gap-4 bg-white rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.store}</p>
                </div>
                {item.badge && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-semibold">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-semibold">{item.rating}</span>
                </div>
                <span className="font-bold text-green-600">{item.price}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
