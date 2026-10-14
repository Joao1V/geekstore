import { Suspense } from 'react';

import { NewsletterLink } from '@/modules/store/newsletter-link';

export const metadata = { title: 'Newsletter', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <NewsletterLink mode="confirm" />
    </Suspense>
  );
}
