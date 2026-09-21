import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { mergeIndividualRoster } from "@/lib/ranking";
import { computePlayerPlayProfile } from "@/lib/player-profile";
import { PlayerProfileView } from "@/components/player-profile-view";

export default async function PlayerPlayProfilePage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = await params;

  const include = {
    entries: { include: { player: true } },
    pairs: {
      include: { playerA: true, playerB: true },
    },
    matches: {
      include: {
        pairHome: true,
        pairAway: true,
      },
    },
  };

  let play = await prisma.play.findUnique({ where: { slug }, include });
  if (!play) {
    const byId = await prisma.play.findUnique({ where: { id: slug }, include });
    if (byId) redirect(`/plays/${byId.slug}/players/${playerId}`);
    notFound();
  }

  const roster = mergeIndividualRoster(
    play.entries.map((e) => e.player),
    play.pairs.flatMap((p) => [p.playerA, p.playerB]),
  );

  const profile = computePlayerPlayProfile(
    playerId,
    roster,
    play.pairs,
    play.matches,
  );
  if (!profile) notFound();

  return (
    <PlayerProfileView
      playId={play.slug}
      playName={play.name}
      profile={profile}
    />
  );
}
