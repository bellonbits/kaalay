"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket, onReconnect } from "@/lib/socket";
import type { Position } from "@/features/location/useGeolocation";

export interface GroupMember {
  memberId: string;
  name: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  heading?: number;
  lastSeen: number;
  isHost?: boolean;
}

const STALE_MS = 35_000; // members with no update in 35s are dropped from the roster
const PUSH_INTERVAL_MS = 3000;

export function useGroupSession(code: string | null, memberId: string, name: string, position: Position | null) {
  const [members, setMembers] = useState<Map<string, GroupMember>>(new Map());
  const [hostId, setHostId] = useState<string | null>(null);
  const lastPushRef = useRef(0);

  const isHost = hostId === memberId;

  useEffect(() => {
    if (!code) return;
    const s = getSocket();

    const handleMemberList = (list: GroupMember[]) => {
      setMembers(new Map(list.map((m) => [m.memberId, m])));
      const host = list.find((m) => m.isHost);
      if (host) setHostId(host.memberId);
    };
    const handleMemberJoined = (m: GroupMember) => setMembers((prev) => new Map(prev).set(m.memberId, m));
    const handleMemberLeft = ({ memberId: id }: { memberId: string }) =>
      setMembers((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    const handleMemberLocation = (update: GroupMember) =>
      setMembers((prev) => {
        const next = new Map(prev);
        const existing = next.get(update.memberId);
        if (existing) next.set(update.memberId, { ...existing, ...update, lastSeen: Date.now() });
        return next;
      });
    const handleHostMoved = (update: { lat?: number; lng?: number; heading?: number }) => {
      setMembers((prev) => {
        if (!hostId) return prev;
        const next = new Map(prev);
        const existing = next.get(hostId);
        if (existing) next.set(hostId, { ...existing, ...update, lastSeen: Date.now() });
        return next;
      });
    };
    const handleHostChanged = ({ hostId: id }: { hostId: string }) => setHostId(id);

    s.on("member-list", handleMemberList);
    s.on("member-joined", handleMemberJoined);
    s.on("member-left", handleMemberLeft);
    s.on("member-location", handleMemberLocation);
    s.on("host-moved", handleHostMoved);
    s.on("host-changed", handleHostChanged);

    const cleanupReconnect = onReconnect(() => {
      s.emit("join-group", { code, memberId, name, lat: position?.lat, lng: position?.lng });
    });

    return () => {
      s.emit("leave-group", { code, memberId });
      s.off("member-list", handleMemberList);
      s.off("member-joined", handleMemberJoined);
      s.off("member-left", handleMemberLeft);
      s.off("member-location", handleMemberLocation);
      s.off("host-moved", handleHostMoved);
      s.off("host-changed", handleHostChanged);
      cleanupReconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, memberId]);

  // Push my own location, throttled.
  useEffect(() => {
    if (!code || !position) return;
    const now = Date.now();
    if (now - lastPushRef.current < PUSH_INTERVAL_MS) return;
    lastPushRef.current = now;
    const s = getSocket();
    const payload = { code, memberId, lat: position.lat, lng: position.lng, accuracy: position.accuracy, heading: position.heading };
    s.emit("group-location", payload);
    if (isHost) s.emit("host-location", payload);
  }, [code, memberId, position, isHost]);

  // Drop stale members.
  useEffect(() => {
    const interval = setInterval(() => {
      setMembers((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [id, m] of next) {
          if (id !== memberId && Date.now() - m.lastSeen > STALE_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [memberId]);

  const claimHost = useCallback(() => {
    if (!code) return;
    getSocket().emit("set-host", { code, memberId, name });
    setHostId(memberId);
  }, [code, memberId, name]);

  return { members: Array.from(members.values()), hostId, isHost, claimHost };
}
