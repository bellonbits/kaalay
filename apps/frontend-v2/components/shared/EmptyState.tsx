import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/** Code-generated empty/error-state pattern — no external art assets, just
 * lucide icons on Kaalay's own palette, kept consistent everywhere a list
 * or search can come back empty. */
export default function EmptyState({ icon: Icon, title, subtitle, action, className }: Props) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className ?? ""}`}>
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-primary/10">
        <Icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
        <div className="absolute -bottom-1 h-3 w-12 rounded-full bg-foreground/5 blur-[2px]" />
      </div>
      <p className="mt-4 text-sm font-extrabold text-foreground">{title}</p>
      {subtitle && <p className="mt-1 max-w-[16rem] text-xs font-medium text-muted-foreground">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 h-10 rounded-2xl bg-primary px-5 text-xs font-bold text-primary-foreground active:scale-95 transition-transform"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
