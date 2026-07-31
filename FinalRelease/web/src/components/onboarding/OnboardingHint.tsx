import { Info, X } from "lucide-react";
import type { ReactNode } from "react";

type OnboardingHintProps = {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
};

export function OnboardingHint({ title, children, onDismiss, className = "" }: OnboardingHintProps) {
  return (
    <aside
      className={`rounded-lg bg-white/88 p-3 text-left text-[var(--text-main)] shadow-[0_12px_34px_rgba(23,38,32,0.12)] ring-1 ring-white/70 backdrop-blur-xl ${className}`}
      aria-label={title}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
          <Info className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-[var(--pine)]">{title}</p>
          <div className="mt-1 text-xs font-semibold leading-5 text-[var(--text-muted)]">{children}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-faint)] transition active:scale-95"
          aria-label="关闭提示"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
