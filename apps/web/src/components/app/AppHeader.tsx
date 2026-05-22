import type { LucideIcon } from "lucide-react";
import { LogOut, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/cn";

type AppHeaderProps<TTab extends string> = {
  navItems: ReadonlyArray<{
    id: TTab;
    label: string;
    icon: LucideIcon;
  }>;
  activeTab: TTab;
  isDark: boolean;
  onChangeTab: (tab: TTab) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export function AppHeader<TTab extends string>({
  navItems,
  activeTab,
  isDark,
  onChangeTab,
  onToggleTheme,
  onLogout,
}: AppHeaderProps<TTab>) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 shadow dark:bg-zinc-700">
          <span className="text-lg font-bold text-white">S</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Suporte - MVP
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                isActive
                  ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
              )}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <LogOut size={18} />
        </button>
      </nav>
    </header>
  );
}
