import { Suspense } from 'react';

import { ResetPassword } from '@/modules/store/password-recovery';

export const metadata = { title: 'Nova senha', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
