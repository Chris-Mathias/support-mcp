import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../../types/chat";
import { cn } from "../../lib/cn";
import { chatMarkdownComponents } from "./chat-markdown";

type ChatMessageBubbleProps = {
  message: ChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex max-w-[85%] gap-3 md:max-w-[75%]",
          isUser ? "flex-row-reverse" : "flex-row",
        )}
      >
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
            isUser
              ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
          )}
        >
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-col gap-1",
            isUser ? "items-end" : "items-start",
          )}
        >
          <span className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
            {isUser ? "Você" : "Assistente"}
          </span>

          <div
            className={cn(
              "overflow-hidden rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm",
              isUser
                ? "rounded-tr-none bg-zinc-800 text-white dark:bg-zinc-700"
                : "rounded-tl-none border border-zinc-100 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
            )}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            ) : (
              <div className="flex flex-col gap-3 break-words">
                <ReactMarkdown components={chatMarkdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
