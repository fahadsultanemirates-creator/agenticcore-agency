import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  varchar,
  boolean,
  numeric,
  pgEnum,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Enums ──────────────────────────────────────────────────────────────────────

export const nwpUserStatusEnum = pgEnum("nwp_user_status", [
  "pending_approval",   // submitted, waiting for admin to approve account creation
  "approved_inactive",  // approved but no active deposit / package yet
  "active",             // deposit confirmed & admin activated
  "inactive",           // manually deactivated by admin
  "rejected",           // application rejected
]);

export const nwpPackageEnum = pgEnum("nwp_package", [
  "silver",    // $100–$1,000  → 20%/month
  "gold",      // $1,001–$5,000 → 22%/month
  "platinum",  // $5,001–$10,000 → 24%/month
  "emerald",   // $10,001–$20,000 → 26%/month
  "vip",       // $20,001+ → 28%+/month
]);

export const nwpDepositStatusEnum = pgEnum("nwp_deposit_status", [
  "awaiting",   // customer has been shown deposit instructions
  "detected",   // blockchain tx auto-detected; waiting admin activation
  "bypass",     // company bypass code used; waiting admin activation
  "approved",   // admin approved, account active
  "rejected",   // rejected by admin
]);

export const nwpWithdrawalTypeEnum = pgEnum("nwp_withdrawal_type", [
  "profit",     // regular profit withdrawal
  "principal",  // early withdrawal of invested capital (with penalty)
]);

export const nwpWithdrawalStatusEnum = pgEnum("nwp_withdrawal_status", [
  "pending",    // submitted by customer
  "approved",   // approved by admin; for principal: 2-week countdown starts
  "processing", // principal: in the 2-week window
  "completed",  // funds sent to customer BNB wallet
  "rejected",   // rejected by admin
]);

export const nwpRewardTypeEnum = pgEnum("nwp_reward_type", [
  "upfront",  // 10% of investment, one-time for L1 referrer
  "daily",    // daily slice of monthly % reward
]);

export const nwpProfileFieldEnum = pgEnum("nwp_profile_field", [
  "mobile",
  "address",
  "email",
  "bnb_wallet",
]);

export const nwpProfileRequestStatusEnum = pgEnum("nwp_profile_request_status", [
  "pending",
  "approved",
  "rejected",
]);

// ── Tables ─────────────────────────────────────────────────────────────────────

/**
 * nwp_users – Nexus Wealth Partners platform accounts.
 * Separate from the Replit-auth app_users used by the referral dashboard.
 */
export const nwpUsersTable = pgTable("nwp_users", {
  id: serial("id").primaryKey(),

  // Personal details (collected at registration)
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mobile: varchar("mobile", { length: 30 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  address: text("address").notNull(),

  // BNB Smart Chain wallet – used for deposit tracking & withdrawals
  bnbWallet: varchar("bnb_wallet", { length: 42 }).notNull(),

  // Referral system
  referralCode: varchar("referral_code", { length: 16 }).notNull().unique(),
  referredById: integer("referred_by_id"), // FK to self; null if company link was used

  // Account state
  status: nwpUserStatusEnum("status").notNull().default("pending_approval"),
  role: varchar("role", { length: 20 }).notNull().default("customer"), // 'customer' | 'admin'

  // Investment details (set when package is selected & deposit confirmed)
  package: nwpPackageEnum("package"),
  investmentAmountUsd: numeric("investment_amount_usd", { precision: 18, scale: 2 }),
  investmentStartDate: date("investment_start_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * nwp_deposits – one record per deposit attempt.
 */
export const nwpDepositsTable = pgTable("nwp_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
  package: nwpPackageEnum("package").notNull(),

  // Blockchain verification
  txHash: varchar("tx_hash", { length: 66 }),          // null for bypass deposits
  bypassCodeUsed: boolean("bypass_code_used").notNull().default(false),

  status: nwpDepositStatusEnum("status").notNull().default("awaiting"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * nwp_withdrawals – withdrawal requests (profit and principal).
 */
export const nwpWithdrawalsTable = pgTable("nwp_withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  type: nwpWithdrawalTypeEnum("type").notNull(),
  amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),

  // For principal withdrawal: record how much profit was earned (to calculate penalty)
  totalProfitEarnedUsd: numeric("total_profit_earned_usd", { precision: 18, scale: 2 }),
  penaltyAmountUsd: numeric("penalty_amount_usd", { precision: 18, scale: 2 }),

  status: nwpWithdrawalStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * nwp_profit_ledger – daily profit credits for each active investor.
 * One row per user per working day.
 */
export const nwpProfitLedgerTable = pgTable("nwp_profit_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  creditDate: date("credit_date").notNull(),
  amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
  isWithdrawn: boolean("is_withdrawn").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("unique_profit_per_day").on(table.userId, table.creditDate),
]);

/**
 * nwp_reward_ledger – referral reward credits.
 * Upfront bonus + daily slices of monthly % rewards across 10 levels.
 */
export const nwpRewardLedgerTable = pgTable("nwp_reward_ledger", {
  id: serial("id").primaryKey(),

  // Who receives this reward
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  // Who generated this reward (the active investor below in the chain)
  sourceUserId: integer("source_user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  level: integer("level").notNull(),          // 1–10
  rewardType: nwpRewardTypeEnum("reward_type").notNull(),
  amountUsd: numeric("amount_usd", { precision: 18, scale: 2 }).notNull(),
  creditDate: date("credit_date").notNull(),
  isWithdrawn: boolean("is_withdrawn").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * nwp_profile_requests – requests to change profile fields (must be admin-approved).
 */
export const nwpProfileRequestsTable = pgTable("nwp_profile_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),

  field: nwpProfileFieldEnum("field").notNull(),
  newValue: text("new_value").notNull(),
  status: nwpProfileRequestStatusEnum("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * nwp_password_reset_tokens – short-lived tokens for password reset emails.
 */
export const nwpPasswordResetTokensTable = pgTable("nwp_password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => nwpUsersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod schemas ────────────────────────────────────────────────────────────────

export const insertNwpUserSchema = createInsertSchema(nwpUsersTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const selectNwpUserSchema = createSelectSchema(nwpUsersTable);
export type InsertNwpUser = z.infer<typeof insertNwpUserSchema>;
export type NwpUser = typeof nwpUsersTable.$inferSelect;

export const insertNwpDepositSchema = createInsertSchema(nwpDepositsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertNwpDeposit = z.infer<typeof insertNwpDepositSchema>;
export type NwpDeposit = typeof nwpDepositsTable.$inferSelect;

export const insertNwpWithdrawalSchema = createInsertSchema(nwpWithdrawalsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertNwpWithdrawal = z.infer<typeof insertNwpWithdrawalSchema>;
export type NwpWithdrawal = typeof nwpWithdrawalsTable.$inferSelect;

export const insertNwpProfileRequestSchema = createInsertSchema(nwpProfileRequestsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertNwpProfileRequest = z.infer<typeof insertNwpProfileRequestSchema>;
export type NwpProfileRequest = typeof nwpProfileRequestsTable.$inferSelect;
