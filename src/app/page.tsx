import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-warm flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full text-center space-y-8">

        {/* Wordmark */}
        <div>
          <h1 className="text-5xl font-bold text-navy tracking-tight">Breadcrumbs</h1>
          <p className="mt-3 text-lg text-muted font-serif italic">
            Leave something that lasts.
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-0.5 bg-gold mx-auto" />

        {/* CTA */}
        <div className="space-y-4">
          <Link
            href="/capture"
            className="block w-full py-4 px-8 bg-navy text-warm text-base font-semibold rounded-sm hover:bg-opacity-90 transition"
          >
            Write today's letter
          </Link>
          <Link
            href="/archive"
            className="block w-full py-4 px-8 border border-navy text-navy text-base font-semibold rounded-sm hover:bg-navy hover:text-warm transition"
          >
            View your archive
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-sm text-muted">
          One prompt. One entry. Everything else handled.
        </p>
      </div>
    </main>
  );
}
