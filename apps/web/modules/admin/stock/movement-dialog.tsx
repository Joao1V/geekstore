'use client';

import type { Location, SkuGridRow, StockMovementBody } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldNumber, FieldSelect } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCreateMovement } from '../services/stock/mutations';
import { MANUAL_MOVEMENT_OPTIONS } from './movement-labels';

const movementFormSchema = z
  .object({
    type: z.enum(['inbound', 'outbound', 'adjustment', 'return']),
    location_id: z.string().min(1, 'Escolha o local'),
    quantity: z.number({ error: 'Informe a quantidade' }).int('Use um número inteiro'),
    reason: z.string().trim().min(1, 'Informe o motivo').max(255, 'No máximo 255 caracteres'),
  })
  .refine((values) => values.quantity !== 0, {
    path: ['quantity'],
    message: 'A quantidade não pode ser 0',
  })
  .refine((values) => values.type === 'adjustment' || values.quantity > 0, {
    path: ['quantity'],
    message: 'A quantidade deve ser positiva',
  });
type MovementFormValues = z.infer<typeof movementFormSchema>;

function Form({
  row,
  locations,
  onClose,
}: {
  row: SkuGridRow;
  locations: Location[];
  onClose: () => void;
}) {
  const createMovement = useCreateMovement();
  const [formError, setFormError] = useState('');
  const options = useMemo(
    () => locations.map((location) => ({ value: location.location_id, label: location.name })),
    [locations]
  );
  const defaultLocation = (locations.find((l) => l.type === 'warehouse') ?? locations[0])
    ?.location_id;

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      type: 'inbound',
      location_id: defaultLocation ?? '',
      quantity: 1,
      reason: '',
    },
  });
  const type = useWatch({ control, name: 'type' });

  const submit = async (values: MovementFormValues) => {
    setFormError('');
    const body: StockMovementBody = { sku_id: row.sku_id, ...values };
    try {
      await createMovement.mutateAsync(body);
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
      <p className="muted text-sm">
        Saldo atual: <strong className="text-foreground">{row.on_hand}</strong> físico,{' '}
        <strong className="text-foreground">{row.reserved}</strong> reservado,{' '}
        <strong className="text-foreground">{row.available}</strong> disponível.
      </p>
      <Controller
        control={control}
        name="type"
        render={({ field, fieldState }) => (
          <FieldSelect
            field={field}
            fieldState={fieldState}
            label="Tipo de movimentação"
            options={MANUAL_MOVEMENT_OPTIONS}
          />
        )}
      />
      <Controller
        control={control}
        name="location_id"
        render={({ field, fieldState }) => (
          <FieldSelect field={field} fieldState={fieldState} label="Local" options={options} />
        )}
      />
      <Controller
        control={control}
        name="quantity"
        render={({ field, fieldState }) => (
          <FieldNumber
            field={field}
            fieldState={fieldState}
            label="Quantidade"
            minValue={type === 'adjustment' ? undefined : 1}
          />
        )}
      />
      <Controller
        control={control}
        name="reason"
        render={({ field, fieldState }) => (
          <FieldInput
            field={field}
            fieldState={fieldState}
            label="Motivo"
            placeholder="Ex.: compra do fornecedor, contagem de inventário"
          />
        )}
      />
      {formError && (
        <p className="error m-0" role="alert">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Action className="action-outline" onPress={onClose}>
          Cancelar
        </Action>
        <Action type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar movimentação'}
        </Action>
      </div>
    </form>
  );
}

export function MovementDialog({
  row,
  locations,
  onClose,
}: {
  row: SkuGridRow | null;
  locations: Location[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={row !== null}
      onChange={(open) => !open && onClose()}
      title={row ? `Movimentar ${row.code}` : 'Movimentar'}
    >
      {row && <Form row={row} locations={locations} onClose={onClose} />}
    </Dialog>
  );
}
