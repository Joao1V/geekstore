import { Suspense } from 'react';

import { Account } from '@/modules/store/account';

export const metadata = { title: 'Criar conta', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <Account register />
    </Suspense>
  );
}
