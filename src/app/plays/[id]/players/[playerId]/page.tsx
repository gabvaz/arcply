import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { mergeIndividualRoster } from "@/lib/ranking";
import { computePlayerPlayProfile } from "@/lib/player-profile";
import { PlayerProfileView } from "@/components/player-profile-view";

export default async function PlayerPlayProfilePage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id: playId, playerId } = await params;

  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
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
    },
  });
  if (!play) notFound();

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
      playId={play.id}
      playName={play.name}
      profile={profile}
    />
  );
}
