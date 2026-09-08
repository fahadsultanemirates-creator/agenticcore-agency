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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const estateUserRoleEnum = pgEnum("estate_user_role", [
  "buyer",
  "seller",
  "agent",
  "developer",
  "admin",
]);

export const estatePropertyPurposeEnum = pgEnum("estate_property_purpose", [
  "sale",
  "rent",
]);

export const estatePropertyTypeEnum = pgEnum("estate_property_type", [
  "house",
  "flat",
  "plot",
  "commercial",
  "farm_house",
  "room",
  "warehouse",
  "building",
  "shop",
  "office",
  "factory",
]);

export const estateAreaUnitEnum = pgEnum("estate_area_unit", [
  "marla",
  "kanal",
  "sqft",
  "sqm",
]);

export const estateListingStatusEnum = pgEnum("estate_listing_status", [
  "pending",
  "approved",
  "rejected",
]);

export const estateProjectStatusEnum = pgEnum("estate_project_status", [
  "upcoming",
  "new_launch",
  "running",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const estateUsers = pgTable("estate_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: estateUserRoleEnum("role").notNull().default("buyer"),
  city: text("city"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isVerified: boolean("is_verified").notNull().default(false),
  sessionToken: text("session_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateAgencies = pgTable("estate_agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  website: text("website"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateDevelopers = pgTable("estate_developers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyName: text("company_name").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  city: text("city").notNull(),
  website: text("website"),
  phone: text("phone"),
  establishedYear: integer("established_year"),
  totalProjects: integer("total_projects").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateProperties = pgTable("estate_properties", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  purpose: estatePropertyPurposeEnum("purpose").notNull(),
  type: estatePropertyTypeEnum("type").notNull(),
  city: text("city").notNull(),
  location: text("location").notNull(),
  area: numeric("area", { precision: 10, scale: 2 }).notNull(),
  areaUnit: estateAreaUnitEnum("area_unit").notNull().default("marla"),
  price: numeric("price", { precision: 16, scale: 0 }).notNull(),
  beds: integer("beds"),
  baths: integer("baths"),
  images: text("images").array().notNull().default([]),
  features: text("features").array().notNull().default([]),
  status: estateListingStatusEnum("status").notNull().default("pending"),
  isFeatured: boolean("is_featured").notNull().default(false),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateProjects = pgTable("estate_projects", {
  id: serial("id").primaryKey(),
  developerId: integer("developer_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  city: text("city").notNull(),
  location: text("location"),
  type: estatePropertyTypeEnum("type").notNull(),
  projectStatus: estateProjectStatusEnum("project_status").notNull(),
  status: estateListingStatusEnum("status").notNull().default("pending"),
  images: text("images").array().notNull().default([]),
  minPrice: numeric("min_price", { precision: 16, scale: 0 }),
  maxPrice: numeric("max_price", { precision: 16, scale: 0 }),
  paymentPlan: text("payment_plan"),
  progressPercent: integer("progress_percent").notNull().default(0),
  deliveryDate: text("delivery_date"),
  totalUnits: integer("total_units"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateCities = pgTable("estate_cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  province: text("province").notNull(),
  isPopular: boolean("is_popular").notNull().default(false),
});

export const estateSaved = pgTable("estate_saved", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  propertyId: integer("property_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estateInquiries = pgTable("estate_inquiries", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  fromUserId: integer("from_user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const insertEstateUserSchema = createInsertSchema(estateUsers).omit({
  id: true,
  passwordHash: true,
  sessionToken: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstatePropertySchema = createInsertSchema(estateProperties).omit({
  id: true,
  status: true,
  isFeatured: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstateProjectSchema = createInsertSchema(estateProjects).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstateUser = typeof estateUsers.$inferSelect;
export type EstateProperty = typeof estateProperties.$inferSelect;
export type EstateProject = typeof estateProjects.$inferSelect;
export type EstateDeveloper = typeof estateDevelopers.$inferSelect;
export type EstateCity = typeof estateCities.$inferSelect;
export type EstateInquiry = typeof estateInquiries.$inferSelect;
