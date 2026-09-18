"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { addPlayersToPlay } from "@/lib/actions/plays";
import { useRouter } from "next/navigation";

export function AddPlayersForm({
  playId,
  available,
}: {
  playId: string;
  available: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!available.length) {
    return (
      <p className="text-sm text-ink-muted">
        Todos os jogadores já estão neste play (ou cadastre novos).
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const ids = fd.getAll("playerId") as string[];
        start(async () => {
          await addPlayersToPlay(playId, ids);
          router.refresh();
        });
      }}
    >
      <div className="grid max-h-52 gap-2 overflow-y-auto rounded-2xl border border-line bg-white/70 p-3 sm:grid-cols-2">
        {available.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-medium transition hover:bg-mint-soft/60"
          >
            <input
              type="checkbox"
              name="playerId"
              value={p.id}
              className="size-4 accent-[var(--mint)]"
            />
            {p.name}
          </label>
        ))}
      </div>
      <Button type="submit" disabled={pending} variant="accent">
        Adicionar selecionados
      </Button>
    </form>
  );
}
