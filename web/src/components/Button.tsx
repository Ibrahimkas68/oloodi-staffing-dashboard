import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text' | 'invite';

const VARIANT: Record<ButtonVariant, { idle: string; busy: string }> = {
  primary: {
    idle: 'h-14 w-full rounded-card bg-live text-shell text-[17px] font-semibold hover:bg-live-hover active:bg-live-press',
    busy: 'h-14 w-full rounded-card bg-live-busy text-shell text-[17px] font-semibold',
  },
  secondary: {
    idle: 'h-14 w-full rounded-card border-[1.5px] border-ink bg-card text-ink text-[17px] font-semibold hover:bg-line-soft active:bg-[#e2e3de]',
    busy: 'h-14 w-full rounded-card border-[1.5px] border-[#6b6d70] bg-card text-[#45474a] text-[17px] font-semibold',
  },
  danger: {
    idle: 'h-14 w-full rounded-card bg-danger text-white text-[17px] font-semibold hover:bg-danger-hover active:bg-danger-press',
    busy: 'h-14 w-full rounded-card bg-danger text-white text-[17px] font-semibold opacity-70',
  },
  text: {
    idle: 'h-12 w-full rounded-card bg-transparent text-danger-press text-base font-medium hover:bg-p-declined active:bg-[#f0cfc9]',
    busy: 'h-12 w-full rounded-card bg-transparent text-danger-press text-base font-medium',
  },
  invite: {
    idle: 'h-[34px] rounded-sm bg-live px-3.5 text-shell text-sm font-semibold hover:bg-live-hover active:bg-live-press',
    busy: 'h-[34px] rounded-sm bg-live-busy px-3.5 text-shell text-sm font-semibold',
  },
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant: ButtonVariant;
  /** Shows a spinner, swaps the label to the busy one and blocks repeat taps. */
  loading?: boolean;
  busyLabel?: string;
  children: ReactNode;
};

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-block shrink-0 rounded-pill border-2 border-current border-t-transparent motion-safe:animate-spin-fast"
    />
  );
}

export function Button({
  variant,
  loading = false,
  busyLabel,
  disabled,
  onClick,
  className = '',
  children,
  ...rest
}: Props) {
  const styles = VARIANT[variant];
  const look = loading
    ? styles.busy
    : disabled
      ? `${styles.idle} pointer-events-none !bg-surface-sunk !text-[#7a7c7e] !border-transparent`
      : styles.idle;
  return (
    <button
      type="button"
      disabled={disabled}
      // While loading the button stays focusable (aria-disabled, not disabled), so a keyboard user
      // who just pressed it does not lose focus if the request fails. Clicks are ignored.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (!loading) onClick?.(event);
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-2.5 transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:cursor-default aria-disabled:cursor-default aria-disabled:active:scale-100 ${look} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {loading && busyLabel ? busyLabel : children}
    </button>
  );
}
