'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, MessageCircle, Mic, Users } from 'lucide-react';

export const REFERENCE_TABS = [
  { href: '/capture', label: 'Capture', icon: Mic, view: 'capture' },
  { href: '/archive', label: 'Legacy', icon: BookOpen, view: 'library' },
  { href: '/family', label: 'Family', icon: Users, view: 'family' },
  { href: '/ask', label: 'Ask', icon: MessageCircle, view: 'hear' },
] as const;

export function PreviewTabs({ view, onNavigate }: { view: string; onNavigate: (view: string) => void }) {
  return <nav className="reference-tabs" aria-label="Preview navigation">{REFERENCE_TABS.map(({ label, icon: Icon, view: next }) => <button key={next} aria-current={view === next ? 'page' : undefined} onClick={() => onNavigate(next)}><Icon size={23} /><span>{label}</span></button>)}</nav>;
}
export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/preview') return null;
  return <nav className="reference-tabs" aria-label="Main navigation">{REFERENCE_TABS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}><Icon size={23} /><span>{label}</span></Link>)}</nav>;
}
