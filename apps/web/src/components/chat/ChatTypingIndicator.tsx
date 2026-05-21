import { Bot } from "lucide-react";

export function ChatTypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[85%] gap-3 md:max-w-[75%]">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
          <Bot size={18} />
        </div>

        <div className="flex flex-col items-start gap-1">
          <span className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
            Assistente
          </span>

          <div className="rounded-2xl rounded-tl-none border border-zinc-100 bg-white px-5 py-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_infinite] rounded-full bg-current" />
              <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_0.15s_infinite] rounded-full bg-current" />
              <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_0.3s_infinite] rounded-full bg-current" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
