import Link from "next/link";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants = {
  primary:
    "bg-night text-white hover:bg-ink",
  accent:
    "bg-mint text-white hover:bg-mint-deep",
  secondary:
    "bg-white text-ink border border-line hover:bg-[#fafafa]",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-black/[0.04]",
  danger:
    "bg-coral text-white hover:bg-coral-deep",
} as const;

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button className={`${btnBase} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  className = "",
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof variants;
}) {
  return (
    <Link href={href} className={`${btnBase} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/50 focus:border-mint focus:ring-4 focus:ring-mint/15 ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted"
    >
      {children}
    </label>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-5 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink sm:text-3xl">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-xl text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "done" | "warn";
}) {
  const tones = {
    neutral: "bg-white/70 text-ink-muted border-line",
    live: "bg-mint-soft text-mint-deep border-mint/30",
    done: "bg-night/5 text-ink border-line",
    warn: "bg-coral/10 text-coral-deep border-coral/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="surface rounded-2xl px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink">{value}</p>
    </div>
  );
}
