import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const marketsUserStatusEnum = pgEnum("markets_user_status", [
  "active",
  "suspended",
  "pending",
]);

export const marketsPositionTypeEnum = pgEnum("markets_position_type", [
  "buy",
  "sell",
]);

export const marketsPositionStatusEnum = pgEnum("markets_position_status", [
  "open",
  "closed",
]);

export const marketsUsers = pgTable("markets_users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  country: text("country").notNull(),
  phone: text("phone"),
  status: marketsUserStatusEnum("status").notNull().default("active"),
  referralCode: text("referral_code").notNull().unique(),
  referredById: integer("referred_by_id"),
  balanceUsd: numeric("balance_usd", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalDepositsUsd: numeric("total_deposits_usd", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalPnlUsd: numeric("total_pnl_usd", { precision: 14, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketsPositions = pgTable("markets_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  pair: text("pair").notNull(),
  type: marketsPositionTypeEnum("type").notNull(),
  volumeLots: numeric("volume_lots", { precision: 8, scale: 2 }).notNull(),
  entryPrice: numeric("entry_price", { precision: 12, scale: 5 }).notNull(),
  currentPrice: numeric("current_price", { precision: 12, scale: 5 }),
  closePrice: numeric("close_price", { precision: 12, scale: 5 }),
  pnlUsd: numeric("pnl_usd", { precision: 12, scale: 2 }).notNull().default("0.00"),
  marginUsd: numeric("margin_usd", { precision: 12, scale: 2 }).notNull().default("0.00"),
  stopLoss: numeric("stop_loss", { precision: 12, scale: 5 }),
  takeProfit: numeric("take_profit", { precision: 12, scale: 5 }),
  status: marketsPositionStatusEnum("status").notNull().default("open"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const marketsDeposits = pgTable("markets_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketsCommissions = pgTable("markets_commissions", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id").notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
