import type { MyUIMessage } from "@/types/ui-message";

export type StoredThread = {
  id: string;
  resourceId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface ChatStore {
  getThreadMessages(threadId: string): Promise<MyUIMessage[]>;
  saveMessage(threadId: string, message: MyUIMessage): Promise<void>;
  createThread(id: string, resourceId: string, title?: string): Promise<StoredThread>;
  getThreadById(threadId: string): Promise<StoredThread | null>;
  updateThreadTitle(threadId: string, title: string): Promise<void>;
  listThreads(userId: string): Promise<StoredThread[]>;
  deleteThread(threadId: string): Promise<void>;
  replaceAssistantMessageAfter(
    threadId: string,
    messageId: string,
    nextAssistantMessage: MyUIMessage,
  ): Promise<void>;
  cloneThread(
    sourceThreadId: string,
    resourceId: string,
    upToMessageId?: string,
  ): Promise<StoredThread>;
}
