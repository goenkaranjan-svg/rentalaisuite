import { db } from "../../db";
import { conversations, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const OWNER_PREFIX = "owner:";

function withOwnerPrefix(userId: string, title: string): string {
  return `${OWNER_PREFIX}${userId}:${title}`;
}

function extractOwnerAndTitle(rawTitle: string): { ownerId: string | null; title: string } {
  if (!rawTitle.startsWith(OWNER_PREFIX)) {
    return { ownerId: null, title: rawTitle };
  }
  const rest = rawTitle.slice(OWNER_PREFIX.length);
  const idx = rest.indexOf(":");
  if (idx <= 0) return { ownerId: null, title: rawTitle };
  return {
    ownerId: rest.slice(0, idx),
    title: rest.slice(idx + 1) || "New Chat",
  };
}

export interface IChatStorage {
  getConversation(id: number, userId: string): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(userId: string): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(userId: string, title: string): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: number, userId: string): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number, userId: string) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conversation) return undefined;
    const owner = extractOwnerAndTitle(conversation.title);
    if (owner.ownerId !== userId) return undefined;
    return {
      ...conversation,
      title: owner.title,
    };
  },

  async getAllConversations(userId: string) {
    const all = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
    return all
      .map((conversation) => {
        const owner = extractOwnerAndTitle(conversation.title);
        if (owner.ownerId !== userId) return null;
        return {
          ...conversation,
          title: owner.title,
        };
      })
      .filter((conversation): conversation is typeof conversations.$inferSelect => Boolean(conversation));
  },

  async createConversation(userId: string, title: string) {
    const safeTitle = (title || "New Chat").trim() || "New Chat";
    const [conversation] = await db
      .insert(conversations)
      .values({ title: withOwnerPrefix(userId, safeTitle) })
      .returning();
    return {
      ...conversation,
      title: safeTitle,
    };
  },

  async deleteConversation(id: number, userId: string) {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return;
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  },
};
