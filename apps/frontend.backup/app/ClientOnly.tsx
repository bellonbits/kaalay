'use client';
import { useState, useEffect, ReactNode } from 'react';

export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ height: '100%', background: '#F7F7F7' }} />;
  return <>{children}</>;
}
