'use client';
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => {
    socketRef.current = getSocket();
    return () => { /* shared singleton — do not disconnect */ };
  }, []);
  return socketRef;
}

// ── One-way tracking (classic viewer of a shared session) ──────────────────
export function useSessionSocket(
  code: string | null,
  onLocation: (data: { lat: number; lng: number; accuracy?: number; heading?: number; timestamp: number }) => void,
  onStatus?: (data: { status: string }) => void,
  onAccepted?: (data: { helperName: string }) => void,
  onViewerCount?: (data: { count: number }) => void,
  onArrived?: (data: { name: string; timestamp: number }) => void,
  onViewerLocation?: (data: { viewerId: string; name: string; lat: number; lng: number; accuracy?: number; timestamp: number }) => void,
) {
  const socketRef = useSocket();

  useEffect(() => {
    if (!code) return;
    const s = socketRef.current;
    if (!s) return;

    s.emit('join', code);
    s.on('location', onLocation);
    if (onStatus)         s.on('status',          onStatus);
    if (onAccepted)       s.on('request-accepted', onAccepted);
    if (onViewerCount)    s.on('viewer-count',     onViewerCount);
    if (onArrived)        s.on('member-arrived',   onArrived);
    if (onViewerLocation) s.on('viewer-location',  onViewerLocation);

    return () => {
      s.emit('leave', code);
      s.off('location', onLocation);
      if (onStatus)         s.off('status',          onStatus);
      if (onAccepted)       s.off('request-accepted', onAccepted);
      if (onViewerCount)    s.off('viewer-count',     onViewerCount);
      if (onArrived)        s.off('member-arrived',   onArrived);
      if (onViewerLocation) s.off('viewer-location',  onViewerLocation);
    };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Multi-party group session (meet page) ──────────────────────────────────
export interface GroupMember {
  memberId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  lastSeen: number;
}

export function useGroupSession(
  code: string | null,
  me: { memberId: string; name: string } | null,
  handlers: {
    onMemberList?:     (members: GroupMember[]) => void;
    onMemberJoined?:   (m: GroupMember)          => void;
    onMemberLocation?: (d: GroupMember & { timestamp: number }) => void;
    onMemberLeft?:     (d: { memberId: string }) => void;
    onMemberArrived?:  (d: { name: string; timestamp: number }) => void;
    onDestination?:    (d: { lat: number; lng: number; label?: string }) => void;
  },
) {
  const socketRef = useSocket();

  useEffect(() => {
    if (!code || !me) return;
    const s = socketRef.current;
    if (!s) return;

    const { onMemberList, onMemberJoined, onMemberLocation, onMemberLeft, onMemberArrived, onDestination } = handlers;

    if (onMemberList)     s.on('member-list',     onMemberList);
    if (onMemberJoined)   s.on('member-joined',   onMemberJoined);
    if (onMemberLocation) s.on('member-location', onMemberLocation);
    if (onMemberLeft)     s.on('member-left',     onMemberLeft);
    if (onMemberArrived)  s.on('member-arrived',  onMemberArrived);
    if (onDestination)    s.on('destination',     onDestination);

    return () => {
      s.emit('leave-group', { code, memberId: me.memberId });
      if (onMemberList)     s.off('member-list',     onMemberList);
      if (onMemberJoined)   s.off('member-joined',   onMemberJoined);
      if (onMemberLocation) s.off('member-location', onMemberLocation);
      if (onMemberLeft)     s.off('member-left',     onMemberLeft);
      if (onMemberArrived)  s.off('member-arrived',  onMemberArrived);
      if (onDestination)    s.off('destination',     onDestination);
    };
  }, [code, me?.memberId]); // eslint-disable-line react-hooks/exhaustive-deps
}
