"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Users, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { addTrustedContact, deleteTrustedContact, listTrustedContacts } from "@/lib/api";
import type { EmergencyContact } from "@/types/api";

export default function TrustedContactsPage() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listTrustedContacts()
      .then(setContacts)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  const handleAdd = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      setError("Name and phone number are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addTrustedContact({ name: name.trim(), phoneNumber: phoneNumber.trim(), relationship: relationship.trim() || undefined });
      setName("");
      setPhoneNumber("");
      setRelationship("");
      setShowAdd(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add contact");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await deleteTrustedContact(id).catch(() => load());
  };

  if (!ready) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
      <div className="flex items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4">
        <button
          onClick={() => router.back()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Trusted Contacts</h1>
          <p className="text-xs font-semibold text-muted-foreground">Notified automatically when you trigger SOS</p>
        </div>
      </div>

      <div className="flex-1 px-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-bold text-foreground">No trusted contacts yet</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Add up to 5 people to notify instantly on SOS.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-secondary text-base font-extrabold text-foreground">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Phone className="h-3 w-3" /> {c.phoneNumber}
                    {c.relationship ? ` · ${c.relationship}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  aria-label={`Remove ${c.name}`}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger active:scale-90 transition-transform"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {contacts.length < 5 && (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-sm font-bold text-foreground active:scale-[0.98] transition-transform"
          >
            <Plus className="h-4 w-4" /> Add Trusted Contact
          </button>
        )}
      </div>

      <Dialog
        open={showAdd}
        onOpenChange={(o) => {
          setShowAdd(o);
          if (!o) setError(null);
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Add Trusted Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input autoFocus placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="h-14 rounded-2xl text-base font-semibold" />
            <Input
              placeholder="Phone number (e.g. +254700000000)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="h-14 rounded-2xl text-base font-semibold"
            />
            <Input
              placeholder="Relationship (optional)"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="h-14 rounded-2xl text-base font-semibold"
            />
            {error && <p className="text-xs font-bold text-danger">{error}</p>}
          </div>
          <Button size="lg" className="h-14 rounded-2xl text-base font-bold" onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Contact"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
