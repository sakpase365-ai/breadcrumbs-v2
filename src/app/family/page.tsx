'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type Member = { id: string; name: string; role: string };
export default function FamilyPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [canInvite, setCanInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.status === 401) { router.replace('/login?next=/family'); return; }
        if (!response.ok) throw new Error('Family unavailable');
        const data = await response.json();
        if (cancelled) return;
        setMembers(data.familyMembers ?? []); setCanInvite(!!data.access?.canInvite);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [router]);
  return <main className="iroh-page space-y-5"><h1 className="text-2xl font-semibold">Your family.</h1>{loading ? <p role="status">Loading family…</p> : error ? <p role="alert">Could not load your family. Please refresh to try again.</p> : <><p className="text-sm text-muted-foreground">The people your breadcrumbs are for.</p>{members.map((member) => <div key={member.id} className="iroh-suggestion"><span className="reference-avatar">{member.name[0]}</span><div className="flex-1"><p>{member.name}</p><p className="text-xs text-muted-foreground capitalize">{member.role}</p></div></div>)}{!members.length && <p className="text-sm text-muted-foreground">No family members yet.</p>}{canInvite && <Link href="/family/invite" className="iroh-suggestion">Invite a family member<ChevronRight size={16} /></Link>}<Link href="/foundation" className="iroh-suggestion">Your Story<ChevronRight size={16} /></Link></>}<BottomNav /></main>;
}
