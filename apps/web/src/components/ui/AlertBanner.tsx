import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/cn";

type AlertBannerProps = {
  children: ReactNode;
  className?: string;
};

export function AlertBanner({ children, className }: AlertBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-950/40",
        className,
      )}
    >
      <AlertCircle
        className="mt-0.5 flex-none text-red-500 dark:text-red-400"
        size={20}
      />
      <div className="text-sm text-red-700 dark:text-red-300">{children}</div>
    </div>
  );
}
