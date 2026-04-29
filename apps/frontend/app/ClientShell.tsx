'use client';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

function Shell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ssr: false → renders null on the server, mounts fresh on the client.
// React never attempts to reconcile server HTML with client output for
// this subtree, so browser-extension DOM injections can't cause mismatches.
export default dynamic(() => Promise.resolve(Shell), { ssr: false });
