// Peso e dimensões do ERP: kg e cm, com muita sujeira (zeros, 1x1x1 de placeholder e, em alguns
// itens, metros misturados com centímetros). Só entra o que é inequivocamente confiável; o resto
// vira `null` e uma pendência no relatório, porque medida errada estraga a cotação de frete.

export type MeasureIssue =
  | 'weight_missing'
  | 'weight_placeholder'
  | 'dims_missing'
  | 'dims_placeholder'
  | 'dims_suspect';

export type Measures = {
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  issues: MeasureIssue[];
};

type RawMeasures = {
  weightKg: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
};

const MIN_CM = 3; // abaixo disso a unidade é ambígua (0,18 pode ser 0,18 m)
const MAX_CM = 250;

const isPositive = (value: number | null): value is number => value !== null && value > 0;

function isPlaceholderDims({ height, width, length }: RawMeasures): boolean {
  return height === 1 && width === 1 && length === 1;
}

function dimsIssue(raw: RawMeasures): MeasureIssue | null {
  const dims = [raw.height, raw.width, raw.length];
  if (!dims.some(isPositive)) return 'dims_missing';
  if (isPlaceholderDims(raw)) return 'dims_placeholder';
  const reliable = dims.every((dim) => isPositive(dim) && dim >= MIN_CM && dim <= MAX_CM);
  return reliable ? null : 'dims_suspect';
}

export function normalizeMeasures(raw: RawMeasures): Measures {
  const placeholder = isPlaceholderDims(raw) && raw.weightKg === 1;
  const weightOk = isPositive(raw.weightKg) && !placeholder;
  const dimsProblem = dimsIssue(raw);

  const issues: MeasureIssue[] = [
    ...(weightOk
      ? []
      : [placeholder ? ('weight_placeholder' as const) : ('weight_missing' as const)]),
    ...(dimsProblem ? [dimsProblem] : []),
  ];
  const toMm = (cm: number | null) => (dimsProblem ? null : Math.round((cm as number) * 10));

  return {
    weightG: weightOk ? Math.round((raw.weightKg as number) * 1000) : null,
    lengthMm: toMm(raw.length),
    widthMm: toMm(raw.width),
    heightMm: toMm(raw.height),
    issues,
  };
}
