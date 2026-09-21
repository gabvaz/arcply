"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import { ShuffleDrawOverlay } from "@/components/shuffle-draw-overlay";
import {
  generateMatches,
  generateNextRandomMatch,
} from "@/lib/actions/plays";

export function GenerateRoundButton({
  playId,
  mode,
  disabled,
  label,
  pendingLabel,
  shuffle = false,
}: {
  playId: string;
  mode: "first" | "next";
  disabled?: boolean;
  label: string;
  pendingLabel: string;
  /** Overlay fullscreen de sorteio (formato RANDOM). */
  shuffle?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const showShuffle = pending && shuffle;

  return (
    <div className="space-y-1">
      <ShuffleDrawOverlay active={showShuffle} />
      <Button
        type="button"
        variant="accent"
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const started = Date.now();
            const res =
              mode === "first"
                ? await generateMatches(playId)
                : await generateNextRandomMatch(playId);
            if (shuffle) {
              const wait = Math.max(0, 1100 - (Date.now() - started));
              if (wait) await new Promise((r) => setTimeout(r, wait));
            }
            if (res?.error) setError(res.error);
            else router.refresh();
          });
        }}
      >
        {pending ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </Button>
      {error ? (
        <p className="max-w-xs text-xs font-medium text-coral">{error}</p>
      ) : null}
    </div>
  );
}
