import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  iconClassName?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center space-y-3 text-center text-zinc-400 dark:text-zinc-500",
        className,
      )}
    >
      <Icon size={52} className={cn("opacity-20", iconClassName)} />
      <div>
        <p className="text-lg">{title}</p>
        {description ? <p className="mt-1 text-sm">{description}</p> : null}
      </div>
    </div>
  );
}
