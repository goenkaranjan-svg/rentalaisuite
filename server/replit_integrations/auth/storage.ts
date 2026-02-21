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
    
    // Check if this specific email should be a manager
    const isManagerEmail = userData.email?.toLowerCase() === 'ranjan_goenka@yahoo.com';
    
    // Default to tenant, but first user or specific admin email is manager. 
    let role = userData.role;
    if (allUsers.length === 0 || isManagerEmail) {
      role = "manager";
      console.log(`Setting user ${userData.email} as manager (first user or matched email). Current users count: ${allUsers.length}`);
    } else if (!role) {
      role = "tenant";
    }

    console.log(`Upserting user: ${userData.email}, assigned role: ${role}`);

    const [user] = await db
      .insert(users)
      .values({ ...userData, role })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: role, // Force role update on conflict
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Explicitly verify the update in DB if it was a conflict
    if (isManagerEmail && user.role !== "manager") {
       console.log(`Force updating role to manager for ${userData.email}`);
       await db.update(users).set({ role: "manager" }).where(eq(users.id, user.id));
       user.role = "manager";
    }

    // Double check the user in DB right now
    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    console.log(`Final user state in DB:`, updatedUser);

    return updatedUser;
  }
}

export const authStorage = new AuthStorage();
