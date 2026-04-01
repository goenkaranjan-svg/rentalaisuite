import { users, type User, type UpsertUser } from "@shared/models/auth";
import {
  organizationMembers,
  organizations,
  userProfileSettings,
  type InsertOrganization,
  type Organization,
  type OrganizationMember,
  type UserProfileSettings,
} from "@shared/schema";
import { db } from "../../db";
import { and, eq, gt } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for OIDC authentication.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationMemberships(userId: string): Promise<OrganizationMember[]>;
  getDefaultOrganizationForUser(userId: string): Promise<Organization | undefined>;
  createOrganization(input: InsertOrganization): Promise<Organization>;
  addOrganizationMember(input: {
    organizationId: string;
    userId: string;
    role: string;
    status?: string;
    isDefault?: boolean;
  }): Promise<OrganizationMember>;
  ensureOrganizationForManager(user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null }): Promise<Organization>;
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
  markEmailVerified(userId: string): Promise<void>;
  updateLoginSecurityState(input: {
    userId: string;
    failedLoginCount?: number;
    lockoutUntil?: Date | null;
    lastLoginAt?: Date | null;
  }): Promise<void>;
  updateMfaConfig(input: {
    userId: string;
    enabled: boolean;
    secret?: string | null;
    backupCodes?: string[];
  }): Promise<void>;
  updateUserEmail(userId: string, email: string): Promise<User | undefined>;
  getUserProfileSettings(userId: string): Promise<UserProfileSettings | undefined>;
  upsertUserProfileSettings(input: {
    userId: string;
    phoneNumber?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    twoFactorMethod?: "email" | "phone" | null;
  }): Promise<UserProfileSettings>;
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

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, id));
    return organization;
  }

  async getOrganizationMemberships(userId: string): Promise<OrganizationMember[]> {
    return db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
  }

  async getDefaultOrganizationForUser(userId: string): Promise<Organization | undefined> {
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isDefault, true)));

    if (membership) {
      return this.getOrganization(membership.organizationId);
    }

    const [fallbackMembership] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    if (!fallbackMembership) return undefined;
    return this.getOrganization(fallbackMembership.organizationId);
  }

  async createOrganization(input: InsertOrganization): Promise<Organization> {
    const [organization] = await db.insert(organizations).values(input).returning();
    return organization;
  }

  async addOrganizationMember(input: {
    organizationId: string;
    userId: string;
    role: string;
    status?: string;
    isDefault?: boolean;
  }): Promise<OrganizationMember> {
    const [member] = await db
      .insert(organizationMembers)
      .values({
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        status: input.status ?? "active",
        isDefault: input.isDefault ?? false,
      })
      .onConflictDoUpdate({
        target: [organizationMembers.organizationId, organizationMembers.userId],
        set: {
          role: input.role,
          status: input.status ?? "active",
          isDefault: input.isDefault ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();
    return member;
  }

  async ensureOrganizationForManager(user: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<Organization> {
    const existing = await this.getDefaultOrganizationForUser(user.id);
    if (existing) return existing;

    const baseName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
      "Property Manager";
    const normalized = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${normalized || "property-manager"}-${user.id.slice(0, 8)}`;

    const organization = await this.createOrganization({
      name: `${baseName} Properties`,
      slug,
      status: "active",
      plan: "starter",
    });

    await this.addOrganizationMember({
      organizationId: organization.id,
      userId: user.id,
      role: "org_owner",
      isDefault: true,
      status: "active",
    });

    return organization;
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
        emailVerifiedAt: null,
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

  async markEmailVerified(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateLoginSecurityState(input: {
    userId: string;
    failedLoginCount?: number;
    lockoutUntil?: Date | null;
    lastLoginAt?: Date | null;
  }): Promise<void> {
    await db
      .update(users)
      .set({
        ...(input.failedLoginCount !== undefined ? { failedLoginCount: input.failedLoginCount } : {}),
        ...(input.lockoutUntil !== undefined ? { lockoutUntil: input.lockoutUntil } : {}),
        ...(input.lastLoginAt !== undefined ? { lastLoginAt: input.lastLoginAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
  }

  async updateMfaConfig(input: {
    userId: string;
    enabled: boolean;
    secret?: string | null;
    backupCodes?: string[];
  }): Promise<void> {
    await db
      .update(users)
      .set({
        mfaEnabled: input.enabled,
        mfaSecret: input.secret ?? null,
        mfaBackupCodes: input.backupCodes ?? [],
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
  }

  async updateUserEmail(userId: string, email: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserProfileSettings(userId: string): Promise<UserProfileSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userProfileSettings)
      .where(eq(userProfileSettings.userId, userId));
    return settings;
  }

  async upsertUserProfileSettings(input: {
    userId: string;
    phoneNumber?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    twoFactorMethod?: "email" | "phone" | null;
  }): Promise<UserProfileSettings> {
    const [settings] = await db
      .insert(userProfileSettings)
      .values({
        userId: input.userId,
        phoneNumber: input.phoneNumber ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zipCode: input.zipCode ?? null,
        twoFactorMethod: input.twoFactorMethod ?? null,
      })
      .onConflictDoUpdate({
        target: userProfileSettings.userId,
        set: {
          phoneNumber: input.phoneNumber ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zipCode: input.zipCode ?? null,
          twoFactorMethod: input.twoFactorMethod ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }
}

export const authStorage = new AuthStorage();
