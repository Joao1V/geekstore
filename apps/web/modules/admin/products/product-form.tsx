'use client';

import { type ProductDetail, suggestProductCode } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Archive, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';

import { Action, FieldInput, FieldSelect, FieldTextarea } from '@/components/ui';
import { BrandAutocomplete } from '../brands/brand-autocomplete';
import { CategoryAutocomplete } from '../categories/category-autocomplete';
import { getErrorMessage } from '../lib/errors';
import { slugify } from '../lib/format';
import { useCan } from '../lib/use-can';
import {
  useArchiveProduct,
  useCreateProduct,
  useUpdateProduct,
} from '../services/catalog/mutations';
import {
  attributesQueryOptions,
  categoryAttributesQueryOptions,
  collectionsQueryOptions,
} from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { GridSection } from './grid-section';
import { PRODUCT_STATUS_OPTIONS } from './labels';
import {
  type ProductFormValues,
  productFormDefaults,
  productFormSchema,
  splitSkus,
  toProductBody,
  toProductUpdateBody,
} from './product-form-schema';
import { ProductImages } from './product-images';

const SECTION = 'surface grid gap-5 p-6 max-md:p-4';

function CollectionChips({ product }: { product: ProductDetail }) {
  const { data: collections } = useQuery(collectionsQueryOptions());
  const linked = (collections ?? []).filter((collection) =>
    product.collection_ids.includes(collection.collection_id)
  );
  return (
    <section className={SECTION} aria-labelledby="product-collections">
      <h2 id="product-collections" className="text-xl font-extrabold">
        Coleções
      </h2>
      <div className="flex flex-wrap gap-2">
        {linked.length ? (
          linked.map((collection) => (
            <Badge key={collection.collection_id}>{collection.name}</Badge>
          ))
        ) : (
          <p className="muted text-sm">Este produto não está em nenhuma coleção.</p>
        )}
      </div>
      <p className="muted text-sm">
        A participação em coleções é gerenciada (com ordenação) na tela de{' '}
        <Link href="/admin/colecoes/" className="font-extrabold underline">
          coleções
        </Link>
        .
      </p>
    </section>
  );
}

