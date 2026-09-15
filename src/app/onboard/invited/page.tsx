'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import { ScreenContainer, ScreenContent } from '@/components/ui/design-primitives';

const INPUT = 'field-input';

const PRIMARY_BUTTON =
  'btn-primary';

interface ProfileResponse {
  profile: {
    name: string;
    family_name: string | null;
  };
  access?: {
    familyRole: string | null;
    isOwner: boolean;
  };
}

function formatRole(role: string | null | undefined): string {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InvitedOnboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [familyName, setFamilyName] = useState('');
  const [familyRole, setFamilyRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [roleWithinFamily, setRoleWithinFamily] = useState('');
  const [relationshipContext, setRelationshipContext] = useState('');

  useEffect(() => {
    try {
      if (sessionStorage.getItem('breadcrumbs_invited_onboarding_done') === '1') {
        router.replace('/capture');
        return;
      }
    } catch {
      // sessionStorage unavailable — continue
    }

    fetch('/api/profile')
      .then(async (res) => {
        if (!res.ok) {
          router.replace('/capture');
          return;
        }
        const data = (await res.json()) as ProfileResponse;
        if (data.access?.isOwner !== false) {
          // Owners went through setup — this page is for invited members only
          router.replace('/capture');
          return;
        }
        const fn =
          data.profile?.family_name?.trim() ||
          (data.profile?.name ? `${data.profile.name}'s Family` : 'the family');
        const role = formatRole(data.access?.familyRole);
        setFamilyName(fn);
        setFamilyRole(role);
        setFullName(data.profile?.name ?? '');
        setRoleWithinFamily(role);
        setLoading(false);
      })
      .catch(() => router.replace('/capture'));
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      sessionStorage.setItem(
        'breadcrumbs_onboarding_context',
        JSON.stringify({
          nickname: nickname.trim() || undefined,
          fullName: fullName.trim() || undefined,
          roleWithinFamily: roleWithinFamily.trim() || undefined,
          relationshipContext: relationshipContext.trim() || undefined,
          joinedAsInvited: true,
        }),
      );
      sessionStorage.setItem('breadcrumbs_invited_onboarding_done', '1');
    } catch {
      // Best-effort only
    }
    router.push('/capture');
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
      </main>
    );
  }

  return (
    <ScreenContainer className="screen-main-safe flex items-start justify-center !px-5 !py-0 sm:!px-6">
      <ScreenContent className="max-w-md !pb-12 space-y-7">
        <header className="pt-2 text-center">
          <AnimatedWordmark className="text-3xl font-serif font-light tracking-tight text-foreground" />
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3 text-center">
            <p className="type-label text-muted-foreground/70">Invite Accepted</p>
            <h1 className="font-display text-3xl leading-tight text-foreground">
              You&apos;ve joined<br />{familyName}.
            </h1>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
              {familyRole
                ? `Connected as ${familyRole}. `
                : ''}
              Tell us a little more so your Breadcrumbs connect to the right people.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground/70">Full name</span>
              <input
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground/70">What do family members call you?</span>
              <input
                type="text"
                placeholder="e.g. Nana, Grandpa Joe, Auntie May"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground/70">Role within this family</span>
              <input
                type="text"
                placeholder="e.g. Grandparent, child, cousin, family friend"
                value={roleWithinFamily}
                onChange={(e) => setRoleWithinFamily(e.target.value)}
                className={INPUT}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground/70">Relationship to existing family members</span>
              <textarea
                placeholder="e.g. I am Cairo's grandfather and Shama's father."
                value={relationshipContext}
                onChange={(e) => setRelationshipContext(e.target.value)}
                className="field-input min-h-[104px] leading-relaxed resize-none"
              />
            </label>
            <p className="text-xs text-muted-foreground/50">
              This joins you to the existing family graph. It does not recreate the Family Foundation.
            </p>
          </div>

          <div className="rounded-sm border border-border bg-card px-4 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground/70">Family Agent principle</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              When you ask the Family Agent, it bridges back to what was actually shared —
              saying things like &ldquo;Based on what they shared…&rdquo; rather than speaking as them.
            </p>
          </div>

          <button type="submit" className={PRIMARY_BUTTON}>
            Enter the family
          </button>
        </form>
      </ScreenContent>
    </ScreenContainer>
  );
}
