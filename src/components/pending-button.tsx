"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function PendingButton({
  children,
  pendingLabel,
  className = "",
  variant = "primary",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  pendingLabel?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const busy = pending || disabled;

  return (
    <Button
      {...props}
      type="submit"
      variant={variant}
      disabled={busy}
      className={className}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function PendingIconButton({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-busy={pending}
      className={`disabled:pointer-events-none disabled:opacity-45 ${className}`}
    >
      {pending ? <Spinner className="size-3.5" /> : children}
    </button>
  );
}
