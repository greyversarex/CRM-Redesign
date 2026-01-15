import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, boolean, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "employee"]);
export const recordStatusEnum = pgEnum("record_status", ["pending", "done", "canceled"]);

// Users table (admin and employees)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: userRoleEnum("role").notNull().default("employee"),
  fullName: text("full_name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  records: many(records),
}));

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  records: many(records),
}));

// Services table
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: integer("price").notNull(),
});

export const servicesRelations = relations(services, ({ many }) => ({
  records: many(records),
}));

// Records table (appointments/bookings)
export const records = pgTable("records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  employeeId: varchar("employee_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  time: text("time").notNull().default("09:00"),
  status: recordStatusEnum("status").notNull().default("pending"),
  reminder: boolean("reminder").notNull().default(false),
  notificationSentAt: timestamp("notification_sent_at"),
});

export const recordsRelations = relations(records, ({ one, many }) => ({
  client: one(clients, {
    fields: [records.clientId],
    references: [clients.id],
  }),
  service: one(services, {
    fields: [records.serviceId],
    references: [services.id],
  }),
  employee: one(users, {
    fields: [records.employeeId],
    references: [users.id],
  }),
  incomes: many(incomes),
}));

// Income table
export const incomes = pgTable("incomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  recordId: varchar("record_id").references(() => records.id),
  reminder: boolean("reminder").notNull().default(false),
});

export const incomesRelations = relations(incomes, ({ one }) => ({
  record: one(records, {
    fields: [incomes.recordId],
    references: [records.id],
  }),
}));

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  reminder: boolean("reminder").notNull().default(false),
});

// Push subscriptions table for PWA notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertRecordSchema = createInsertSchema(records).omit({ id: true, notificationSentAt: true });
export const insertIncomeSchema = createInsertSchema(incomes).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });

// Login schema
export const loginSchema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Record = typeof records.$inferSelect;
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type Income = typeof incomes.$inferSelect;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Extended types with relations
export type RecordWithRelations = Record & {
  client: Client;
  service: Service;
  employee: User;
};

export type IncomeWithRelations = Income & {
  employeeName?: string | null;
};