export function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const canWrite = useCan('catalog:write');
  const isEditing = Boolean(product);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const archiveProduct = useArchiveProduct();
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Referência estável enquanto os DADOS não mudam (upload de imagem refaz o `product` mas não isto),
  // para o `values` do useForm não resetar o formulário no meio da edição.
  const defaultsJson = JSON.stringify(productFormDefaults(product));
  const defaults = useMemo<ProductFormValues>(() => JSON.parse(defaultsJson), [defaultsJson]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    values: defaults,
  });
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, dirtyFields, errors },
  } = form;
  const skus = useFieldArray({ control, name: 'skus' });
  const categoryId = useWatch({ control, name: 'category_id' });
  const { data: categoryRules } = useQuery(categoryAttributesQueryOptions(categoryId));
  const { data: definitions } = useQuery(attributesQueryOptions());

  const submit = async (values: ProductFormValues) => {
    setFormError('');
    setSaved(false);
    try {
      if (product) {
        await updateProduct.mutateAsync({
          product_id: product.product_id,
          product: toProductUpdateBody(values),
          ...splitSkus(values),
        });
        setSaved(true);
        return;
      }
      const created = await createProduct.mutateAsync(toProductBody(values));
      router.replace(`/admin/produtos/${created.product_id}/`);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const archive = async () => {
    if (!product) return;
    try {
      await archiveProduct.mutateAsync(product.product_id);
      router.replace('/admin/produtos/');
    } catch (error) {
      setFormError(getErrorMessage(error));
      setConfirmArchive(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(submit)} className="grid gap-6" noValidate>
        <section className={SECTION} aria-labelledby="product-data">
          <h2 id="product-data" className="text-xl font-extrabold">
            Dados do produto
          </h2>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FieldInput
                field={{
                  ...field,
                  onChange: (event) => {
                    field.onChange(event);
                    if (!isEditing && !dirtyFields.slug) {
                      setValue('slug', slugify(event.target.value), { shouldValidate: false });
                    }
                    if (!isEditing && !dirtyFields.code) {
                      setValue('code', suggestProductCode(event.target.value), {
                        shouldValidate: false,
                      });
                    }
                  },
                }}
                fieldState={fieldState}
                label="Nome"
              />
            )}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="code"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Código do produto"
                  description={
                    isEditing
                      ? 'O código é imutável.'
                      : 'Base do SKU das variações. Ex.: CAM-NARUTO'
                  }
                  disabled={isEditing}
                  maxLength={40}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="slug"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Slug"
                  description="Parte da URL do produto. Único."
                />
              )}
            />
            <Controller
              control={control}
              name="brand_id"
              render={({ field, fieldState }) => (
                <BrandAutocomplete field={field} fieldState={fieldState} />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="category_id"
              render={({ field, fieldState }) => (
                <CategoryAutocomplete field={field} fieldState={fieldState} />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field, fieldState }) => (
                <FieldSelect
                  field={field}
                  fieldState={fieldState}
                  label="Situação"
                  options={PRODUCT_STATUS_OPTIONS}
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <FieldTextarea field={field} fieldState={fieldState} label="Descrição" rows={6} />
            )}
          />
        </section>

        <section className={SECTION} aria-labelledby="product-seo">
          <h2 id="product-seo" className="text-xl font-extrabold">
            SEO
          </h2>
          <Controller
            control={control}
            name="seo_title"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Título (title)"
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
                label="Descrição (meta description)"
                rows={3}
                maxLength={500}
              />
            )}
          />
          <Controller
            control={control}
            name="canonical_url"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="URL canônica"
                required={false}
                placeholder="https://"
              />
            )}
          />
        </section>

        <section className={SECTION} aria-labelledby="product-skus">
          <h2 id="product-skus" className="text-xl font-extrabold">
            SKUs e variações
          </h2>
          <p className="muted text-sm">
            Produto simples tem 1 SKU. Se ele existe em cores, tamanhos ou outras versões, ligue a
            grade: cada combinação vira um SKU, com o código montado a partir do código do produto.
          </p>
          <GridSection
            form={form}
            skus={skus}
            definitions={definitions ?? []}
            rules={categoryRules ?? []}
            isEditing={isEditing}
          />
          {errors.skus?.message && (
            <p className="error m-0" role="alert">
              {errors.skus.message}
            </p>
          )}
        </section>

        {formError && (
          <p className="error m-0" role="alert">
            {formError}
          </p>
        )}
        {saved && (
          <p className="notice m-0" role="status">
            Produto salvo.
          </p>
        )}
        {canWrite ? (
          <div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t border-border bg-background py-4">
            <Action type="submit" disabled={isSubmitting}>
              <Save size={17} />
              {isSubmitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar produto'}
            </Action>
            {isEditing && product?.status !== 'archived' && (
              <Action className="action-outline" onPress={() => setConfirmArchive(true)}>
                <Archive size={17} /> Arquivar produto
              </Action>
            )}
          </div>
        ) : (
          <p className="notice m-0">Seu perfil só pode consultar o catálogo.</p>
        )}
      </form>

      {product && (
        <>
          <ProductImages
            productId={product.product_id}
            productName={product.name}
            media={product.media}
            canWrite={canWrite}
          />
          <CollectionChips product={product} />
        </>
      )}
      {!product && (
        <p className="muted text-sm">
          Depois de criar o produto você poderá enviar as imagens e ver as coleções.
        </p>
      )}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Arquivar produto"
        confirmLabel="Arquivar"
        onConfirm={archive}
        isPending={archiveProduct.isPending}
      >
        O produto sai da loja e passa para arquivado. Os SKUs, o histórico de pedidos e o estoque
        são preservados.
      </ConfirmDialog>
    </div>
  );
}
