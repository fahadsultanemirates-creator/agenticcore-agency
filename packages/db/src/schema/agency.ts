import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agencyCustomerStatusEnum = pgEnum("agency_customer_status", [
  "active",
  "suspended",
]);

export const agencyTaskStatusEnum = pgEnum("agency_task_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const agencyCreditTransactionTypeEnum = pgEnum(
  "agency_credit_transaction_type",
  ["credit", "debit"],
);

export const agencyServiceTypeEnum = pgEnum("agency_service_type", [
  "feasibility",
  "website",
  "social_media",
  "marketing",
  "bookkeeping",
  "legal",
  "seo",
  "image",
  "video",
  "deep_analysis",
  "site_audit",
  "general",
]);

export const agencyCustomersTable = pgTable("agency_customers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  company: text("company"),
  creditBalance: integer("credit_balance").notNull().default(0),
  status: agencyCustomerStatusEnum("status").notNull().default("active"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const agencyTasksTable = pgTable("agency_tasks", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => agencyCustomersTable.id),
  serviceType: agencyServiceTypeEnum("service_type").notNull(),
  brief: text("brief").notNull(),
  status: agencyTaskStatusEnum("status").notNull().default("pending"),
  creditCost: integer("credit_cost").notNull().default(1),
  result: text("result"),
  imageUrls: text("image_urls").array(),
  videoUrls: text("video_urls").array(),
  agentsUsed: text("agents_used").array(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const agencyCreditTransactionsTable = pgTable(
  "agency_credit_transactions",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => agencyCustomersTable.id),
    type: agencyCreditTransactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertAgencyCustomerSchema = createInsertSchema(
  agencyCustomersTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAgencyCustomer = z.infer<typeof insertAgencyCustomerSchema>;
export type AgencyCustomer = typeof agencyCustomersTable.$inferSelect;
export type AgencyTask = typeof agencyTasksTable.$inferSelect;
export type AgencyCreditTransaction =
  typeof agencyCreditTransactionsTable.$inferSelect;
