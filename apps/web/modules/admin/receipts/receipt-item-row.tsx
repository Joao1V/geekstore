'use client';

import type { ReceiptItem } from '@geekstore/shared';
import { formatBRL } from '@geekstore/shared';
import { Button } from '@heroui/react';
import { useState } from 'react';

import { Badge } from '../ui/badge';
import { Td, Tr } from '../ui/table';
import { SkuPicker } from './sku-picker';

const METHOD_LABEL = { mapping: 'pelo fornecedor', ean: 'pelo EAN', manual: 'manual' } as const;

/** Uma linha da nota: o item, o SKU ligado (ou o seletor) e o botão de ignorar. */
export function ReceiptItemRow({
  receiptId,
  item,
  editable,
  isUpdating,
  onLink,
  onIgnore,
}: {
  receiptId: string;
  item: ReceiptItem;
  editable: boolean;
  isUpdating: boolean;
  onLink: (itemId: string, skuId: string) => void;
  onIgnore: (itemId: string, ignored: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const needsSku = !item.sku && !item.ignored;

  return (
    <>
      <Tr className={item.ignored ? 'opacity-60' : ''}>
        <Td className="w-10 text-muted">{item.line}</Td>
        <Td className="min-w-[16rem]">
          <p className="m-0 font-extrabold">{item.description}</p>
          <p className="muted m-0 text-xs">
            {[item.supplier_code && `Cód. ${item.supplier_code}`, item.ean && `EAN ${item.ean}`]
              .filter(Boolean)
              .join(' · ') || 'Sem código'}
          </p>
        </Td>
        <Td align="right">{item.quantity}</Td>
        <Td align="right">{formatBRL(item.unit_cost_cents)}</Td>
        <Td align="right">{formatBRL(item.total_cost_cents)}</Td>
        <Td className="min-w-[14rem]">
          {item.ignored && <Badge>Ignorado</Badge>}
          {item.sku && (
            <div className="grid gap-0.5">
              <code className="font-mono text-xs font-bold">{item.sku.code}</code>
              <span className="text-xs">{item.sku.product_name}</span>
              {item.match_method && (
                <span className="muted text-2xs">{METHOD_LABEL[item.match_method]}</span>
              )}
            </div>
          )}
          {needsSku && <Badge tone="error">Sem SKU</Badge>}
        </Td>
        <Td align="right">
          {editable && (
            <div className="flex justify-end gap-2">
              {!item.ignored && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-extrabold"
                  onPress={() => setPicking((open) => !open)}
                >
                  {item.sku ? 'Trocar SKU' : 'Ligar SKU'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs font-extrabold"
                isDisabled={isUpdating}
                onPress={() => onIgnore(item.receipt_item_id, !item.ignored)}
              >
                {item.ignored ? 'Considerar' : 'Ignorar'}
              </Button>
            </div>
          )}
        </Td>
      </Tr>
      {picking && editable && (
        <Tr>
          <Td colSpan={7} className="bg-surface-secondary/20">
            <SkuPicker
              receiptId={receiptId}
              itemId={item.receipt_item_id}
              disabled={isUpdating}
              onPick={(skuId) => {
                onLink(item.receipt_item_id, skuId);
                setPicking(false);
              }}
            />
          </Td>
        </Tr>
      )}
    </>
  );
}
