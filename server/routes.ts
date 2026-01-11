import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { insertClientSchema, insertServiceSchema, insertRecordSchema, insertIncomeSchema, insertExpenseSchema } from "@shared/schema";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const PgStore = connectPgSimple(session);

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "crm-session-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { login, password } = req.body;
      const user = await storage.getUserByLogin(login);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(({ passwordHash, ...u }) => u);
    res.json(safeUsers);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { fullName, login, password, role } = req.body;
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({ fullName, login, passwordHash, role: role || "employee" });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ error: "Нельзя удалить сотрудника с записями" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/clients", requireAuth, async (req, res) => {
    const allClients = await storage.getAllClients();
    res.json(allClients);
  });

  app.get("/api/clients/:id", requireAuth, async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  });

  app.post("/api/clients", requireAdmin, async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/clients/:id", requireAdmin, async (req, res) => {
    const client = await storage.updateClient(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  });

  app.delete("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ error: "Нельзя удалить клиента с записями" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/services", requireAuth, async (req, res) => {
    const allServices = await storage.getAllServices();
    res.json(allServices);
  });

  app.post("/api/services", requireAdmin, async (req, res) => {
    try {
      const data = insertServiceSchema.parse(req.body);
      const service = await storage.createService(data);
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/services/:id", requireAdmin, async (req, res) => {
    const service = await storage.updateService(req.params.id, req.body);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.json(service);
  });

  app.delete("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ error: "Нельзя удалить услугу с записями" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/records", requireAuth, async (req, res) => {
    const { date, clientId } = req.query;
    if (clientId) {
      const records = await storage.getRecordsByClientId(clientId as string);
      return res.json(records);
    }
    if (date) {
      const records = await storage.getRecordsByDate(date as string);
      return res.json(records);
    }
    res.json([]);
  });

  app.get("/api/records/my", requireAuth, async (req, res) => {
    const { date } = req.query;
    const records = await storage.getRecordsByEmployeeId(
      req.session.userId!,
      date as string | undefined
    );
    res.json(records);
  });

  app.get("/api/records/counts/:yearMonth", requireAuth, async (req, res) => {
    const [year, month] = req.params.yearMonth.split("-").map(Number);
    const counts = await storage.getRecordCountsByMonth(year, month);
    res.json(counts);
  });

  app.post("/api/records", requireAuth, async (req, res) => {
    try {
      const data = {
        ...req.body,
        employeeId: req.session.userId!,
      };
      const record = await storage.createRecord(data);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/records/:id", requireAuth, async (req, res) => {
    try {
      const existingRecord = await storage.getRecord(req.params.id);
      if (!existingRecord) {
        return res.status(404).json({ error: "Record not found" });
      }

      const record = await storage.updateRecord(req.params.id, req.body);
      
      if (req.body.status === "done" && existingRecord.status !== "done") {
        await storage.createIncome({
          date: existingRecord.date,
          name: existingRecord.service.name,
          amount: existingRecord.service.price,
          recordId: existingRecord.id,
          reminder: false,
        });
      }

      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/records/:id", requireAuth, async (req, res) => {
    await storage.deleteRecord(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/incomes", requireAdmin, async (req, res) => {
    const { date } = req.query;
    if (date) {
      const incomes = await storage.getIncomesByDate(date as string);
      return res.json(incomes);
    }
    res.json([]);
  });

  app.post("/api/incomes", requireAdmin, async (req, res) => {
    try {
      const data = insertIncomeSchema.parse(req.body);
      const income = await storage.createIncome(data);
      res.json(income);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/incomes/:id", requireAdmin, async (req, res) => {
    await storage.deleteIncome(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/expenses", requireAdmin, async (req, res) => {
    const { date } = req.query;
    if (date) {
      const expenses = await storage.getExpensesByDate(date as string);
      return res.json(expenses);
    }
    res.json([]);
  });

  app.post("/api/expenses", requireAdmin, async (req, res) => {
    try {
      const data = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(data);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/expenses/:id", requireAdmin, async (req, res) => {
    await storage.deleteExpense(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/analytics/month", requireAdmin, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end dates required" });
    }
    const analytics = await storage.getMonthlyAnalytics(start as string, end as string);
    res.json(analytics);
  });

  app.get("/api/analytics/employees/:id", requireAdmin, async (req, res) => {
    try {
      const analytics = await storage.getEmployeeDailyAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      res.status(404).json({ error: "Employee not found" });
    }
  });

  return httpServer;
}
