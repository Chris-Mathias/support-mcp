-- AlterTable: recreate FK with ON DELETE CASCADE
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_sessionId_fkey";
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ChatSession"(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
