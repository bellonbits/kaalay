'use client';
import { CompassOutlined, EnvironmentOutlined, GlobalOutlined } from '@ant-design/icons';

interface Props {
  me?: { lat: number; lng: number };
  target: { lat: number; lng: number; label?: string };
  w3w?: string;
}

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const φ1 = from.lat * Math.PI / 180;
  const φ2 = to.lat  * Math.PI / 180;
  const Δλ = (to.lng - from.lng) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dL = (b.lat - a.lat) * Math.PI / 180;
  const dG = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dL / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function LowDataView({ me, target, w3w }: Props) {
  const d = me ? dist(me, target) : null;
  const b = me ? bearing(me, target) : 0;

  return (
    <div style={{
      width: '100%', height: '100%', background: '#F7F7F7',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      {/* Visual Indicator */}
      <div style={{
        width: 180, height: 180, borderRadius: '50%',
        background: '#FFFFFF', border: '2px solid #EBEBEB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', marginBottom: 32,
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderBottom: '40px solid #1A1A1A',
          transform: `rotate(${b}deg)`,
          transformOrigin: '50% 75%',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
        <span style={{ position: 'absolute', top: 12, fontSize: 14, fontWeight: 900, color: '#DDD' }}>N</span>
      </div>

      <div style={{ maxWidth: 280 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          Target distance
        </p>
        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#1A1A1A', marginBottom: 16 }}>
          {d !== null ? (d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`) : '---'}
        </h2>

        {w3w && (
          <div style={{ background: '#1A1A1A', borderRadius: 16, padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>Exact Address</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#FFD600' }}>///{w3w}</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#888', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CompassOutlined />
            <span>{Math.round(b)}° Bearing</span>
          </div>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#DDD' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GlobalOutlined />
            <span>Low Data Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
