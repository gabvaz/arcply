"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Spinner } from "@/components/pending-button";
import {
  generateMatches,
  generateNextRandomRound,
} from "@/lib/actions/plays";

export function GenerateRoundButton({
  playId,
  mode,
  disabled,
  label,
  pendingLabel,
}: {
  playId: string;
  mode: "first" | "next";
  disabled?: boolean;
  label: string;
  pendingLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="accent"
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res =
              mode === "first"
                ? await generateMatches(playId)
                : await generateNextRandomRound(playId);
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
