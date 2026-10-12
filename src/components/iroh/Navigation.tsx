'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, House, PenLine, BookOpen, MessageCircle, UserRound, ShieldCheck, ArrowUpRight } from 'lucide-react';

const routes = [
  { href: '/home', name: 'Home', icon: House },
  { href: '/capture', name: 'Leave a breadcrumb', icon: PenLine },
  { href: '/archive', name: 'Family Library', icon: BookOpen },
  { href: '/ask', name: 'Hear', icon: MessageCircle },
  { href: '/foundation', name: 'Your Story', icon: UserRound },
];

export default function VariantNavigation() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = pathname === '/preview';
  const previewViews: Record<string, string> = { '/home': 'home', '/capture': 'capture', '/archive': 'library', '/ask': 'hear', '/foundation': 'story' };
  const title = pathname === '/ask' ? 'Hear' : pathname === '/capture' ? 'Leave a breadcrumb' : pathname === '/archive' ? 'Family Library' : 'Breadcrumbs';

  if (preview || pathname === '/capture') return null;

  return <>
    <header className="iroh-topbar">
      <button aria-label="Open navigation" className="iroh-icon-button" onClick={() => dialog.current?.showModal()}><Menu size={18} /></button>
      <Link href={preview ? '/preview' : '/home'} className="text-sm font-medium tracking-tight">{title}</Link>
      <Link href={preview ? '/login?next=/home' : '/settings'} aria-label={preview ? 'Sign in to your family' : 'Open settings'} className="iroh-avatar"><UserRound size={16} /></Link>
    </header>
    <dialog ref={dialog} className="iroh-drawer" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="flex items-center justify-between mb-8"><p className="text-lg font-semibold">Breadcrumbs</p><button aria-label="Close navigation" className="iroh-icon-button" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p className="iroh-eyebrow mb-3">Your family space</p>
      <nav aria-label="Main navigation" className="space-y-1">{routes.map(({ href, name, icon: Icon }) => <Link key={href} href={preview ? `/preview?view=${previewViews[href]}` : href} onClick={(event) => { if (preview) { event.preventDefault(); window.dispatchEvent(new CustomEvent('breadcrumbs-preview-navigate', { detail: previewViews[href] })); } dialog.current?.close(); }} aria-current={pathname === href ? 'page' : undefined} className={`iroh-menu-link ${pathname === href ? 'iroh-menu-active' : ''}`}><Icon size={18} /><span>{name}</span></Link>)}</nav>
      <div className="border-t border-border mt-8 pt-5 space-y-3"><Link href="/preview" onClick={() => dialog.current?.close()} className="flex items-center justify-between text-sm min-h-[44px] text-muted-foreground">Explore this design<ArrowUpRight size={16} /></Link><p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} />A private space for your family</p></div>
    </dialog>
  </>;
}
