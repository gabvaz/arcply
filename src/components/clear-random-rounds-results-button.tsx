"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { clearRandomRoundsResults } from "@/lib/actions/plays";

export function ClearRandomRoundsResultsButton({ playId }: { playId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (
            !confirm(
              "Limpar todos os resultados?\nOs jogos e duplas permanecem — só zera placares e volta tudo para pendente.",
            )
          ) {
            return;
          }
          setError(null);
          start(async () => {
            const res = await clearRandomRoundsResults(playId);
            if (res?.error) setError(res.error);
            else router.refresh();
          });
        }}
      >
        {pending ? (
          <>
            <Spinner />
            Limpando…
          </>
        ) : (
          "Limpar resultados"
        )}
      </Button>
      {error ? (
        <p className="max-w-xs text-xs font-medium text-coral">{error}</p>
      ) : null}
    </div>
  );
}
