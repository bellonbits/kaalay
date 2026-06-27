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
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-0 py-2 md:hidden z-40"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors"
            >
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  color: isActive ? '#22C55E' : '#6B7280',
                }}
                transition={{ duration: 0.2 }}
              >
                <Icon size={24} />
              </motion.div>
              <span
                className={cn(
                  'text-xs font-medium transition-colors',
                  isActive ? 'text-green-500' : 'text-gray-600'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
