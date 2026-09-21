"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Input, Label, Select, LinkButton } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { createPlay } from "@/lib/actions/plays";
import {
  estimateRandomRoundsCapacity,
  probeStrictRandomRounds,
} from "@/lib/schedule";
import { VARIETY_POLICY_LABELS } from "@/lib/labels";

export default function NewPlayPage() {
  const [format, setFormat] = useState("ROUND_ROBIN");
  const [rounds, setRounds] = useState(4);
  const [plannedCount, setPlannedCount] = useState(8);
  const [varietyPolicy, setVarietyPolicy] = useState("PREFER_NEW");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isRandom = format === "RANDOM";
  const isRandomRounds = format === "RANDOM_ROUNDS";
  const isIndividual = isRandom || isRandomRounds;

  const capacity = useMemo(() => {
    if (!isRandomRounds) return null;
    return estimateRandomRoundsCapacity(plannedCount, rounds);
  }, [isRandomRounds, plannedCount, rounds]);

  const strictProbe = useMemo(() => {
    if (!isRandomRounds || varietyPolicy !== "STRICT") return null;
    return probeStrictRandomRounds(plannedCount, rounds, {
      attempts: 8,
      trials: 350,
    });
  }, [isRandomRounds, varietyPolicy, plannedCount, rounds]);

  const strictBlocked = strictProbe != null && !strictProbe.ok;

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
          if (strictBlocked && strictProbe && !strictProbe.ok) {
            setError(strictProbe.error);
            return;
          }
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
            <option value="RANDOM">Aleatório (1 jogo por vez)</option>
            <option value="RANDOM_ROUNDS">Aleatório × N rodadas</option>
          </Select>
        </div>

        {format === "ROUND_ROBIN_MULTI" || isRandomRounds ? (
          <div>
            <Label htmlFor="rounds">Rodadas</Label>
            <Input
              id="rounds"
              name="rounds"
              type="number"
              min={1}
              max={isRandomRounds ? 40 : 20}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value) || 1)}
              disabled={pending}
            />
          </div>
        ) : null}

        {isRandomRounds ? (
          <div>
            <Label htmlFor="plannedPlayerCount">Qtd. de participantes</Label>
            <Input
              id="plannedPlayerCount"
              name="plannedPlayerCount"
              type="number"
              min={4}
              max={64}
              value={plannedCount}
              onChange={(e) => setPlannedCount(Number(e.target.value) || 4)}
              disabled={pending}
              required
            />
            <p className="mt-1 text-xs text-ink-muted">
              Elenco real é adicionado depois; a geração exige essa quantidade.
            </p>
          </div>
        ) : null}

        {!isIndividual ? (
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
              {isRandomRounds
                ? "Todas as rodadas/duplas são geradas de uma vez. Ranking individual."
                : "Duplas sorteadas um jogo por vez. Ranking individual."}
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
            {isRandomRounds ? (
              <div>
                <Label htmlFor="varietyPolicy">Variedade</Label>
                <Select
                  id="varietyPolicy"
                  name="varietyPolicy"
                  value={varietyPolicy}
                  onChange={(e) => setVarietyPolicy(e.target.value)}
                  disabled={pending}
                >
                  <option value="PREFER_NEW">
                    {VARIETY_POLICY_LABELS.PREFER_NEW}
                  </option>
                  <option value="STRICT">{VARIETY_POLICY_LABELS.STRICT}</option>
                </Select>
              </div>
            ) : null}
          </div>
        )}

        {capacity ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              strictBlocked
                ? "border-coral/40 bg-coral/5"
                : capacity.warnings.length
                  ? "border-amber-200/80 bg-amber-50/60"
                  : "border-line bg-black/[0.02]"
            }`}
          >
            <p className="font-display text-base font-bold">Capacidade</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">
              {capacity.totalGames}
              <span className="ml-2 text-sm font-semibold text-ink-muted">
                jogos no total
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-ink-muted">
              <li>
                {capacity.gamesPerRound} por rodada × {rounds} rodada(s)
              </li>
              <li>
                Teto teórico sem rematch:{" "}
                <span className="font-semibold text-ink">
                  {capacity.maxRoundsStrict} rodada(s)
                </span>
              </li>
              <li>
                Rematch forçado (pior caso): adversário ≥
                {capacity.minOpponentRepeats}× · parceiro ≥
                {capacity.minPartnerRepeats}×
              </li>
            </ul>
            {strictProbe && !strictProbe.ok ? (
              <p className="mt-2 text-xs font-medium text-coral">
                {strictProbe.error}
              </p>
            ) : null}
            {strictProbe?.ok ? (
              <p className="mt-2 text-xs font-medium text-ink-muted">
                Gerador STRICT: ok nestes parâmetros (sonda)
              </p>
            ) : null}
            {capacity.insights.length ? (
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                {capacity.insights.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
            {capacity.warnings.length ? (
              <ul className="mt-2 space-y-1 text-xs font-medium text-amber-900">
                {capacity.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm font-medium text-coral">{error}</p> : null}
        <Button
          type="submit"
          disabled={pending || strictBlocked}
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
