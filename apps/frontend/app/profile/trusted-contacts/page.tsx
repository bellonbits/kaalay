'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, LoadingOutlined,
  TeamOutlined, PhoneOutlined, CloseOutlined
} from '@ant-design/icons';
import { listTrustedContacts, addTrustedContact, deleteTrustedContact } from '../../../lib/api';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship?: string | null;
}

export default function TrustedContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listTrustedContacts();
      setContacts(data);
    } catch (err) {
      console.error('Failed to load trusted contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name.trim() || !phoneNumber.trim()) {
      setError('Name and phone number are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addTrustedContact({ name: name.trim(), phoneNumber: phoneNumber.trim(), relationship: relationship.trim() || undefined });
      setName('');
      setPhoneNumber('');
      setRelationship('');
      setShowAdd(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrustedContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete contact', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto overflow-x-hidden no-scroll font-outfit relative">
      <div className="pt-12 px-6 pb-5 flex items-center justify-between z-30 animate-fade-in sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-50/50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/profile')}
            className="w-11 h-11 bg-black rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-premium"
          >
            <ArrowLeftOutlined className="text-lg text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-black tracking-tight">Trusted Contacts</h1>
            <p className="text-[11px] font-bold text-gray-400">Alerted automatically when you trigger SOS</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-40 pt-6 space-y-4 animate-slide-up-spring">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingOutlined className="text-2xl text-gray-300" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-[24px] bg-gray-50 flex items-center justify-center mb-4">
              <TeamOutlined className="text-2xl text-gray-300" />
            </div>
            <p className="text-sm font-black text-black">No trusted contacts yet</p>
            <p className="text-xs font-bold text-gray-400 mt-1">Add up to 5 people to notify instantly when you trigger SOS.</p>
          </div>
        ) : (
          <div className="bg-white border-2 border-gray-50 rounded-[40px] p-2 space-y-1">
            {contacts.map((c, idx) => (
              <div
                key={c.id}
                className={`flex items-center gap-5 p-4 ${idx !== contacts.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="w-12 h-12 rounded-[18px] bg-gray-50 flex items-center justify-center text-black text-lg">
                  <TeamOutlined />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-black truncate">{c.name}</p>
                  <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                    <PhoneOutlined className="text-[10px]" /> {c.phoneNumber}
                    {c.relationship ? ` · ${c.relationship}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                  aria-label={`Remove ${c.name}`}
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))}
          </div>
        )}

        {contacts.length < 5 && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full p-6 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <PlusOutlined className="text-black" />
            <span className="text-sm font-black text-black uppercase tracking-wider">Add Trusted Contact</span>
          </button>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end animate-fade-in">
          <div className="w-full bg-[#F8F9FA] rounded-t-[50px] flex flex-col animate-slide-up-spring overflow-hidden shadow-2xl" style={{ paddingBottom: 'var(--safe-bottom)' }}>
            <div className="p-8 flex items-center justify-between bg-white border-b border-gray-100">
              <h2 className="text-xl font-black text-black tracking-tight">Add Trusted Contact</h2>
              <button
                onClick={() => { setShowAdd(false); setError(null); }}
                className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
              >
                <CloseOutlined className="text-black" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div className="input-container !bg-white">
                <input
                  autoFocus
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                />
              </div>
              <div className="input-container !bg-white">
                <input
                  placeholder="Phone number (e.g. +254700000000)"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                />
              </div>
              <div className="input-container !bg-white">
                <input
                  placeholder="Relationship (optional, e.g. Mother)"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                />
              </div>
              {error && <p className="text-xs font-bold text-red-500 px-2">{error}</p>}
            </div>

            <div className="p-8 pt-0">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="btn btn-black w-full py-5 shadow-premium flex items-center justify-center gap-3"
              >
                {saving ? <LoadingOutlined className="text-yellow-400" /> : <span>SAVE CONTACT</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
