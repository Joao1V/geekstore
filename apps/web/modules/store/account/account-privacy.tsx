'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useDeleteAccount, useExportMyData } from '../services/customer/mutations';
import { useCustomerStore } from '../state/customer-store';

const schema = z.object({ confirm_email: z.string().trim().email('Digite o e-mail da conta') });
type Values = z.infer<typeof schema>;

/** Baixa um arquivo JSON feito no navegador, sem passar por outro servidor. */
function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Seus direitos da LGPD: levar uma cópia dos dados e excluir a conta (RF-CLI-07). */
export function AccountPrivacy() {
  const router = useRouter();
  const customer = useCustomerStore((state) => state.customer);
  const exportData = useExportMyData();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { confirm_email: '' },
  });

  const handleExport = async () => {
    setError('');
    try {
      download('meus-dados-geekstore.json', await exportData.mutateAsync());
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const submit = async (values: Values) => {
    setError('');
    try {
      await deleteAccount.mutateAsync(values);
      router.replace('/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-5">
      <section className="surface grid gap-3 p-[28px]">
        <h2 className="text-xl font-black">Meus dados</h2>
        <p className="muted m-0 text-sm">
          Baixe uma cópia de tudo o que guardamos sobre você: cadastro, endereços e pedidos. O
          arquivo não inclui sua senha.
        </p>
        <div>
          <Action className="action-outline" onPress={handleExport} disabled={exportData.isPending}>
            <Download size={17} /> {exportData.isPending ? 'Preparando…' : 'Baixar meus dados'}
          </Action>
        </div>
      </section>

      <section className="surface grid gap-3 p-[28px]">
        <h2 className="text-xl font-black">Excluir minha conta</h2>
        <p className="muted m-0 text-sm">
          Apaga seu cadastro, endereços e sessões. Os pedidos já feitos ficam guardados sem vínculo
          com a conta, porque a lei fiscal exige manter os dados da venda por 5 anos. Não dá para
          desfazer.
        </p>
        {error && !open && (
          <p role="alert" className="error m-0">
            {error}
          </p>
        )}
        <div>
          <Action
            className="action-outline"
            onPress={() => {
              reset({ confirm_email: '' });
              setError('');
              setOpen(true);
            }}
          >
            <Trash2 size={17} /> Excluir minha conta
          </Action>
        </div>
      </section>

      <Dialog open={open} onChange={setOpen} title="Excluir minha conta">
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <p className="m-0 text-sm">
            Para confirmar, digite o e-mail da conta: <strong>{customer?.email}</strong>.
          </p>
          <Controller
            control={control}
            name="confirm_email"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="E-mail da conta"
                type="email"
                autoComplete="off"
              />
            )}
          />
          {error && (
            <p role="alert" className="error m-0">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action type="button" className="action-outline" onPress={() => setOpen(false)}>
              Voltar
            </Action>
            <Action type="submit" disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? 'Excluindo…' : 'Excluir para sempre'}
            </Action>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
