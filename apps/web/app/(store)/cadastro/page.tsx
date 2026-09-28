import { Account } from '@/modules/store/account';

export const metadata = { title: 'Criar conta', robots: { index: false, follow: false } };

export default function Page() {
  return <Account register />;
}
