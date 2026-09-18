import { LinkButton, Badge } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/labels";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  const plays = await prisma.play.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { pairs: true, matches: true } } },
  });

  return (
    <div className="space-y-14">
      <section className="animate-rise rounded-3xl border border-line bg-night px-6 py-12 text-white sm:px-10 sm:py-14">
        <div className="max-w-lg space-y-5">
          <p className="font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
            Arco
            <span className="text-mint">play</span>
          </p>
          <p className="text-base text-white/65 sm:text-lg">
            Plays de beach tennis com ranking por duplas, jogos equilibrados e
            placar na hora.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            {session ? (
              <>
                <LinkButton href="/admin/plays/new" variant="accent">
                  Novo play
                </LinkButton>
                <LinkButton
                  href="/admin/plays"
                  variant="secondary"
                  className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/15"
                >
                  Ver plays
                </LinkButton>
              </>
            ) : (
              <LinkButton href="/login" variant="accent">
                Entrar como admin
              </LinkButton>
            )}
          </div>
        </div>
      </section>

      <section className="animate-rise-delay-1 space-y-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold">Plays recentes</h2>
          {session ? (
            <Link
              href="/admin/plays"
              className="text-sm font-semibold text-mint-deep hover:underline"
            >
              Todos →
            </Link>
          ) : null}
        </div>
        {plays.length === 0 ? (
          <div className="surface rounded-3xl px-6 py-12 text-center text-ink-muted">
            Nenhum play ainda.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {plays.map((p, i) => (
              <li key={p.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <Link
                  href={`/plays/${p.id}`}
                  className="surface group flex h-full flex-col justify-between rounded-3xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-mint/40 hover:shadow-lg hover:shadow-mint/10"
                >
                  <div>
                    <Badge
                      tone={
                        p.status === "in_progress"
                          ? "live"
                          : p.status === "finished"
                            ? "done"
                            : "neutral"
                      }
                    >
                      {p.status === "in_progress" ? (
                        <span className="status-dot" />
                      ) : null}
                      {STATUS_LABELS[p.status]}
                    </Badge>
                    <p className="mt-3 font-display text-xl font-bold leading-tight group-hover:text-mint-deep">
                      {p.name}
                    </p>
                  </div>
                  <p className="mt-4 text-xs font-medium text-ink-muted">
                    {p._count.pairs} duplas · {p._count.matches} jogos
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
