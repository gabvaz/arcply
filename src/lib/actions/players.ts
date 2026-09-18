"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const playerSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório"),
  contact: z.string().trim().optional(),
});

export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const parsed = playerSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.player.create({
    data: {
      name: parsed.data.name,
      contact: parsed.data.contact || null,
    },
  });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function updatePlayer(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = playerSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.player.update({
    where: { id },
    data: {
      name: parsed.data.name,
      contact: parsed.data.contact || null,
    },
  });
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function deletePlayer(id: string) {
  await requireAdmin();

  try {
    await prisma.$transaction(async (tx) => {
      const pairs = await tx.pair.findMany({
        where: { OR: [{ playerAId: id }, { playerBId: id }] },
        select: { id: true },
      });
      const pairIds = pairs.map((p) => p.id);

      if (pairIds.length) {
        await tx.match.deleteMany({
          where: {
            OR: [
              { pairHomeId: { in: pairIds } },
              { pairAwayId: { in: pairIds } },
            ],
          },
        });
        await tx.pair.deleteMany({ where: { id: { in: pairIds } } });
      }

      // PlayEntry cascata via schema; delete explícito por segurança
      await tx.playEntry.deleteMany({ where: { playerId: id } });
      await tx.player.delete({ where: { id } });
    });
  } catch (e) {
    console.error(e);
    return { error: "Não foi possível excluir o jogador" };
  }

  revalidatePath("/admin/players");
  revalidatePath("/admin");
  revalidatePath("/admin/plays");
  return { ok: true };
}
