export const FORMAT_LABELS = {
  ROUND_ROBIN: "Round-robin (todos contra todos)",
  ROUND_ROBIN_MULTI: "Round-robin × N rodadas",
  BALANCED_QUEUE: "Fila balanceada",
} as const;

export const PAIRING_LABELS = {
  PLAYER_CHOICE: "Jogadores escolhem dupla",
  ADMIN_ASSIGN: "Admin define as duplas",
} as const;

export const STATUS_LABELS = {
  draft: "Rascunho",
  open: "Aberto",
  in_progress: "Em andamento",
  finished: "Finalizado",
} as const;

export function pairLabel(
  pair: {
    label: string | null;
    playerA: { name: string };
    playerB: { name: string };
  },
) {
  return pair.label || `${pair.playerA.name} / ${pair.playerB.name}`;
}

export function isPairActive(pair: { withdrawnAt: Date | string | null }) {
  return pair.withdrawnAt == null;
}

