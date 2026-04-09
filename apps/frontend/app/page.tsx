'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    const user = typeof window !== 'undefined' ? localStorage.getItem('kaalay_user') : null;
    router.replace(user ? '/home' : '/auth');
  }, [router]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7', gap: '16px' }}>
      {/* Wordmark splash */}
      <div style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', color: '#1A1A1A' }}>
        kaalay
      </div>
      <div style={{ width: '32px', height: '32px', border: '3px solid #1A1A1A', borderTopColor: '#FFD600', borderRadius: '50%' }}
        className="spin" />
    </div>
  );
}
