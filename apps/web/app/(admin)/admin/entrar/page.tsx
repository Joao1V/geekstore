import { AdminLogin } from '@/modules/admin/admin-login';

export const metadata = { title: 'Entrar no painel', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminLogin />;
}
