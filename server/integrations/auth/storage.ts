import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { and, eq, gt } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for OIDC authentication.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createLocalUser(input: {
    email: string;
    passwordHash: string;
    role: "manager" | "tenant" | "investor";
    firstName?: string;
    lastName?: string;
  }): Promise<User>;
  updateUserRole(id: string, role: "manager" | "tenant" | "investor"): Promise<User | undefined>;
  linkLocalCredentials(input: {
    userId: string;
    passwordHash: string;
    role: "manager" | "tenant" | "investor";
    firstName?: string;
    lastName?: string;
  }): Promise<User | undefined>;
  setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserByResetToken(tokenHash: string): Promise<User | undefined>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getTenants(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "tenant"));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if it's the first user - make them a manager
    const allUsers = await db.select().from(users).limit(1);
    const role = allUsers.length === 0 ? "manager" : (userData.role || "tenant");

    const [user] = await db
      .insert(users)
      .values({ ...userData, role })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createLocalUser(input: {
    email: string;
    passwordHash: string;
    role: "manager" | "tenant" | "investor";
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: `local_${randomUUID()}`,
        email: input.email,
        passwordHash: input.passwordHash,
        authProvider: "local",
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: "manager" | "tenant" | "investor"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async linkLocalCredentials(input: {
    userId: string;
    passwordHash: string;
    role: "manager" | "tenant" | "investor";
    firstName?: string;
    lastName?: string;
  }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        passwordHash: input.passwordHash,
        authProvider: "local",
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning();
    return user;
  }

  async setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async findUserByResetToken(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.resetTokenHash, tokenHash), gt(users.resetTokenExpiresAt, new Date())));
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordHash,
        authProvider: "local",
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
