import type { RefObject } from "react";
import { Bot } from "lucide-react";
import type { ChatMessage } from "../../types/chat";
import { EmptyState } from "../ui/EmptyState";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatTypingIndicator } from "./ChatTypingIndicator";

type ChatMessageListProps = {
  selectedProjectId: string;
  loadingMessages: boolean;
  hasActiveSession: boolean;
  messages: ChatMessage[];
  sendingMessage: boolean;
  streamingAssistantMessageId: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({
  selectedProjectId,
  loadingMessages,
  hasActiveSession,
  messages,
  sendingMessage,
  streamingAssistantMessageId,
  messagesEndRef,
}: ChatMessageListProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      {!selectedProjectId ? (
        <EmptyState
          icon={Bot}
          title="Selecione um projeto para conversar."
          description="Depois disso, você poderá iniciar um novo chat ou abrir uma sessão anterior."
          className="space-y-4"
          iconClassName="opacity-20"
        />
      ) : loadingMessages ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
          Carregando mensagens...
        </div>
      ) : !hasActiveSession || messages.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Digite sua dúvida de suporte abaixo."
          description="Pressione Enter para enviar ou Shift + Enter para quebrar linha."
          className="space-y-2"
          iconClassName="opacity-20"
        />
      ) : (
        messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))
      )}

      {sendingMessage && !streamingAssistantMessageId ? <ChatTypingIndicator /> : null}

      <div ref={messagesEndRef} />
    </div>
  );
}
