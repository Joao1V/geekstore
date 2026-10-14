import {
  Bot,
  Castle,
  Crown,
  Dices,
  Gamepad2,
  Ghost,
  type LucideIcon,
  Puzzle,
  Rocket,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  WandSparkles,
} from 'lucide-react';

type IconProps = { size?: number; strokeWidth?: number };

/** Capacete de vilão sombrio (silhueta genérica), no traço dos ícones do lucide. */
function Helmet({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2C7.6 2 4.5 5.2 4.5 9.5V13l2 3.5V20h2l1-2h5l1 2h2v-3.5l2-3.5V9.5C19.5 5.2 16.4 2 12 2z" />
      <path d="M8 10l2.5 1.5M16 10l-2.5 1.5M10 15h4M10.5 17h3" />
    </svg>
  );
}

/** Boneco colecionável de cabeça grande, no mesmo traço. */
function Figure({ size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="2" width="15" height="12" rx="4" />
      <path d="M9 7.5h.01M15 7.5h.01M8.5 14v4h7v-4M10 18v3M14 18v3" />
    </svg>
  );
}

const ICONS: Array<LucideIcon | typeof Helmet> = [
  Helmet,
  Figure,
  Sword,
  Gamepad2,
  WandSparkles,
  Ghost,
  Rocket,
  Shield,
  Skull,
  Crown,
  Swords,
  Dices,
  Bot,
  Castle,
  Puzzle,
  Sparkles,
];

const COLUMNS = 6;
const ROWS = 9;
const ICON_SIZE = 46;

/**
 * Fundo decorativo do painel de entrar: universo geek repetido (capacete, boneco colecionável,
 * espada, controle, varinha...) em traço fino, com opacidade baixa, cada ícone girado e flutuando
 * num ritmo próprio. Posição, giro e atraso saem do índice, então o servidor e o cliente
 * renderizam igual (sem `Math.random`).
 */
export function GeekPattern({ tone = 'text-ink' }: { tone?: string }) {
  const cells = Array.from({ length: COLUMNS * ROWS }, (_, index) => index);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 grid grid-cols-6 grid-rows-9 place-items-center opacity-[0.13] ${tone}`}
    >
      {cells.map((index) => {
        // Passo coprimo ao total de ícones: vizinhos nunca repetem o mesmo desenho.
        const Icon = ICONS[(index * 5) % ICONS.length] ?? Sparkles;
        const rotation = ((index * 37) % 60) - 30;
        return (
          <span
            key={index}
            className="animate-float motion-reduce:animate-none"
            style={{
              rotate: `${rotation}deg`,
              animationDelay: `${-(index % 9) * 1.1}s`,
              animationDuration: `${7 + (index % 5)}s`,
            }}
          >
            <Icon size={ICON_SIZE} strokeWidth={1.6} />
          </span>
        );
      })}
    </div>
  );
}
