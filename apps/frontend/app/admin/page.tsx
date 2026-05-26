'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftOutlined, 
  CarOutlined, 
  DollarOutlined, 
  TeamOutlined, 
  SyncOutlined,
  EnvironmentOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { getAdminStats, getActiveTrips } from '../../lib/api';

interface Stats {
  activeTrips: number;
  completedTrips: number;
  totalDrivers: number;
  verifiedDrivers: number;
  totalRevenue: number;
}

interface Trip {
  id: string;
  status: string;
  category: string;
  pickup: string;
  destination: string;
  fare: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, tData] = await Promise.all([
        getAdminStats(),
        getActiveTrips()
      ]);
      if (sData.success) setStats(sData.data);
      if (tData.success) setTrips(tData.data);
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 15s for the Ops team
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100%', background: '#F7F8FA', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '48px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #EBEBEB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.back()} style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: '#F7F8FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ArrowLeftOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <DashboardOutlined /> Ops Dashboard
            </h1>
            <p style={{ fontSize: 12, color: '#888' }}>Live Platform Overview</p>
          </div>
        </div>
        <button 
          onClick={loadData}
          style={{
            width: 40, height: 40, borderRadius: 12, border: '1.5px solid #EBEBEB',
            background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1A1A1A'
          }}
        >
          <SyncOutlined spin={loading} />
        </button>
      </div>

      <div style={{ flex: 1, padding: '24px' }}>
        
        {/* KPI Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          
          <div style={{ background: '#1A1A1A', borderRadius: 24, padding: 20, color: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
            <DollarOutlined style={{ fontSize: 24, color: '#22C55E', marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>KES {stats?.totalRevenue?.toLocaleString() || 0}</h2>
          </div>

          <div style={{ background: '#FFD600', borderRadius: 24, padding: 20, color: '#1A1A1A', boxShadow: '0 8px 24px rgba(255,214,0,0.2)' }}>
            <CarOutlined style={{ fontSize: 24, marginBottom: 12 }} />
            <p style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Active Trips</p>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{stats?.activeTrips || 0}</h2>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 20, border: '1px solid #EBEBEB' }}>
            <TeamOutlined style={{ fontSize: 20, color: '#3B82F6', marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Verified Fleet</p>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{stats?.verifiedDrivers || 0} <span style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>/ {stats?.totalDrivers || 0}</span></h2>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: 24, padding: 20, border: '1px solid #EBEBEB' }}>
            <CheckOutlined style={{ fontSize: 20, color: '#22C55E', marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Completed</p>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{stats?.completedTrips || 0}</h2>
          </div>

        </div>

        {/* Active Trips Feed */}
        <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A', marginBottom: 16 }}>Live Trip Radar</h3>
        
        {trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#FFFFFF', borderRadius: 24, border: '1.5px dashed #EBEBEB' }}>
            <CarOutlined style={{ fontSize: 32, color: '#EBEBEB', marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: '#888', fontWeight: 700 }}>No active trips at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trips.map(trip => (
              <div key={trip.id} style={{ background: '#FFFFFF', borderRadius: 20, padding: 16, border: '1.5px solid #EBEBEB', display: 'flex', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <EnvironmentOutlined style={{ fontSize: 18, color: '#1A1A1A' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', textTransform: 'capitalize' }}>{trip.category}</p>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: '#F0FDF4', color: '#16A34A', textTransform: 'uppercase' }}>
                      {trip.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{trip.pickup} → {trip.destination}</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>KES {trip.fare}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

const CheckOutlined = (props: any) => (
  <svg viewBox="64 64 896 896" focusable="false" data-icon="check" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.3 724.5 207 474a32 32 0 00-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l548.4-695c4.1-5.2.4-12.9-6.3-12.9z"></path>
  </svg>
);
