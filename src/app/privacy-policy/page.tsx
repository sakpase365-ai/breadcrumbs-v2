import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition">
          ← Back to Settings
        </Link>
        <h1 className="font-display text-3xl text-foreground">Privacy Policy</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Breadcrumbs stores account and content data to provide core app functionality,
            including secure sign-in, capture, and family delivery features.
          </p>
          <p>
            We limit access using authentication and row-level controls.
            Shared memories are visible only to authorized family members.
          </p>
          <p>
            For privacy requests or questions, contact{' '}
            <a className="text-foreground underline" href="mailto:support@breadcrumbs.app">
              support@breadcrumbs.app
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}
