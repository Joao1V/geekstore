import { Checkout } from '@/modules/store/checkout';

export const metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default function Page() {
  return <Checkout />;
}
