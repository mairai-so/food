import { pgTable, text, jsonb, timestamp, boolean, uuid, integer } from "drizzle-orm/pg-core";

// ─── Store Snapshots ──────────────────────────────────────────────────────────
export const storeSnapshots = pgTable("store_snapshots", {
  key:       text("key").primaryKey(),
  data:      jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Companies ────────────────────────────────────────────────────────────────
// Cada empresa (restaurante) cadastrada na plataforma MIAR.
export const companies = pgTable("companies", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  razaoSocial: text("razao_social"),
  cnpj:        text("cnpj"),
  email:       text("email").notNull().unique(),
  phone:       text("phone"),
  address:     text("address"),
  ownerName:   text("owner_name").notNull(),
  logoUrl:     text("logo_url"),
  active:      boolean("active").default(true).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Owner Accounts ───────────────────────────────────────────────────────────
// Conta de acesso do proprietário/admin da empresa.
export const ownerAccounts = pgTable("owner_accounts", {
  id:           text("id").primaryKey(),
  companyId:    text("company_id").notNull().references(() => companies.id),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name:         text("name").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Employee Access Tokens ───────────────────────────────────────────────────
// Tokens únicos de acesso por função (garçom, cozinha, caixa, entregador).
// Cada funcionário tem um token persistente que não expira (pode ser revogado).
export const employeeTokens = pgTable("employee_tokens", {
  id:          text("id").primaryKey(),
  companyId:   text("company_id").notNull().references(() => companies.id),
  employeeId:  text("employee_id").notNull(),
  token:       text("token").notNull().unique(),
  role:        text("role").notNull(), // waiter | kitchen | cashier | delivery | manager
  active:      boolean("active").default(true).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── OTP Tokens (2FA) ─────────────────────────────────────────────────────────
// Tokens OTP temporários para autenticação de dois fatores via SMS.
export const otpTokens = pgTable("otp_tokens", {
  id:          text("id").primaryKey(), // UUID como text para compatibilidade
  ownerId:     text("owner_id").notNull().references(() => ownerAccounts.id, { onDelete: "cascade" }),
  phone:       text("phone").notNull(),
  code:        text("code").notNull(), // Código OTP de 6 dígitos
  attempts:    integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  expiresAt:   timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt:      timestamp("used_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Login Devices (Device Tracking) ──────────────────────────────────────────
// Rastreamento de dispositivos que fazem login na conta do proprietário.
export const loginDevices = pgTable("login_devices", {
  id:           text("id").primaryKey(), // UUID como text para compatibilidade
  ownerId:      text("owner_id").notNull().references(() => ownerAccounts.id, { onDelete: "cascade" }),
  deviceId:     text("device_id").notNull(), // Hash único do dispositivo
  deviceName:   text("device_name"), // Nome amigável (ex: "iPhone de João")
  userAgent:    text("user_agent"),
  ipAddress:    text("ip_address"),
  fingerprint:  text("fingerprint"), // Hash do User-Agent + timezone
  trustLevel:   text("trust_level").default("unknown").notNull(), // 'trusted' | 'unknown' | 'suspicious'
  alertSent:    boolean("alert_sent").default(false).notNull(),
  lastLoginAt:  timestamp("last_login_at", { withTimezone: true }),
  firstLoginAt: timestamp("first_login_at", { withTimezone: true }).defaultNow(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow(),
});
