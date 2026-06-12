'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function Redirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const next = searchParams.get('next');
    router.replace(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }, [router, searchParams]);
  return null;
}

export default function LoginEmailPage() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
