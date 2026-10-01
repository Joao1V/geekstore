export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  inbound: 'Entrada',
  outbound: 'Saída',
  adjustment: 'Ajuste',
  reservation: 'Reserva',
  release: 'Liberação',
  return: 'Devolução',
};

export const MANUAL_MOVEMENT_OPTIONS = [
  { value: 'inbound', label: 'Entrada (soma)' },
  { value: 'outbound', label: 'Saída (subtrai)' },
  { value: 'adjustment', label: 'Ajuste (diferença, pode ser negativa)' },
  { value: 'return', label: 'Devolução (soma)' },
];
