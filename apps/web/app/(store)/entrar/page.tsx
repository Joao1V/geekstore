import { Suspense } from 'react';

import { Account } from '@/modules/store/account';

export const metadata = { title: 'Entrar', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
