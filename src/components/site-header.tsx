import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="glass-nav sticky top-0 z-40">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
        <Link
          href="/"
          className="group font-display text-xl font-bold tracking-tight text-night transition hover:text-mint-deep"
        >
          Arco
          <span className="text-mint transition group-hover:text-night">play</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          {session ? (
            <>
              <Link
                href="/admin"
                className="rounded-lg px-2.5 py-1.5 text-ink-muted transition hover:bg-white/70 hover:text-ink"
              >
                Admin
              </Link>
              <Link
                href="/admin/players"
                className="hidden rounded-lg px-2.5 py-1.5 text-ink-muted transition hover:bg-white/70 hover:text-ink sm:inline"
              >
                Jogadores
              </Link>
              <Link
                href="/admin/plays"
                className="rounded-lg px-2.5 py-1.5 text-ink-muted transition hover:bg-white/70 hover:text-ink"
              >
                Plays
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="ghost" className="!py-1.5 !px-2.5">
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <LinkButtonLogin />
          )}
        </nav>
      </div>
    </header>
  );
}

function LinkButtonLogin() {
  return (
    <Link
      href="/login"
      className="rounded-xl bg-night px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-mint-deep"
    >
      Entrar
    </Link>
  );
}
