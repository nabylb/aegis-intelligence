"use client";

import dynamic from 'next/dynamic';
import { MapProvider } from 'react-map-gl/maplibre';

const IntelDashboard = dynamic(() => import('@/components/IntelDashboard'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="bg-neutral-950 min-h-screen selection:bg-neutral-800">
      <MapProvider>
        <IntelDashboard />
      </MapProvider>
    </main>
  );
}
