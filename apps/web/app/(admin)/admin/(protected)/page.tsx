import { AdminHome } from '@/modules/admin/dashboard/admin-home';

export const metadata = { title: 'Painel de gestão', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminHome />;
}
