import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LinkButton, Badge, Stat } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/labels";
import Link from "next/link";

export default async function AdminPage() {
  await requireAdmin();
  const [playerCount, plays, liveCount] = await Promise.all([
    prisma.player.count(),
    prisma.play.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { entries: true, pairs: true, matches: true } } },
    }),
    prisma.play.count({ where: { status: "in_progress" } }),
  ]);

  return (
    <div className="space-y-10">
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Admin</h1>
          <p className="mt-1 text-sm text-ink-muted">Painel do Arcoplay</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/admin/players" variant="secondary">
            Jogadores
          </LinkButton>
          <LinkButton href="/admin/plays/new" variant="accent">
            Novo play
          </LinkButton>
        </div>
      </div>

      <div className="animate-rise-delay-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Jogadores" value={playerCount} />
        <Stat label="Plays" value={plays.length} />
        <Stat label="Ao vivo" value={liveCount} />
      </div>

      <section className="animate-rise-delay-2 space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold">Plays</h2>
          <Link href="/admin/plays" className="text-sm font-semibold text-mint-deep hover:underline">
            Ver todos →
          </Link>
        </div>
        {plays.length === 0 ? (
          <div className="surface rounded-3xl px-6 py-12 text-center text-ink-muted">
            Nenhum play. Crie o primeiro.
          </div>
        ) : (
          <ul className="space-y-2">
            {plays.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/plays/${p.id}`}
                  className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-mint/35"
                >
                  <div>
                    <div className="mb-1 flex gap-2">
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
                    </div>
                    <p className="font-display text-lg font-bold">{p.name}</p>
                    <p className="text-xs text-ink-muted">
                      {p._count.entries} jogadores · {p._count.pairs} duplas ·{" "}
                      {p._count.matches} jogos
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-mint-deep">Gerenciar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
