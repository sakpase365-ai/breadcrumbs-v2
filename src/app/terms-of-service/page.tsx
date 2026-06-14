import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background px-5 py-8">
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition">
          ← Back to Settings
        </Link>
        <h1 className="font-display text-3xl text-foreground">Terms of Service</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Breadcrumbs is provided to help families create and preserve meaningful memories.
            By using the app, you agree to use it lawfully and respectfully.
          </p>
          <p>
            You are responsible for maintaining access to your email account and protecting devices used to sign in.
          </p>
          <p>
            We may update these terms as the product evolves. Continued use after updates means you accept the revised terms.
          </p>
        </div>
      </div>
    </main>
  );
}
