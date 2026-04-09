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
    <div className="flex h-full items-center justify-center bg-[#0F0F0F]">
      <div className="text-3xl font-black tracking-tight">
        kaa<span className="text-[#A8D83F]">lay</span>
      </div>
    </div>
  );
}
