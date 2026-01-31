import {
  users, clients, services, records, incomes, expenses, pushSubscriptions, recordCompletions,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Service, type InsertService,
  type Record as RecordType, type InsertRecord,
  type RecordCompletion, type InsertRecordCompletion, type RecordCompletionWithEmployee,
  type Income, type InsertIncome,
  type Expense, type InsertExpense,
  type RecordWithRelations,
  type IncomeWithRelations,
  type PushSubscription, type InsertPushSubscription,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, isNull, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByLogin(login: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<{ login: string; passwordHash: string; fullName: string; role: "admin" | "manager" | "employee" }>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  
  getClient(id: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  
  getService(id: string): Promise<Service | undefined>;
  getAllServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;
  
  getRecord(id: string): Promise<RecordWithRelations | undefined>;
  getRecordsByDate(date: string): Promise<RecordWithRelations[]>;
  getRecordsByDateRange(startDate: string, endDate: string): Promise<RecordWithRelations[]>;
  getRecordsByClientId(clientId: string): Promise<RecordWithRelations[]>;
  getRecordsByEmployeeId(employeeId: string, date?: string): Promise<RecordWithRelations[]>;
  getRecordCountsByMonth(year: number, month: number): Promise<Record<string, number>>;
  getEarningsByMonth(year: number, month: number): Promise<Record<string, number>>;
  createRecord(record: InsertRecord): Promise<RecordType>;
  updateRecord(id: string, record: Partial<InsertRecord>): Promise<RecordType | undefined>;
  deleteRecord(id: string): Promise<void>;
  
  getIncomesByDate(date: string): Promise<IncomeWithRelations[]>;
  getIncomesByRecordId(recordId: string): Promise<Income[]>;
  createIncome(income: InsertIncome): Promise<Income>;
  deleteIncome(id: string): Promise<void>;
  
  getExpensesByDate(date: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  
  getMonthlyAnalytics(startDate: string, endDate: string): Promise<{
    totalIncome: number;
    totalExpense: number;
    result: number;
    uniqueClients: number;
    employeeStats: { id: string; fullName: string; completedServices: number; revenue: number }[];
  }>;
  
  getDetailedIncome(startDate: string, endDate: string): Promise<{
    byDate: Record<string, any[]>;
    byService: Record<string, number>;
    totalIncome: number;
  }>;
  
  getDetailedExpense(startDate: string, endDate: string): Promise<{
    byDate: Record<string, any[]>;
    byCategory: Record<string, number>;
    totalExpense: number;
  }>;
  
  getDetailedClients(startDate: string, endDate: string): Promise<{
    clientStats: { client: any; totalSpent: number; servicesCount: number }[];
    totalFromClients: number;
    uniqueClients: number;
  }>;
  
  getEmployeeDailyAnalytics(employeeId: string, options?: { startDate?: string; endDate?: string; serviceId?: string }): Promise<{
    employee: { id: string; fullName: string };
    dailyStats: { 
      date: string; 
      clientsServed: number; 
      completedServices: number;
      serviceDetails: { serviceName: string; patientCount: number; time?: string }[];
    }[];
    totalClientsServed: number;
    totalServices: number;
  }>;
  
  // Push subscription methods
  savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  deletePushSubscription(endpoint: string): Promise<void>;
  
  // Records needing notifications
  getRecordsNeedingNotification(): Promise<RecordWithRelations[]>;
  markRecordNotified(recordId: string): Promise<void>;
  
  // Record completions
  getRecordCompletions(recordId: string): Promise<RecordCompletionWithEmployee[]>;
  addRecordCompletion(completion: InsertRecordCompletion): Promise<RecordCompletion>;
  deleteRecordCompletion(id: string): Promise<void>;
  getEmployeeCompletions(employeeId: string, startDate?: string, endDate?: string): Promise<{
    totalPatients: number;
    byService: { serviceId: string; serviceName: string; patientCount: number; revenue: number }[];
  }>;
  
  // Get all records (visible to all employees)
  getAllRecords(date?: string): Promise<RecordWithRelations[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByLogin(login: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.login, login));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, userData: Partial<{ login: string; passwordHash: string; fullName: string; role: "admin" | "manager" | "employee" }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async deleteUserWithRecords(id: string): Promise<void> {
    const userRecords = await db.select().from(records).where(eq(records.employeeId, id));
    for (const record of userRecords) {
      await db.delete(incomes).where(eq(incomes.recordId, record.id));
    }
    await db.delete(records).where(eq(records.employeeId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserRecordsCount(id: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(records).where(eq(records.employeeId, id));
    return result[0]?.count || 0;
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getAllClients(): Promise<Client[]> {
    return db.select().from(clients);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db.update(clients).set(data).where(eq(clients.id, id)).returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async deleteClientWithRecords(id: string): Promise<void> {
    const clientRecords = await db.select().from(records).where(eq(records.clientId, id));
    for (const record of clientRecords) {
      await db.delete(incomes).where(eq(incomes.recordId, record.id));
    }
    await db.delete(records).where(eq(records.clientId, id));
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getClientRecordsCount(id: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(records).where(eq(records.clientId, id));
    return result[0]?.count || 0;
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async getAllServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(insertService).returning();
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return service || undefined;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async getRecord(id: string): Promise<RecordWithRelations | undefined> {
    const result = await db
      .select()
      .from(records)
      .where(eq(records.id, id))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    if (result.length === 0 || !result[0].services) {
      return undefined;
    }

    const completions = await this.getRecordCompletions(result[0].records.id);
    return {
      ...result[0].records,
      client: result[0].clients || undefined,
      service: result[0].services,
      employee: result[0].users || undefined,
      completions,
    };
  }

  async getRecordsByDate(date: string): Promise<RecordWithRelations[]> {
    const result = await db
      .select()
      .from(records)
      .where(eq(records.date, date))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    const recordsWithCompletions: RecordWithRelations[] = [];
    
    for (const r of result.filter((r) => r.services)) {
      const completions = await this.getRecordCompletions(r.records.id);
      recordsWithCompletions.push({
        ...r.records,
        client: r.clients || undefined,
        service: r.services!,
        employee: r.users || undefined,
        completions,
      });
    }

    return recordsWithCompletions;
  }

  async getRecordsByDateRange(startDate: string, endDate: string): Promise<RecordWithRelations[]> {
    const result = await db
      .select()
      .from(records)
      .where(and(gte(records.date, startDate), lte(records.date, endDate)))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    const recordsWithCompletions: RecordWithRelations[] = [];
    
    for (const r of result.filter((r) => r.services)) {
      const completions = await this.getRecordCompletions(r.records.id);
      recordsWithCompletions.push({
        ...r.records,
        client: r.clients || undefined,
        service: r.services!,
        employee: r.users || undefined,
        completions,
      });
    }

    return recordsWithCompletions;
  }

  async getRecordsByClientId(clientId: string): Promise<RecordWithRelations[]> {
    const result = await db
      .select()
      .from(records)
      .where(eq(records.clientId, clientId))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    const recordsWithCompletions: RecordWithRelations[] = [];
    
    for (const r of result.filter((r) => r.clients && r.services)) {
      const completions = await this.getRecordCompletions(r.records.id);
      recordsWithCompletions.push({
        ...r.records,
        client: r.clients!,
        service: r.services!,
        employee: r.users || undefined,
        completions,
      });
    }

    return recordsWithCompletions;
  }

  async getRecordsByEmployeeId(employeeId: string, date?: string): Promise<RecordWithRelations[]> {
    // Now returns records where the employee has completed them (via recordCompletions)
    const employeeCompletions = await db
      .select({ recordId: recordCompletions.recordId })
      .from(recordCompletions)
      .where(eq(recordCompletions.employeeId, employeeId));
    
    const recordIds = employeeCompletions.map(c => c.recordId);
    if (recordIds.length === 0) {
      return [];
    }

    const result = await db
      .select()
      .from(records)
      .where(date ? and(sql`${records.id} = ANY(${recordIds})`, eq(records.date, date)) : sql`${records.id} = ANY(${recordIds})`)
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    const recordsWithCompletions: RecordWithRelations[] = [];
    
    for (const r of result.filter((r) => r.services)) {
      const completions = await this.getRecordCompletions(r.records.id);
      recordsWithCompletions.push({
        ...r.records,
        client: r.clients || undefined,
        service: r.services!,
        employee: r.users || undefined,
        completions,
      });
    }

    return recordsWithCompletions;
  }

  async getRecordCountsByMonth(year: number, month: number): Promise<any> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const result = await db
      .select({
        date: records.date,
        count: sql<number>`count(*)::int`,
      })
      .from(records)
      .where(and(gte(records.date, startDate), lte(records.date, endDate)))
      .groupBy(records.date);

    const counts: any = {};
    for (const row of result) {
      counts[row.date] = row.count;
    }
    return counts;
  }

  async getEarningsByMonth(year: number, month: number): Promise<Record<string, number>> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const result = await db
      .select({
        date: incomes.date,
        total: sql<number>`sum(${incomes.amount})::int`,
      })
      .from(incomes)
      .where(and(gte(incomes.date, startDate), lte(incomes.date, endDate)))
      .groupBy(incomes.date);

    const earnings: Record<string, number> = {};
    for (const row of result) {
      earnings[row.date] = row.total;
    }
    return earnings;
  }

  async createRecord(insertRecord: InsertRecord): Promise<RecordType> {
    const [record] = await db.insert(records).values(insertRecord).returning();
    return record;
  }

  async updateRecord(id: string, data: Partial<InsertRecord>): Promise<RecordType | undefined> {
    const [record] = await db.update(records).set(data).where(eq(records.id, id)).returning();
    return record || undefined;
  }

  async deleteRecord(id: string): Promise<void> {
    await db.delete(incomes).where(eq(incomes.recordId, id));
    await db.delete(records).where(eq(records.id, id));
  }

  async getIncomesByDate(date: string): Promise<IncomeWithRelations[]> {
    const result = await db
      .select({
        id: incomes.id,
        date: incomes.date,
        time: incomes.time,
        name: incomes.name,
        amount: incomes.amount,
        recordId: incomes.recordId,
        reminder: incomes.reminder,
        employeeName: users.fullName,
      })
      .from(incomes)
      .leftJoin(records, eq(incomes.recordId, records.id))
      .leftJoin(users, eq(records.employeeId, users.id))
      .where(eq(incomes.date, date));
    return result;
  }

  async getIncomesByRecordId(recordId: string): Promise<Income[]> {
    return db.select().from(incomes).where(eq(incomes.recordId, recordId));
  }

  async createIncome(insertIncome: InsertIncome): Promise<Income> {
    const [income] = await db.insert(incomes).values(insertIncome).returning();
    return income;
  }

  async deleteIncome(id: string): Promise<void> {
    await db.delete(incomes).where(eq(incomes.id, id));
  }

  async getExpensesByDate(date: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.date, date));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getDetailedIncome(startDate: string, endDate: string) {
    const monthIncomes = await db
      .select({
        id: incomes.id,
        date: incomes.date,
        time: incomes.time,
        name: incomes.name,
        amount: incomes.amount,
        recordId: incomes.recordId,
        reminder: incomes.reminder,
        serviceName: services.name,
        clientId: records.clientId,
      })
      .from(incomes)
      .leftJoin(records, eq(incomes.recordId, records.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .where(and(gte(incomes.date, startDate), lte(incomes.date, endDate)));

    // For each income with a recordId, get employee names from recordCompletions
    const incomeWithEmployees: {
      id: string;
      date: string;
      time: string | null;
      name: string;
      amount: number;
      recordId: string | null;
      reminder: boolean;
      serviceName: string | null;
      employeeName: string | null;
    }[] = [];

    // Track unique records and clients
    const uniqueRecordIds = new Set<string>();
    const uniqueClientIds = new Set<string>();

    for (const income of monthIncomes) {
      let employeeName: string | null = null;
      
      if (income.recordId) {
        uniqueRecordIds.add(income.recordId);
        if (income.clientId) {
          uniqueClientIds.add(income.clientId);
        }
        
        // Get all employees who completed this record
        const completions = await db
          .select({ employeeName: users.fullName })
          .from(recordCompletions)
          .innerJoin(users, eq(recordCompletions.employeeId, users.id))
          .where(eq(recordCompletions.recordId, income.recordId));
        
        if (completions.length > 0) {
          employeeName = completions.map(c => c.employeeName).join(", ");
        }
      }
      
      incomeWithEmployees.push({
        id: income.id,
        date: income.date,
        time: income.time,
        name: income.name,
        amount: income.amount,
        recordId: income.recordId,
        reminder: income.reminder,
        serviceName: income.serviceName,
        employeeName,
      });
    }

    // Group by date
    const byDate: Record<string, typeof incomeWithEmployees> = {};
    for (const income of incomeWithEmployees) {
      if (!byDate[income.date]) {
        byDate[income.date] = [];
      }
      byDate[income.date].push(income);
    }

    // Group by service for list
    const byService: Record<string, number> = {};
    for (const income of incomeWithEmployees) {
      const serviceName = income.serviceName || income.name;
      byService[serviceName] = (byService[serviceName] || 0) + income.amount;
    }

    const totalIncome = incomeWithEmployees.reduce((sum, i) => sum + i.amount, 0);

    return {
      byDate,
      byService,
      totalIncome,
      recordCount: uniqueRecordIds.size,
      clientCount: uniqueClientIds.size,
    };
  }

  async getDetailedExpense(startDate: string, endDate: string) {
    const monthExpenses = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)));

    // Group by date
    const byDate: Record<string, typeof monthExpenses> = {};
    for (const expense of monthExpenses) {
      if (!byDate[expense.date]) {
        byDate[expense.date] = [];
      }
      byDate[expense.date].push(expense);
    }

    // Group by category/name for chart
    const byCategory: Record<string, number> = {};
    for (const expense of monthExpenses) {
      byCategory[expense.name] = (byCategory[expense.name] || 0) + expense.amount;
    }

    const totalExpense = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      byDate,
      byCategory,
      totalExpense,
    };
  }

  async getDetailedClients(startDate: string, endDate: string) {
    const completedRecords = await db
      .select()
      .from(records)
      .where(
        and(
          gte(records.date, startDate),
          lte(records.date, endDate),
          eq(records.status, "done")
        )
      )
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id));

    // Group by client
    const clientMap = new Map<string, { client: any; totalSpent: number; servicesCount: number }>();
    for (const row of completedRecords) {
      if (row.clients && row.services) {
        const existing = clientMap.get(row.clients.id) || {
          client: row.clients,
          totalSpent: 0,
          servicesCount: 0,
        };
        existing.totalSpent += row.services.price;
        existing.servicesCount += 1;
        clientMap.set(row.clients.id, existing);
      }
    }

    const clientStats = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    const totalFromClients = clientStats.reduce((sum, c) => sum + c.totalSpent, 0);

    return {
      clientStats,
      totalFromClients,
      uniqueClients: clientStats.length,
    };
  }

  async getMonthlyAnalytics(startDate: string, endDate: string) {
    const monthIncomes = await db
      .select()
      .from(incomes)
      .where(and(gte(incomes.date, startDate), lte(incomes.date, endDate)));

    const monthExpenses = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)));

    const completedRecords = await db
      .select()
      .from(records)
      .where(
        and(
          gte(records.date, startDate),
          lte(records.date, endDate),
          eq(records.status, "done")
        )
      )
      .leftJoin(services, eq(records.serviceId, services.id));

    const totalIncome = monthIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const uniqueClientIds = new Set(
      completedRecords.map((r) => r.records.clientId)
    );

    // Get employee stats from recordCompletions table
    // Revenue = price × RECORD's patientCount (NOT completion's patientCount)
    const completionsData = await db
      .select({
        completionId: recordCompletions.id,
        employeeId: recordCompletions.employeeId,
        recordId: recordCompletions.recordId,
        recordPatientCount: records.patientCount,
        recordDate: records.date,
        servicePrice: services.price,
        employeeName: users.fullName,
      })
      .from(recordCompletions)
      .innerJoin(records, eq(recordCompletions.recordId, records.id))
      .innerJoin(services, eq(records.serviceId, services.id))
      .innerJoin(users, eq(recordCompletions.employeeId, users.id))
      .where(
        and(
          gte(records.date, startDate),
          lte(records.date, endDate)
        )
      );

    // Track which records have been counted to avoid double-counting
    const countedRecords = new Set<string>();
    const employeeMap = new Map<string, { fullName: string; completedServices: number; revenue: number }>();
    
    for (const row of completionsData) {
      const existing = employeeMap.get(row.employeeId) || {
        fullName: row.employeeName,
        completedServices: 0,
        revenue: 0,
      };
      existing.completedServices += 1;
      
      // Revenue = price × record.patientCount, counted only ONCE per record
      if (!countedRecords.has(row.recordId)) {
        existing.revenue += (row.servicePrice || 0) * (row.recordPatientCount || 1);
        countedRecords.add(row.recordId);
      }
      
      employeeMap.set(row.employeeId, existing);
    }

    const employeeStats = Array.from(employeeMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    return {
      totalIncome,
      totalExpense,
      result: totalIncome - totalExpense,
      uniqueClients: uniqueClientIds.size,
      employeeStats,
    };
  }

  async getEmployeeDailyAnalytics(employeeId: string, options?: { startDate?: string; endDate?: string; serviceId?: string }) {
    const employee = await this.getUser(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Query from recordCompletions table joined with records and services
    const conditions = [eq(recordCompletions.employeeId, employeeId)];

    // Build query with joins to get record date and service info
    let query = db
      .select({
        date: records.date,
        time: records.time,
        patientCount: recordCompletions.patientCount,
        serviceId: records.serviceId,
        serviceName: services.name,
      })
      .from(recordCompletions)
      .innerJoin(records, eq(recordCompletions.recordId, records.id))
      .innerJoin(services, eq(records.serviceId, services.id));

    // Apply filters
    const filterConditions = [...conditions];
    if (options?.startDate) {
      filterConditions.push(gte(records.date, options.startDate));
    }
    if (options?.endDate) {
      filterConditions.push(lte(records.date, options.endDate));
    }
    if (options?.serviceId) {
      filterConditions.push(eq(records.serviceId, options.serviceId));
    }

    const completions = await query.where(and(...filterConditions));

    // Group by date and service
    const dailyMap = new Map<string, { 
      clientsServed: number; 
      completedServices: number;
      serviceDetails: { serviceName: string; patientCount: number; time?: string }[];
    }>();
    let totalClientsServed = 0;
    let totalServices = 0;

    for (const row of completions) {
      const patients = row.patientCount ?? 1;
      const existing = dailyMap.get(row.date) || { 
        clientsServed: 0, 
        completedServices: 0,
        serviceDetails: []
      };
      existing.clientsServed += patients;
      existing.completedServices += 1;
      existing.serviceDetails.push({
        serviceName: row.serviceName,
        patientCount: patients,
        time: row.time || undefined,
      });
      dailyMap.set(row.date, existing);
      totalClientsServed += patients;
      totalServices += 1;
    }

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      employee: { id: employee.id, fullName: employee.fullName },
      dailyStats,
      totalClientsServed,
      totalServices,
    };
  }

  // Push subscription methods
  async savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Upsert - update if endpoint exists, otherwise insert
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    if (existing.length > 0) {
      const [updated] = await db
        .update(pushSubscriptions)
        .set({ p256dh: subscription.p256dh, auth: subscription.auth, userId: subscription.userId })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
      return updated;
    }
    const [result] = await db.insert(pushSubscriptions).values(subscription).returning();
    return result;
  }

  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  // Get records that need notification (reminder=true and within 1 hour of start, not yet notified)
  async getRecordsNeedingNotification(): Promise<RecordWithRelations[]> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Get records for today with reminder=true and status=pending, not yet notified
    const result = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.date, today),
          eq(records.reminder, true),
          eq(records.status, "pending"),
          isNull(records.notificationSentAt)
        )
      )
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));

    // Filter records that are within the next hour
    const recordsToNotify = result
      .filter((r) => {
        if (!r.services) return false;
        const [recordHour, recordMinute] = r.records.time.split(':').map(Number);
        const recordMinutes = recordHour * 60 + recordMinute;
        const currentMinutes = currentHour * 60 + currentMinute;
        const diff = recordMinutes - currentMinutes;
        // Notify if within 60 minutes and not past
        return diff > 0 && diff <= 60;
      })
      .map((r) => ({
        ...r.records,
        client: r.clients || undefined,
        service: r.services!,
        employee: r.users || undefined,
      }));

    return recordsToNotify;
  }

  async markRecordNotified(recordId: string): Promise<void> {
    await db.update(records).set({ notificationSentAt: new Date() }).where(eq(records.id, recordId));
  }

  // Record completions methods
  async getRecordCompletions(recordId: string): Promise<RecordCompletionWithEmployee[]> {
    const result = await db
      .select()
      .from(recordCompletions)
      .where(eq(recordCompletions.recordId, recordId))
      .leftJoin(users, eq(recordCompletions.employeeId, users.id));
    
    return result
      .filter((r) => r.users)
      .map((r) => ({
        ...r.record_completions,
        employee: r.users!,
      }));
  }

  async addRecordCompletion(completion: InsertRecordCompletion): Promise<RecordCompletion> {
    const [result] = await db.insert(recordCompletions).values(completion).returning();
    return result;
  }

  async deleteRecordCompletion(id: string): Promise<void> {
    await db.delete(recordCompletions).where(eq(recordCompletions.id, id));
  }

  async getEmployeeCompletions(employeeId: string, startDate?: string, endDate?: string): Promise<{
    totalPatients: number;
    byService: { serviceId: string; serviceName: string; patientCount: number; revenue: number }[];
  }> {
    let query = db
      .select({
        recordId: recordCompletions.recordId,
        recordPatientCount: records.patientCount,
        serviceId: records.serviceId,
        serviceName: services.name,
        servicePrice: services.price,
        recordDate: records.date,
      })
      .from(recordCompletions)
      .leftJoin(records, eq(recordCompletions.recordId, records.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .where(eq(recordCompletions.employeeId, employeeId));

    const result = await query;

    // Filter by date range if specified
    const filteredResult = result.filter((r) => {
      if (!r.recordDate) return false;
      if (startDate && r.recordDate < startDate) return false;
      if (endDate && r.recordDate > endDate) return false;
      return true;
    });

    // Calculate totals - revenue = price × RECORD's patientCount
    let totalPatients = 0;
    const serviceMap = new Map<string, { serviceName: string; patientCount: number; revenue: number }>();
    const countedRecords = new Set<string>();

    for (const row of filteredResult) {
      if (!row.serviceId || !row.serviceName || !row.recordId) continue;
      
      // Only count each record once
      if (countedRecords.has(row.recordId)) continue;
      countedRecords.add(row.recordId);
      
      const recordPatients = row.recordPatientCount || 1;
      totalPatients += recordPatients;
      
      const existing = serviceMap.get(row.serviceId) || {
        serviceName: row.serviceName,
        patientCount: 0,
        revenue: 0,
      };
      existing.patientCount += recordPatients;
      existing.revenue += (row.servicePrice || 0) * recordPatients;
      serviceMap.set(row.serviceId, existing);
    }

    const byService = Array.from(serviceMap.entries()).map(([serviceId, data]) => ({
      serviceId,
      ...data,
    })).sort((a, b) => b.patientCount - a.patientCount);

    return { totalPatients, byService };
  }

  async getAllRecords(date?: string): Promise<RecordWithRelations[]> {
    const result = await db
      .select()
      .from(records)
      .where(date ? eq(records.date, date) : sql`1=1`)
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    const recordsWithCompletions: RecordWithRelations[] = [];
    
    for (const r of result.filter((r) => r.services)) {
      const completions = await this.getRecordCompletions(r.records.id);
      recordsWithCompletions.push({
        ...r.records,
        client: r.clients || undefined,
        service: r.services!,
        employee: r.users || undefined,
        completions,
      });
    }

    return recordsWithCompletions;
  }
}

export const storage = new DatabaseStorage();
