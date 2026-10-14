import { AccountPage } from '@/modules/admin/account/account-page';

export const metadata = {
  title: 'Configurações da conta',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AccountPage />;
}
