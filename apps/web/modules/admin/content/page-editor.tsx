'use client';

import { type Page, type PageBody, type PageStatus, pageStatusSchema } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Markdown } from '@/components/markdown';
import { Action, FieldInput, FieldNumber, FieldSwitch, FieldTextarea } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { slugify } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useCreatePage, useDeletePage, useUpdatePage } from '../services/content/mutations';
import { pageDetailQueryOptions } from '../services/content/queries';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(255),
  slug: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(120)
    .regex(SLUG_PATTERN, 'Use minúsculas, números e hífens'),
  published: z.boolean(),
  body: z.string().max(100_000, 'Texto grande demais'),
  seo_title: z.string().max(255, 'No máximo 255 caracteres'),
  seo_description: z.string().max(500, 'No máximo 500 caracteres'),
  position: z.number().int().min(0).nullable(),
});
type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  title: '',
  slug: '',
  published: false,
  body: '',
  seo_title: '',
  seo_description: '',
  position: 0,
};

const fromPage = (page: Page): FormValues => ({
  title: page.title,
  slug: page.slug,
  published: page.status === 'published',
  body: page.body,
  seo_title: page.seo_title ?? '',
  seo_description: page.seo_description ?? '',
  position: page.position,
});

const statusOf = (published: boolean): PageStatus =>
  pageStatusSchema.parse(published ? 'published' : 'draft');

