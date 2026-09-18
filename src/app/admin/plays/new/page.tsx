"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label, Select, LinkButton } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { createPlay } from "@/lib/actions/plays";

export default function NewPlayPage() {
  const [format, setFormat] = useState("ROUND_ROBIN");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isRandom = format === "RANDOM";

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-rise">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-bold">Novo play</h1>
        <LinkButton href="/admin/plays" variant="ghost">
          Cancelar
        </LinkButton>
      </div>

      <form
        className="surface space-y-5 rounded-3xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await createPlay(fd);
            if (res?.error) setError(res.error);
          });
        }}
      >
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="Ex: Sábado na areia"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="format">Formato dos jogos</Label>
          <Select
            id="format"
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={pending}
          >
            <option value="ROUND_ROBIN">Round-robin (todos contra todos)</option>
            <option value="ROUND_ROBIN_MULTI">Round-robin × N rodadas</option>
            <option value="BALANCED_QUEUE">Fila balanceada</option>
            <option value="RANDOM">Aleatório (duplas por rodada)</option>
          </Select>
        </div>
        {format === "ROUND_ROBIN_MULTI" ? (
          <div>
            <Label htmlFor="rounds">Rodadas</Label>
            <Input
              id="rounds"
              name="rounds"
              type="number"
              min={1}
              max={20}
              defaultValue={2}
              disabled={pending}
            />
          </div>
        ) : null}
        {!isRandom ? (
          <div>
            <Label htmlFor="pairingMode">Como formar duplas</Label>
            <Select
              id="pairingMode"
              name="pairingMode"
              defaultValue="ADMIN_ASSIGN"
              disabled={pending}
            >
              <option value="ADMIN_ASSIGN">Admin define as duplas</option>
              <option value="PLAYER_CHOICE">Jogadores escolhem (admin confirma)</option>
            </Select>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Duplas sorteadas a cada rodada. Ranking individual.
            </p>
            <div>
              <Label htmlFor="mixedPairing">Duplas mistas</Label>
              <Select
                id="mixedPairing"
                name="mixedPairing"
                defaultValue="IGNORE"
                disabled={pending}
              >
                <option value="IGNORE">Não considerar gênero</option>
                <option value="PREFERRED">Preferencialmente mistas</option>
                <option value="REQUIRED">Apenas mistas (obrigatório)</option>
              </Select>
            </div>
          </div>
        )}
        {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending}
          variant="accent"
          className="w-full"
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Spinner />
              Criando…
            </>
          ) : (
            "Criar play"
          )}
        </Button>
      </form>
    </div>
  );
}
