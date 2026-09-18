"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { createPair } from "@/lib/actions/plays";
import { useRouter } from "next/navigation";

export function CreatePairForm({
  playId,
  unpaired,
}: {
  playId: string;
  unpaired: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (unpaired.length < 2) {
    return (
      <p className="text-sm text-ink-muted">
        Precisa de pelo menos 2 jogadores sem dupla.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const a = String(fd.get("playerAId"));
        const b = String(fd.get("playerBId"));
        const label = String(fd.get("label") || "");
        start(async () => {
          const res = await createPair(playId, a, b, label);
          if (res?.error) setError(res.error);
          else {
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      <div>
        <Label>Jogador A</Label>
        <Select name="playerAId" required defaultValue="" disabled={pending}>
          <option value="" disabled>
            Selecione
          </option>
          {unpaired.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Jogador B</Label>
        <Select name="playerBId" required defaultValue="" disabled={pending}>
          <option value="" disabled>
            Selecione
          </option>
          {unpaired.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label>Apelido da dupla (opcional)</Label>
        <Input name="label" placeholder="Ex: As Tubarões" disabled={pending} />
      </div>
      {error ? (
        <p className="text-sm font-medium text-coral sm:col-span-2">{error}</p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} variant="accent" aria-busy={pending}>
          {pending ? (
            <>
              <Spinner />
              Criando…
            </>
          ) : (
            "Criar dupla"
          )}
        </Button>
      </div>
    </form>
  );
}
