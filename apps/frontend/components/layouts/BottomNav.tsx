'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Home, MapPin, ShoppingCart, MessageCircle, User } from 'lucide-react';
import { motion } from 'framer-motion';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Delivery', href: '/delivery', icon: MapPin },
    { label: 'Cart', href: '/delivery/cart', icon: ShoppingCart },
    { label: 'Chat', href: '/chat', icon: MessageCircle },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 md:hidden z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around max-w-screen-lg mx-auto gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link key={item.href} href={item.href}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-green-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Icon size={20} />
                {isActive && <span className="text-sm font-semibold">{item.label}</span>}
              </motion.button>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
