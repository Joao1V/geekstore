import { Shell } from '@/modules/store/shell';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
