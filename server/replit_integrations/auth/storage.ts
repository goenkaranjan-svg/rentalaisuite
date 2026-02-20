import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getTenants(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "tenant"));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if it's the first user - make them a manager
    const allUsers = await db.select().from(users).limit(1);
    
    // Default to tenant, but first user is manager. 
    // If userData.role is provided (e.g. from seed), use it.
    let role = userData.role || "tenant";
    if (allUsers.length === 0) {
      role = "manager";
    }

    const [user] = await db
      .insert(users)
      .values({ ...userData, role })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          role, // Ensure role is updated/set
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
