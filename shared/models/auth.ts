import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for OIDC authentication, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for OIDC authentication, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  role: varchar("role").notNull().default("tenant"), // "manager" | "tenant" | "investor"
  authProvider: varchar("auth_provider").notNull().default("oidc"), // "oidc" | "local"
  passwordHash: varchar("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at"),
  resetTokenHash: varchar("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockoutUntil: timestamp("lockout_until"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: varchar("mfa_secret"),
  mfaBackupCodes: jsonb("mfa_backup_codes").$type<string[]>().notNull().default([]),
  lastLoginAt: timestamp("last_login_at"),
  securityVersion: integer("security_version").notNull().default(1),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
