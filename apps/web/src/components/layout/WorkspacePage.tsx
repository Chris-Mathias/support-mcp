import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type WorkspacePageProps = {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarWidthClass?: string;
  className?: string;
  sidebarClassName?: string;
  mainClassName?: string;
};

export function WorkspacePage({
  sidebar,
  children,
  sidebarWidthClass = "w-96",
  className,
  sidebarClassName,
  mainClassName,
}: WorkspacePageProps) {
  return (
    <div
      className={cn(
        "flex h-full bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className,
      )}
    >
      <aside
        className={cn(
          "z-10 flex flex-none flex-col border-r border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
          sidebarWidthClass,
          sidebarClassName,
        )}
      >
        {sidebar}
      </aside>

      <main className={cn("flex h-full min-w-0 flex-1 flex-col", mainClassName)}>
        {children}
      </main>
    </div>
  );
}
