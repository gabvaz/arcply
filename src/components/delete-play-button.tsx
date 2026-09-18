"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { deletePlay } from "@/lib/actions/plays";

export function DeletePlayButton({
  playId,
  playName,
  compact = false,
}: {
  playId: string;
  playName: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      className={compact ? "!px-3" : undefined}
      aria-busy={pending}
      onClick={() => {
        if (
          !confirm(
            `Excluir o play "${playName}"?\nIsso remove jogadores vinculados, duplas, jogos e placares.`,
          )
        ) {
          return;
        }
        start(async () => {
          await deletePlay(playId);
        });
      }}
    >
      {pending ? (
        <>
          <Spinner />
          …
        </>
      ) : compact ? (
        "Excluir"
      ) : (
        "Excluir play"
      )}
    </Button>
  );
}
