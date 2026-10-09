import { PageEditorScreen } from '@/modules/admin/content/page-editor';
import { RequirePermission } from '@/modules/admin/ui/require-permission';

export const metadata = { title: 'Editar página', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ page_id: string }> }) {
  const { page_id } = await params;
  return (
    <RequirePermission permission="content:read">
      <PageEditorScreen pageId={page_id} />
    </RequirePermission>
  );
}
