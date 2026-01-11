import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function autoSeed() {
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.login, "admin"));

  if (existingAdmin.length === 0) {
    console.log("Creating default admin user...");
    const adminPasswordHash = await hashPassword("admin123");

    await db.insert(users).values({
      fullName: "Администратор",
      login: "admin",
      passwordHash: adminPasswordHash,
      role: "admin",
    });

    console.log("Default admin created: admin / admin123");
  }
}
