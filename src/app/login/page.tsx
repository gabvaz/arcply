import { auth, signIn } from "@/lib/auth";
import { Input, Label } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/admin");
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-sm animate-rise space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold">Entrar</h1>
        <p className="mt-1 text-sm text-ink-muted">Acesso admin do Arcoplay</p>
      </div>

      <form
        className="surface space-y-4 rounded-3xl p-6"
        action={async (formData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              redirectTo: "/admin",
            });
          } catch (e) {
            if (e instanceof AuthError) {
              redirect("/login?error=Credenciais inválidas");
            }
            throw e;
          }
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        {params.error ? (
          <p className="text-sm font-medium text-coral">{params.error}</p>
        ) : null}
        <PendingButton type="submit" variant="accent" className="w-full" pendingLabel="Entrando…">
          Entrar
        </PendingButton>
      </form>
    </div>
  );
}
