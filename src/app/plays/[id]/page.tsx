import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  RankingTable,
  IndividualRankingTable,
  MatchList,
} from "@/components/play-views";
import { computeRanking, computeIndividualRanking, mergeIndividualRoster } from "@/lib/ranking";
import { FORMAT_LABELS, STATUS_LABELS, MIXED_PAIRING_LABELS } from "@/lib/labels";
import { Badge, LinkButton, Stat } from "@/components/ui";
import { PublicTabs } from "@/components/manage-tabs";
import { auth } from "@/lib/auth";

export default async function PublicPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();

  const play = await prisma.play.findUnique({
    where: { id },
    include: {
      entries: { include: { player: true } },
      pairs: {
        include: { playerA: true, playerB: true },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: {
          pairHome: { include: { playerA: true, playerB: true } },
          pairAway: { include: { playerA: true, playerB: true } },
        },
        orderBy: [{ round: "asc" }, { orderIndex: "asc" }],
      },
    },
  });
  if (!play) notFound();

  const isRandom = play.format === "RANDOM";
  const pairRanking = computeRanking(play.pairs, play.matches);
  const individualRoster = mergeIndividualRoster(
    play.entries.map((e) => e.player),
    play.pairs.flatMap((p) => [p.playerA, p.playerB]),
  );
  const individualRanking = computeIndividualRanking(
    individualRoster,
    play.pairs,
    play.matches,
  );
  const rankingRows = isRandom ? individualRanking : pairRanking;
  const done = play.matches.filter((m) => m.status === "completed").length;

  return (
    <div className="space-y-8">
      <div className="animate-rise space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge
                tone={
                  play.status === "in_progress"
                    ? "live"
                    : play.status === "finished"
                      ? "done"
                      : "neutral"
                }
              >
                {play.status === "in_progress" ? (
                  <span className="status-dot" />
                ) : null}
                {STATUS_LABELS[play.status]}
              </Badge>
            </div>
            <h1 className="font-display text-4xl font-bold sm:text-5xl">{play.name}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {FORMAT_LABELS[play.format]}
              {isRandom ? ` · ${MIXED_PAIRING_LABELS[play.mixedPairing]}` : ""}
            </p>
          </div>
          {session ? (
            <LinkButton href={`/admin/plays/${play.id}`} variant="secondary">
              Gerenciar
            </LinkButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label={isRandom ? "Jogadores" : "Duplas"}
            value={isRandom ? play.entries.length : play.pairs.length}
          />
          <Stat label="Jogos" value={play.matches.length} />
          <Stat label="OK" value={`${done}/${play.matches.length || 0}`} />
        </div>
      </div>

      <PublicTabs
        initialTab={tab}
        counts={{ ranking: rankingRows.length, jogos: play.matches.length }}
        ranking={
          isRandom ? (
            <IndividualRankingTable rows={individualRanking} playId={play.id} />
          ) : (
            <RankingTable rows={pairRanking} />
          )
        }
        jogos={<MatchList matches={play.matches} />}
      />
    </div>
  );
}
