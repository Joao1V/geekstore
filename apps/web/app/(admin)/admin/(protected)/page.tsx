import { Admin } from '@/modules/admin/admin';

export const metadata = { title: 'Painel de gestão', robots: { index: false, follow: false } };

export default function Page() {
  return <Admin />;
}
