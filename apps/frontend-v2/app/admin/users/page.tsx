"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useRequireRole } from "@/features/auth/useRequireRole";
import { getAdminUsers, updateAdminUser } from "@/lib/api";
import AdminHeader from "../_components/AdminHeader";
import type { AdminUser } from "@/types/api";

export default function AdminUsersPage() {
  const { ready } = useRequireRole("admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = (q?: string) => getAdminUsers(q).then(setUsers).catch(() => {});

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => load(query || undefined), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleActive = async (u: AdminUser) => {
    setUpdating(u.id);
    try {
      const updated = await updateAdminUser(u.id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch {
      toast.error("Couldn't update user");
    } finally {
      setUpdating(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
      <AdminHeader title="Users" subtitle={`${users.length} shown`} />

      <div className="px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or phone"
            className="h-12 rounded-2xl pl-11 text-sm font-semibold"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 px-6">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{u.fullName}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {u.phoneNumber} · {u.role}
              </p>
            </div>
            <button
              onClick={() => toggleActive(u)}
              disabled={updating === u.id}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
                u.isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
              }`}
            >
              {u.isActive ? "Active" : "Suspended"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
