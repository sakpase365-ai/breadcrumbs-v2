import Link from 'next/link';

export default function HelpCenterPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition">
          ← Back to Settings
        </Link>
        <h1 className="font-display text-3xl text-foreground">Help Center</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Breadcrumbs helps you preserve meaningful messages for your family.
            Use capture to write or record, and use Family Library to review what you have saved.
          </p>
          <p>
            If sign-in links are delayed, check your spam folder and wait a minute before requesting another link.
          </p>
          <p>
            Need direct support? Email{' '}
            <a className="text-foreground underline" href="mailto:support@breadcrumbs.app">
              support@breadcrumbs.app
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}