function PageForm({ page }: { page?: Page }) {
  const router = useRouter();
  const canWrite = useCan('content:write');
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const deletePage = useDeletePage();
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEditing = Boolean(page);
  const isLive = page?.status === 'published';

  const defaults = useMemo(() => (page ? fromPage(page) : emptyValues), [page]);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), values: defaults });
  const body = useWatch({ control, name: 'body' });
  const published = useWatch({ control, name: 'published' });

  const submit = async (values: FormValues) => {
    setFormError('');
    setSaved(false);
    const fields = {
      title: values.title.trim(),
      body: values.body,
      status: statusOf(values.published),
      seo_title: values.seo_title.trim() || null,
      seo_description: values.seo_description.trim() || null,
      position: values.position ?? 0,
    };
    try {
      if (page) {
        await updatePage.mutateAsync({
          page_id: page.page_id,
          // O endereço só vai se mudou: uma página publicada não aceita trocá-lo.
          body: values.slug === page.slug ? fields : { ...fields, slug: values.slug },
        });
        setSaved(true);
        return;
      }
      const created = await createPage.mutateAsync({
        ...fields,
        slug: values.slug,
      } satisfies PageBody);
      router.replace(`/admin/paginas/${created.page_id}/`);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const remove = async () => {
    if (!page) return;
    try {
      await deletePage.mutateAsync(page.page_id);
      router.replace('/admin/paginas/');
    } catch (error) {
      setFormError(getErrorMessage(error));
      setConfirmDelete(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid max-w-4xl gap-5" noValidate>
      <section className="surface grid gap-4 p-6 max-md:p-4" aria-labelledby="page-data">
        <h2 id="page-data" className="text-xl font-extrabold">
          Página
        </h2>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <FieldInput
                field={{
                  ...field,
                  onChange: (event) => {
                    field.onChange(event);
                    if (!isEditing && !dirtyFields.slug) {
                      setValue('slug', slugify(event.target.value), { shouldValidate: false });
                    }
                  },
                }}
                fieldState={fieldState}
                label="Título"
              />
            )}
          />
          <Controller
            control={control}
            name="slug"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Endereço"
                description={
                  isLive
                    ? 'Página publicada: o endereço não muda (despublique antes).'
                    : `Fica em /pagina/${field.value || 'endereco'}/`
                }
                disabled={isLive}
                maxLength={120}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="published"
          render={({ field, fieldState }) => (
            <FieldSwitch
              field={field}
              fieldState={fieldState}
              label={published ? 'Publicada (aparece na loja)' : 'Rascunho (só aqui no painel)'}
            />
          )}
        />
      </section>

      <section className="surface grid gap-3 p-6 max-md:p-4" aria-labelledby="page-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="page-body" className="text-xl font-extrabold">
            Texto
          </h2>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist">
            {(['Escrever', 'Pré-visualizar'] as const).map((label, index) => {
              const active = (index === 1) === preview;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`rounded-md px-3 py-1.5 text-xs font-extrabold ${active ? 'bg-geek-yellow text-ink' : 'text-muted'}`}
                  onClick={() => setPreview(index === 1)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {preview ? (
          <div className="min-h-64 rounded-xl border border-border p-5 text-muted">
            {body.trim() ? (
              <Markdown text={body} />
            ) : (
              <p className="m-0 text-sm">Nada escrito ainda.</p>
            )}
          </div>
        ) : (
          <Controller
            control={control}
            name="body"
            render={({ field, fieldState }) => (
              <FieldTextarea
                field={field}
                fieldState={fieldState}
                label="Conteúdo"
                rows={18}
                description="Use ## para títulos, - para listas, **negrito**, *itálico* e [texto](endereço) para links."
              />
            )}
          />
        )}
      </section>

      <section className="surface grid gap-4 p-6 max-md:p-4" aria-labelledby="page-seo">
        <h2 id="page-seo" className="text-xl font-extrabold">
          Busca e rodapé
        </h2>
        <Controller
          control={control}
          name="seo_title"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Título para o Google"
              description="Em branco: usa o título da página."
              required={false}
              maxLength={255}
            />
          )}
        />
        <Controller
          control={control}
          name="seo_description"
          render={({ field, fieldState }) => (
            <FieldTextarea
              field={field}
              fieldState={fieldState}
              label="Descrição para o Google"
              rows={3}
              maxLength={500}
            />
          )}
        />
        <div className="max-w-xs">
          <Controller
            control={control}
            name="position"
            render={({ field, fieldState }) => (
              <FieldNumber
                field={field}
                fieldState={fieldState}
                label="Ordem no rodapé"
                description="Menor número aparece primeiro."
                required={false}
                minValue={0}
              />
            )}
          />
        </div>
      </section>

      {formError && (
        <p className="error m-0" role="alert">
          {formError}
        </p>
      )}
      {saved && (
        <p className="notice m-0" role="status">
          Página salva.
        </p>
      )}
      {canWrite ? (
        <div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-border bg-background py-4">
          <div className="flex flex-wrap gap-3">
            <Action type="submit" disabled={isSubmitting}>
              <Save size={17} />
              {isSubmitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar página'}
            </Action>
            {isLive && page && (
              <Link
                href={`/pagina/${page.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="action action-outline"
              >
                <ExternalLink size={16} /> Ver na loja
              </Link>
            )}
          </div>
          {isEditing && !isLive && (
            <Action className="action-outline" onPress={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Apagar rascunho
            </Action>
          )}
        </div>
      ) : (
        <p className="notice m-0">Seu perfil só pode consultar o conteúdo.</p>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Apagar rascunho"
        confirmLabel="Apagar"
        onConfirm={remove}
        isPending={deletePage.isPending}
      >
        O rascunho "{page?.title}" será apagado. Uma página publicada precisa ser despublicada
        antes.
      </ConfirmDialog>
    </form>
  );
}

/** Edita uma página existente (carrega pelo id). */
export function PageEditorScreen({ pageId }: { pageId: string }) {
  const { data, isPending, error } = useQuery(pageDetailQueryOptions(pageId));
  if (isPending) return <p className="muted">Carregando página…</p>;
  if (error || !data) {
    return (
      <p className="error" role="alert">
        {getErrorMessage(error)}
      </p>
    );
  }
  return (
    <>
      <PageHeader
        title={data.title}
        eyebrow="Página"
        crumbs={[
          { label: 'Conteúdo' },
          { label: 'Páginas', href: '/admin/paginas/' },
          { label: data.title },
        ]}
      />
      <PageForm page={data} />
    </>
  );
}

export function NewPageScreen() {
  return (
    <>
      <PageHeader
        title="Nova página"
        eyebrow="Conteúdo"
        crumbs={[
          { label: 'Conteúdo' },
          { label: 'Páginas', href: '/admin/paginas/' },
          { label: 'Nova página' },
        ]}
      />
      <PageForm />
    </>
  );
}
