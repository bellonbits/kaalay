'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { getNotifications, markNotificationRead } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(() => {
    const u = localStorage.getItem('kaalay_user');
    if (!u) { router.push('/auth'); return; }
    getNotifications()
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);
        setUnreadCount(list.filter((n: any) => !n.read).length);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time: listen for new notifications via socket
  useEffect(() => {
    const s = getSocket();
    const onNewNotif = (notif: any) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(c => c + 1);
    };
    s.on('notification', onNewNotif);
    // Also refresh on ride status events
    const onRideUpdate = () => fetchNotifications();
    s.on('request-accepted', onRideUpdate);
    s.on('ride-completed', onRideUpdate);
    s.on('ride-cancelled', onRideUpdate);
    return () => {
      s.off('notification', onNewNotif);
      s.off('request-accepted', onRideUpdate);
      s.off('ride-completed', onRideUpdate);
      s.off('ride-cancelled', onRideUpdate);
    };
  }, [fetchNotifications]);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
    info:    { icon: InfoCircleOutlined,    color: '#3B82F6', bg: '#EFF6FF' },
    success: { icon: CheckCircleOutlined,   color: '#10B981', bg: '#ECFDF5' },
    warning: { icon: WarningOutlined,       color: '#F59E0B', bg: '#FFFBEB' },
    ride:    { icon: CarOutlined,           color: '#000000', bg: '#F9FAFB' },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '60px 20px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.back()} style={{
            width: 44, height: 44, borderRadius: 14, background: '#F9FAFB',
            border: '2px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeftOutlined style={{ fontSize: 16, color: '#1A1A1A' }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-0.5px' }}>Activity</h1>
            <p style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>Your live ride updates</p>
          </div>
          {unreadCount > 0 && (
            <div style={{ background: '#000', color: '#fff', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 800 }}>
              {unreadCount} new
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #1A1A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <BellOutlined style={{ fontSize: 56, color: '#F3F4F6', marginBottom: 20 }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>No activity yet</h2>
            <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>Ride updates will appear here in real time.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map(n => {
              const meta = TYPE_META[n.type] ?? TYPE_META.info;
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleRead(n.id)}
                  style={{
                    display: 'flex', gap: 14, padding: '16px',
                    background: n.read ? '#FFFFFF' : '#FAFAFA',
                    border: `2px solid ${n.read ? '#F3F4F6' : '#E5E7EB'}`,
                    borderRadius: 20, cursor: n.read ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {!n.read && (
                    <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#000' }} />
                  )}
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, background: meta.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Icon style={{ fontSize: 20, color: meta.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', marginBottom: 4 }}>{n.title}</h3>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>{n.message}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#AAA', fontSize: 11, fontWeight: 700 }}>
                      <ClockCircleOutlined />
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
