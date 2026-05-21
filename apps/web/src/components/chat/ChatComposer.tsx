import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { Send } from "lucide-react";

type ChatComposerProps = {
  value: string;
  canSendMessage: boolean;
  disabled: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
};

export function ChatComposer({
  value,
  canSendMessage,
  disabled,
  textareaRef,
  loading,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="flex-none border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <form
        onSubmit={onSubmit}
        className="relative mx-auto flex max-w-4xl items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={1}
          className="max-h-32 min-h-[52px] w-full resize-none overflow-y-hidden rounded-2xl border border-zinc-200 bg-zinc-50 py-3.5 pl-4 pr-14 text-zinc-800 shadow-inner outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          placeholder="Digite a dúvida do suporte..."
          disabled={disabled}
          onKeyDown={handleKeyDown}
        />

        <button
          type="submit"
          aria-label="Enviar mensagem"
          disabled={!canSendMessage}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send size={18} className="ml-1" />
          )}
        </button>
      </form>
    </div>
  );
}
