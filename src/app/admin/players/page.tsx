import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Button, Input, Label, LinkButton, Section } from "@/components/ui";
import { createPlayer } from "@/lib/actions/players";
import { PlayerRow } from "@/components/player-row";

export default async function PlayersPage() {
  await requireAdmin();
  const players = await prisma.player.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-10">
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Jogadores</h1>
          <p className="mt-1 text-sm text-ink-muted">Cadastro admin</p>
        </div>
        <LinkButton href="/admin" variant="ghost">
          ← Admin
        </LinkButton>
      </div>

      <Section title="Novo jogador" className="animate-rise-delay-1">
        <form
          action={async (fd) => {
            "use server";
            await createPlayer(fd);
          }}
          className="surface grid gap-3 rounded-3xl p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="Nome" />
          </div>
          <div>
            <Label htmlFor="contact">Contato (opcional)</Label>
            <Input id="contact" name="contact" placeholder="WhatsApp / email" />
          </div>
          <Button type="submit" variant="accent">
            Cadastrar
          </Button>
        </form>
      </Section>

      <Section
        title="Lista"
        description={`${players.length} jogadores`}
        className="animate-rise-delay-2"
      >
        {players.length === 0 ? (
          <div className="surface rounded-3xl px-6 py-12 text-center text-ink-muted">
            Nenhum jogador ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {players.map((p) => (
              <PlayerRow key={p.id} id={p.id} name={p.name} contact={p.contact} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
