import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { insertClientSchema, insertServiceSchema, insertRecordSchema, insertIncomeSchema, insertExpenseSchema, insertPushSubscriptionSchema } from "@shared/schema";
import { z } from "zod";
import { scrypt, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getVapidPublicKey } from "./push";
import { generateExcelReport, generateWordReport } from "./reports";

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

async function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  
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
      proxy: isProduction,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for PWA
        sameSite: isProduction ? "none" : "lax",
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
      
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Session error" });
        }
        const { passwordHash, ...safeUser } = user;
        res.json(safeUser);
      });
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

  app.get("/api/users", requireAdminOrManager, async (req, res) => {
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

  app.get("/api/users/:id", requireAdminOrManager, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  });

  app.get("/api/users/:id/records-count", requireAdmin, async (req, res) => {
    const count = await storage.getUserRecordsCount(req.params.id);
    res.json({ count });
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const cascade = req.query.cascade === "true";
      if (cascade) {
        await storage.deleteUserWithRecords(req.params.id);
      } else {
        await storage.deleteUser(req.params.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ error: "Нельзя удалить сотрудника с записями", hasRecords: true });
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

  app.post("/api/clients", requireAuth, async (req, res) => {
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

  app.patch("/api/clients/:id", requireAdminOrManager, async (req, res) => {
    const client = await storage.updateClient(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  });

  app.get("/api/clients/:id/records-count", requireAdmin, async (req, res) => {
    const count = await storage.getClientRecordsCount(req.params.id);
    res.json({ count });
  });

  app.delete("/api/clients/:id", requireAdmin, async (req, res) => {
    try {
      const cascade = req.query.cascade === "true";
      if (cascade) {
        await storage.deleteClientWithRecords(req.params.id);
      } else {
        await storage.deleteClient(req.params.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ error: "Нельзя удалить клиента с записями", hasRecords: true });
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

  app.get("/api/records/employee/:employeeId", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { date } = req.query;
    const records = await storage.getRecordsByEmployeeId(
      req.params.employeeId,
      date as string | undefined
    );
    res.json(records);
  });

  app.get("/api/records/counts/:yearMonth", requireAuth, async (req, res) => {
    const [year, month] = req.params.yearMonth.split("-").map(Number);
    const counts = await storage.getRecordCountsByMonth(year, month);
    res.json(counts);
  });

  app.get("/api/earnings/:yearMonth", requireAuth, async (req, res) => {
    const [year, month] = req.params.yearMonth.split("-").map(Number);
    const earnings = await storage.getEarningsByMonth(year, month);
    res.json(earnings);
  });

  app.post("/api/records", requireAuth, async (req, res) => {
    try {
      // Records are now created without employeeId - visible to all employees
      const data = {
        ...req.body,
        employeeId: null,
        patientCount: req.body.patientCount || 1,
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

  app.patch("/api/records/:id", requireAdminOrManager, async (req, res) => {
    try {
      const existingRecord = await storage.getRecord(req.params.id);
      if (!existingRecord) {
        return res.status(404).json({ error: "Record not found" });
      }

      await storage.updateRecord(req.params.id, req.body);

      // If status changed to "done", create income if not exists
      if (req.body.status === "done" && existingRecord.status !== "done") {
        const existingIncomes = await storage.getIncomesByRecordId(existingRecord.id);
        if (existingIncomes.length === 0) {
          const recordPatientCount = existingRecord.patientCount || 1;
          const totalIncome = existingRecord.service.price * recordPatientCount;
          await storage.createIncome({
            date: existingRecord.date,
            time: existingRecord.time || undefined,
            name: `${existingRecord.service.name} (${recordPatientCount} пац.)`,
            amount: totalIncome,
            recordId: existingRecord.id,
            reminder: false,
          });
        }
      }

      // Return updated record with joins
      const updatedRecord = await storage.getRecord(req.params.id);
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete a record - employee marks as done with patient count
  // Multiple employees can complete the same record
  app.post("/api/records/:id/complete", requireAuth, async (req, res) => {
    try {
      const record = await storage.getRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }

      const { patientCount = 1 } = req.body;
      const employeeId = req.session.userId!;

      // Validate patient count - cannot exceed record's patient count
      const maxPatients = record.patientCount ?? 1;
      if (patientCount > maxPatients) {
        return res.status(400).json({ 
          error: `Количество пациентов не может превышать ${maxPatients}` 
        });
      }
      if (patientCount < 1) {
        return res.status(400).json({ 
          error: "Количество пациентов должно быть не менее 1" 
        });
      }

      // Add completion record (multiple employees can complete the same record)
      const completion = await storage.addRecordCompletion({
        recordId: record.id,
        employeeId,
        patientCount,
      });

      // Update record status to "done" when completed
      await storage.updateRecord(record.id, { status: "done" });

      // Create income only ONCE per record (check if income already exists for this record)
      const existingIncomes = await storage.getIncomesByRecordId(record.id);
      if (existingIncomes.length === 0) {
        // Income = service price × patient count from the RECORD (not completion)
        const recordPatientCount = record.patientCount || 1;
        const totalIncome = record.service.price * recordPatientCount;
        await storage.createIncome({
          date: record.date,
          time: record.time || undefined,
          name: `${record.service.name} (${recordPatientCount} пац.)`,
          amount: totalIncome,
          recordId: record.id,
          reminder: false,
        });
      }

      res.json(completion);
    } catch (error) {
      console.error("Error completing record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get completions for a record
  app.get("/api/records/:id/completions", requireAuth, async (req, res) => {
    const completions = await storage.getRecordCompletions(req.params.id);
    res.json(completions);
  });

  // Get employee patient/service statistics
  app.get("/api/employees/:id/completions", requireAuth, async (req, res) => {
    const { startDate, endDate } = req.query;
    const stats = await storage.getEmployeeCompletions(
      req.params.id,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(stats);
  });

  app.delete("/api/records/:id", requireAdminOrManager, async (req, res) => {
    await storage.deleteRecord(req.params.id);
    res.json({ success: true });
  });

  // Update user (admin only) - for changing login/password
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { login, password, fullName, role } = req.body;
      const updateData: any = {};
      
      if (login) updateData.login = login;
      if (fullName) updateData.fullName = fullName;
      if (role) updateData.role = role;
      if (password) {
        const salt = randomBytes(16).toString("hex");
        const hash = scryptSync(password, salt, 64).toString("hex");
        updateData.passwordHash = `${salt}:${hash}`;
      }
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
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

  // Inventory endpoints
  app.get("/api/inventory", requireAdmin, async (req, res) => {
    const items = await storage.getAllInventoryItems();
    res.json(items);
  });

  app.get("/api/inventory/:id", requireAdmin, async (req, res) => {
    const item = await storage.getInventoryItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  });

  app.post("/api/inventory", requireAdmin, async (req, res) => {
    try {
      const { name, quantity, unit } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const item = await storage.createInventoryItem({
        name,
        quantity: quantity || 0,
        unit: unit || "шт",
      });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to create item" });
    }
  });

  app.patch("/api/inventory/:id/quantity", requireAdmin, async (req, res) => {
    const { quantity, changeType, note } = req.body;
    if (quantity === undefined || !changeType) {
      return res.status(400).json({ error: "Quantity and changeType are required" });
    }
    const item = await storage.updateInventoryItemQuantity(
      req.params.id,
      quantity,
      changeType,
      note
    );
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  });

  app.post("/api/inventory/:id/purchase", requireAdmin, async (req, res) => {
    try {
      const { quantity, pricePerUnit, date } = req.body;
      if (!quantity || !pricePerUnit) {
        return res.status(400).json({ error: "Quantity and pricePerUnit are required" });
      }
      
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const totalCost = quantity * pricePerUnit;
      const purchaseDate = date || new Date().toISOString().split("T")[0];
      const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      
      // Create expense record
      const expense = await storage.createExpense({
        date: purchaseDate,
        time,
        name: `Закупка: ${item.name} (${quantity} ${item.unit} × ${pricePerUnit})`,
        amount: totalCost,
        reminder: false,
      });
      
      // Update inventory quantity with reference to expense
      const newQuantity = item.quantity + quantity;
      const updated = await storage.updateInventoryItemQuantity(
        req.params.id,
        newQuantity,
        "purchase",
        `Закупка ${quantity} ${item.unit} по ${pricePerUnit} = ${totalCost}`,
        expense.id
      );
      
      res.json({ item: updated, expense });
    } catch (error) {
      console.error("Purchase error:", error);
      res.status(400).json({ error: "Failed to process purchase" });
    }
  });

  app.get("/api/inventory/:id/history", requireAdmin, async (req, res) => {
    const history = await storage.getInventoryHistory(req.params.id);
    res.json(history);
  });

  app.delete("/api/inventory/:id", requireAdmin, async (req, res) => {
    await storage.deleteInventoryItem(req.params.id);
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

  app.get("/api/analytics/income", requireAdmin, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end dates required" });
    }
    const data = await storage.getDetailedIncome(start as string, end as string);
    res.json(data);
  });

  app.get("/api/analytics/expense", requireAdmin, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end dates required" });
    }
    const data = await storage.getDetailedExpense(start as string, end as string);
    res.json(data);
  });

  app.get("/api/analytics/clients", requireAdmin, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end dates required" });
    }
    const data = await storage.getDetailedClients(start as string, end as string);
    res.json(data);
  });

  app.get("/api/analytics/employees/:id", requireAdmin, async (req, res) => {
    try {
      const { startDate, endDate, serviceId } = req.query;
      const options: { startDate?: string; endDate?: string; serviceId?: string } = {};
      if (startDate) options.startDate = startDate as string;
      if (endDate) options.endDate = endDate as string;
      if (serviceId) options.serviceId = serviceId as string;
      
      const analytics = await storage.getEmployeeDailyAnalytics(req.params.id, options);
      res.json(analytics);
    } catch (error) {
      res.status(404).json({ error: "Employee not found" });
    }
  });

  // Report export endpoints
  const reportQuerySchema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    period: z.enum(["day", "month", "year"]).optional().default("month"),
  });

  app.get("/api/reports/excel", requireAdmin, async (req, res) => {
    try {
      const parsed = reportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid parameters", details: parsed.error.errors });
      }
      const { start, end, period } = parsed.data;
      const buffer = await generateExcelReport(start, end, period);
      
      const filename = `report_${start}_${end}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Excel report error:", error);
      res.status(500).json({ error: "Failed to generate Excel report" });
    }
  });

  app.get("/api/reports/word", requireAdmin, async (req, res) => {
    try {
      const parsed = reportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid parameters", details: parsed.error.errors });
      }
      const { start, end, period } = parsed.data;
      const buffer = await generateWordReport(start, end, period);
      
      const filename = `report_${start}_${end}.docx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Word report error:", error);
      res.status(500).json({ error: "Failed to generate Word report" });
    }
  });

  // Service payments (salary settings) endpoints
  app.get("/api/service-payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllServicePayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service payments" });
    }
  });

  app.put("/api/service-payments/:serviceId", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { paymentPerPatient } = req.body;
      
      if (typeof paymentPerPatient !== "number" || paymentPerPatient < 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }
      
      const payment = await storage.upsertServicePayment(serviceId, paymentPerPatient);
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service payment" });
    }
  });

  // Salary data endpoint
  app.get("/api/salary", requireAdmin, async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates required" });
      }
      
      const data = await storage.getSalaryData(start as string, end as string);
      res.json(data);
    } catch (error) {
      console.error("Salary data error:", error);
      res.status(500).json({ error: "Failed to fetch salary data" });
    }
  });

  // Push notification endpoints
  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription data" });
      }

      const subscription = await storage.savePushSubscription({
        userId: req.session.userId!,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      res.json({ success: true, id: subscription.id });
    } catch (error) {
      console.error("Push subscribe error:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.delete("/api/push/unsubscribe", requireAuth, async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint required" });
      }
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  return httpServer;
}
