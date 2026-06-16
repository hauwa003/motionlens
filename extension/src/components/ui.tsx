import clsx from "clsx";
import {
  AlertTriangle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

/* ─── Button ─── */

const buttonVariants = {
  primary:
    "bg-accent-violet text-white hover:bg-violet-500 shadow-glow-violet/40",
  secondary:
    "bg-surface-raised text-text-primary border border-surface-border hover:bg-zinc-800",
  danger:
    "bg-accent-red-muted text-accent-red border border-accent-red-border hover:bg-red-500/25",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary",
} as const;

type ButtonVariant = keyof typeof buttonVariants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", icon: Icon, iconRight: IconRight, loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-violet/60 focus-visible:outline-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight size={16} />}
    </button>
  ),
);
Button.displayName = "Button";

/* ─── IconButton ─── */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: number;
}

export function IconButton({ icon: Icon, label, size = 16, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors",
        "hover:bg-surface-raised hover:text-text-primary",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-violet/60 focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      <Icon size={size} />
    </button>
  );
}

/* ─── Pill ─── */

const pillVariants = {
  default: "border-surface-border bg-surface-raised text-text-secondary",
  violet: "border-accent-violet-border bg-accent-violet-muted text-violet-300",
  emerald: "border-accent-emerald-border bg-accent-emerald-muted text-emerald-300",
  red: "border-accent-red-border bg-accent-red-muted text-red-300",
  amber: "border-accent-amber-border bg-accent-amber-muted text-amber-300",
} as const;

type PillVariant = keyof typeof pillVariants;

interface PillProps {
  variant?: PillVariant;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}

export function Pill({ variant = "default", icon: Icon, children, className }: PillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs-meta font-medium",
        pillVariants[variant],
        className,
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

/* ─── Card ─── */

interface CardProps {
  children: ReactNode;
  interactive?: boolean;
  variant?: "default" | "error";
  className?: string;
}

export function Card({ children, interactive, variant = "default", className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border p-3",
        variant === "error"
          ? "border-accent-red-border bg-accent-red-muted"
          : "border-surface-border bg-surface-raised",
        interactive && "transition-all hover:border-accent-violet-border hover:shadow-glow-violet/10 cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─── SectionHeader ─── */

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, icon: Icon, action, className }: SectionHeaderProps) {
  return (
    <div className={clsx("flex items-center justify-between", className)}>
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
        {Icon && <Icon size={14} className="text-text-tertiary" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

/* ─── EmptyState ─── */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-raised">
        <Icon size={24} className="text-text-tertiary" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {description && (
          <p className="mt-1 max-w-xs text-xs text-text-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ─── Input ─── */

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ icon: Icon, label, className, id, ...props }, ref) => (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs-meta font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "h-9 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-xs text-text-primary",
            "placeholder:text-text-disabled outline-none transition-colors",
            "focus:border-accent-violet-border",
            Icon && "pl-8",
            className,
          )}
          {...props}
        />
      </div>
    </div>
  ),
);
Input.displayName = "Input";

/* ─── LoadingSpinner ─── */

export function LoadingSpinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={clsx("animate-spin text-accent-violet", className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── ProgressBar ─── */

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "violet" | "emerald" | "red" | "amber";
  className?: string;
}

const progressColors = {
  violet: "bg-accent-violet",
  emerald: "bg-accent-emerald",
  red: "bg-accent-red",
  amber: "bg-accent-amber",
};

export function ProgressBar({ value, max = 100, color = "violet", className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface-raised", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={clsx("h-full rounded-full transition-all duration-300", progressColors[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Kbd ─── */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded bg-surface-raised border border-surface-border px-1.5 py-0.5 font-mono text-xs-meta text-text-secondary">
      {children}
    </kbd>
  );
}

/* ─── ErrorCard ─── */

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorCard({ message, onRetry, onDismiss }: ErrorCardProps) {
  return (
    <Card variant="error" className="animate-slide-up">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent-red" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-red-200">{message}</p>
          {(onRetry || onDismiss) && (
            <div className="mt-2 flex gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs-meta font-medium text-red-300 hover:text-red-200 transition-colors"
                >
                  Retry
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-xs-meta font-medium text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ─── Skeleton ─── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-lg bg-surface-raised",
        className,
      )}
    />
  );
}
