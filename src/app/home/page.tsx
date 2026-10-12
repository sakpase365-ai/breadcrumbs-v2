'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { FamilyHome, HomeComposer } from '@/components/iroh/FamilyHome';
import { countMemoryTopics } from '@/lib/memory-overview';
import { firstName } from '@/lib/nameUtils';

type HomeEntry = { domain: string; content: string; recipient_name: string | null };
export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [profileRes, entriesRes] = await Promise.all([fetch('/api/profile'), fetch('/api/entries')]);
        if (cancelled) return;
        if (profileRes.status === 401 || entriesRes.status === 401) { router.replace('/login?next=/home'); return; }
        if (profileRes.status === 422) { router.replace('/setup'); return; }
        if (!profileRes.ok || !entriesRes.ok) throw new Error('Home unavailable');
        const [profileData, entriesData] = await Promise.all([profileRes.json(), entriesRes.json()]);
        if (cancelled) return;
        setName(firstName(profileData.profile.name));
        setEntries(entriesData.entries ?? []);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [router]);
  const onWrite = () => router.push('/capture');
  const onRecord = () => router.push('/capture?mode=voice');
  return <main className="iroh-page">
    {loading ? <p role="status" className="py-20 text-sm text-muted-foreground">Loading your family memory…</p> : error ? <div className="py-20 space-y-4"><p>Could not load your family space.</p><button onClick={() => window.location.reload()} className="btn-primary">Try again</button></div> : <FamilyHome name={name} topics={countMemoryTopics(entries)} recent={entries[0] ? { content: entries[0].content, recipient: entries[0].recipient_name } : null} onWrite={onWrite} onRecord={onRecord} onNavigate={(view) => router.push(view === 'library' ? '/archive' : view === 'hear' ? '/ask' : '/foundation')} />}
    <HomeComposer onWrite={onWrite} onRecord={onRecord} /><BottomNav />
  </main>;
}
