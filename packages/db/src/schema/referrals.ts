import { pgTable, serial, text, integer, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// App users (linked to Replit auth users)
export const appUsersTable = pgTable("app_users", {
  id: serial("id").primaryKey(),
  replitUserId: varchar("replit_user_id", { length: 255 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  profileImageUrl: text("profile_image_url"),
  referralCode: varchar("referral_code", { length: 16 }).notNull().unique(),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Referral records (who referred who)
export const referralRecordsTable = pgTable("referral_records", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => appUsersTable.id),
  refereeId: integer("referee_id").notNull().references(() => appUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("unique_referee").on(table.refereeId), // each user can only be referred once
]);

export const insertAppUserSchema = createInsertSchema(appUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type AppUser = typeof appUsersTable.$inferSelect;

export const insertReferralSchema = createInsertSchema(referralRecordsTable).omit({ id: true, createdAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type ReferralRecord = typeof referralRecordsTable.$inferSelect;
