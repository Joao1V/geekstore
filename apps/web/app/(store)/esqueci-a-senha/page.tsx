import { ForgotPassword } from '@/modules/store/password-recovery';

export const metadata = { title: 'Recuperar senha', robots: { index: false, follow: false } };

export default function Page() {
  return <ForgotPassword />;
}
