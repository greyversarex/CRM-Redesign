import { db } from "./db";
import { users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already has users, skipping seed.");
    return;
  }

  const adminPasswordHash = await hashPassword("admin123");
  const employeePasswordHash = await hashPassword("employee123");

  await db.insert(users).values([
    {
      fullName: "Администратор",
      login: "admin",
      passwordHash: adminPasswordHash,
      role: "admin",
    },
    {
      fullName: "Сотрудник Иванов",
      login: "employee",
      passwordHash: employeePasswordHash,
      role: "employee",
    },
  ]);

  console.log("Seed completed!");
  console.log("Admin credentials: admin / admin123");
  console.log("Employee credentials: employee / employee123");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
