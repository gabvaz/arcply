import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RankingTable, MatchList } from "@/components/play-views";
import { computeRanking } from "@/lib/ranking";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/labels";
import { Badge, LinkButton, Stat } from "@/components/ui";
import { PublicTabs } from "@/components/manage-tabs";
import { auth } from "@/lib/auth";

export default async function PublicPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const play = await prisma.play.findUnique({
    where: { id },
    include: {
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

  const ranking = computeRanking(play.pairs, play.matches);
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
            <p className="mt-2 text-sm text-ink-muted">{FORMAT_LABELS[play.format]}</p>
          </div>
          {session ? (
            <LinkButton href={`/admin/plays/${play.id}`} variant="secondary">
              Gerenciar
            </LinkButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Duplas" value={play.pairs.length} />
          <Stat label="Jogos" value={play.matches.length} />
          <Stat label="OK" value={`${done}/${play.matches.length || 0}`} />
        </div>
      </div>

      <Suspense fallback={<div className="surface h-12 animate-pulse rounded-2xl" />}>
        <PublicTabs
          counts={{ ranking: ranking.length, jogos: play.matches.length }}
          ranking={<RankingTable rows={ranking} />}
          jogos={<MatchList matches={play.matches} />}
        />
      </Suspense>
    </div>
  );
}
