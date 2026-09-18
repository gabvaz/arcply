import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LinkButton, Badge } from "@/components/ui";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/labels";
import { DeletePlayButton } from "@/components/delete-play-button";
import Link from "next/link";

export default async function PlaysListPage() {
  await requireAdmin();
  const plays = await prisma.play.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true, pairs: true, matches: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold">Plays</h1>
        <LinkButton href="/admin/plays/new" variant="accent">
          Novo play
        </LinkButton>
      </div>

      {plays.length === 0 ? (
        <div className="surface rounded-3xl px-6 py-12 text-center text-ink-muted">
          Nenhum play.
        </div>
      ) : (
        <ul className="animate-rise-delay-1 space-y-3">
          {plays.map((p) => (
            <li
              key={p.id}
              className="surface flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 sm:p-5"
            >
              <Link href={`/admin/plays/${p.id}`} className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap gap-2">
                  <Badge
                    tone={
                      p.status === "in_progress"
                        ? "live"
                        : p.status === "finished"
                          ? "done"
                          : "neutral"
                    }
                  >
                    {STATUS_LABELS[p.status]}
                  </Badge>
                  <Badge>{FORMAT_LABELS[p.format]}</Badge>
                </div>
                <p className="font-display text-xl font-bold">{p.name}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {p._count.entries} jogadores · {p._count.pairs} duplas ·{" "}
                  {p._count.matches} jogos
                </p>
              </Link>
              <div className="flex gap-2">
                <LinkButton href={`/admin/plays/${p.id}`} variant="secondary">
                  Abrir
                </LinkButton>
                <DeletePlayButton playId={p.id} playName={p.name} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
