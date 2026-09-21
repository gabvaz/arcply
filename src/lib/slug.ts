import { prisma } from "@/lib/db";

/** "Torneio Sábado!" → "torneio-sabado" */
export function slugify(text: string): string {
  const base = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "play";
}

/** Gera slug único a partir do nome (sufixo -2, -3… se colidir). */
export async function uniquePlaySlug(name: string): Promise<string> {
  const root = slugify(name);
  let candidate = root;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.play.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
}
