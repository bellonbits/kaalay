'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Category Card
interface CategoryCardProps {
  id: string;
  name: string;
  icon: string;
  href: string;
}

export function CategoryCard({ id, name, icon, href }: CategoryCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Link href={href}>
        <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="text-5xl">{icon}</div>
          <p className="font-semibold text-gray-900 text-center">{name}</p>
        </div>
      </Link>
    </motion.div>
  );
}

// Delivery Categories Grid
export function DeliveryCategoriesGrid() {
  const categories = [
    { id: '1', name: 'Restaurants', icon: '🍔', href: '/delivery/stores?category=restaurants' },
    { id: '2', name: 'Groceries', icon: '🛒', href: '/delivery/stores?category=groceries' },
    { id: '3', name: 'Pharmacy', icon: '💊', href: '/delivery/stores?category=pharmacy' },
    { id: '4', name: 'Beauty', icon: '💄', href: '/delivery/stores?category=beauty' },
    { id: '5', name: 'Flowers', icon: '💐', href: '/delivery/stores?category=flowers' },
    { id: '6', name: 'Electronics', icon: '📱', href: '/delivery/stores?category=electronics' },
    { id: '7', name: 'Local Shops', icon: '🏪', href: '/delivery/stores?category=local' },
    { id: '8', name: 'Send Package', icon: '📦', href: '/delivery/send-package' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 px-4 py-6">
      {categories.map((category, idx) => (
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.05 }}
        >
          <CategoryCard {...category} />
        </motion.div>
      ))}
    </div>
  );
}

// Delivery Header
export function DeliveryHeader() {
  return (
    <div className="bg-gradient-to-br from-green-50 to-white pt-6 pb-8 px-4 sticky top-0 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Suqafuran Express
        </h1>
        <p className="text-gray-600 text-sm mb-4">
          Delivering anything, anywhere
        </p>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search stores, restaurants..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
          />
        </div>
      </motion.div>
    </div>
  );
}

// Store List Item
interface StoreListItemProps {
  id: string;
  name: string;
  rating: number;
  distance: string;
  deliveryTime: string;
  badge?: string;
  category: string;
}

export function StoreListItem({
  id,
  name,
  rating,
  distance,
  deliveryTime,
  badge,
  category,
}: StoreListItemProps) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-shadow"
    >
      <Link href={`/delivery/stores/${id}`} className="flex-1 flex items-center gap-4">
        <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0" />

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-bold text-gray-900">{name}</p>
              <p className="text-xs text-gray-500">{category}</p>
            </div>
            {badge && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-2">
              <span className="font-semibold">⭐ {rating}</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-600">{distance}</span>
            </div>
            <span className="text-gray-600">{deliveryTime}</span>
          </div>
        </div>
      </Link>

      <ChevronRight className="text-gray-400" size={20} />
    </motion.div>
  );
}

// Store Hero
interface StoreHeroProps {
  name: string;
  rating: number;
  deliveryTime: string;
  distance: string;
  image?: string;
}

export function StoreHero({
  name,
  rating,
  deliveryTime,
  distance,
  image,
}: StoreHeroProps) {
  return (
    <div className="relative h-64 bg-gray-200 mb-6">
      {image && (
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h1 className="text-3xl font-bold mb-3">{name}</h1>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span>⭐</span>
            <span className="font-semibold">{rating}</span>
          </div>
          <span className="text-white/80">•</span>
          <span className="text-white/80">🚗 {distance}</span>
          <span className="text-white/80">•</span>
          <span className="text-white/80">⏱️ {deliveryTime}</span>
        </div>
      </div>
    </div>
  );
}

// Category Tabs (Sticky)
interface CategoryTabsProps {
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}

export function CategoryTabs({
  categories,
  selected,
  onSelect,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-16 bg-white border-b border-gray-200 px-4 py-3 overflow-x-auto">
      <div className="flex gap-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-full font-semibold transition-all text-sm',
              selected === cat
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}

// Product Card
interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  rating?: number;
  image?: string;
  onAddToCart: (id: string) => void;
}

export function ProductCard({
  id,
  name,
  price,
  rating,
  image,
  onAddToCart,
}: ProductCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative h-40 bg-gray-200">
        {image && (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="p-4">
        <p className="font-semibold text-gray-900 line-clamp-2 mb-2">{name}</p>

        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-lg text-green-600">KES {price}</p>
          {rating && (
            <span className="flex items-center gap-1 text-sm">
              <span>⭐</span>
              <span className="font-semibold">{rating}</span>
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onAddToCart(id)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-lg transition-colors"
        >
          Add to Cart
        </motion.button>
      </div>
    </motion.div>
  );
}

// Checkout Form
export function CheckoutForm() {
  const [formData, setFormData] = React.useState({
    address: '',
    name: '',
    phone: '',
    instructions: '',
    deliveryOption: 'standard',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const deliveryOptions = [
    { id: 'standard', name: 'Standard Delivery', time: '20-30 min', price: 50 },
    { id: 'express', name: 'Express Delivery', time: '10-15 min', price: 150 },
    { id: 'scheduled', name: 'Scheduled', time: 'Pick time', price: 30 },
  ];

  return (
    <div className="space-y-6">
      {/* Delivery Address */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Delivery Address
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Enter your delivery address"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Recipient Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Recipient Name
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Full name"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+254 712 345 678"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Delivery Options */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Delivery Option
        </label>
        <div className="space-y-2">
          {deliveryOptions.map((option) => (
            <label
              key={option.id}
              className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
            >
              <input
                type="radio"
                name="deliveryOption"
                value={option.id}
                checked={formData.deliveryOption === option.id}
                onChange={handleChange}
                className="w-4 h-4 text-green-500"
              />
              <div className="ml-3 flex-1">
                <p className="font-semibold text-gray-900">{option.name}</p>
                <p className="text-sm text-gray-600">{option.time}</p>
              </div>
              <span className="font-semibold text-green-600">+KES {option.price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Special Instructions */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Special Instructions (Optional)
        </label>
        <textarea
          name="instructions"
          value={formData.instructions}
          onChange={handleChange}
          placeholder="E.g., Please ring the bell twice"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
