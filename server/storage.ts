import {
  users, clients, services, records, incomes, expenses,
  type User, type InsertUser,
  type Client, type InsertClient,
  type Service, type InsertService,
  type Record as RecordType, type InsertRecord,
  type Income, type InsertIncome,
  type Expense, type InsertExpense,
  type RecordWithRelations,
  type IncomeWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByLogin(login: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
  getRecordsByClientId(clientId: string): Promise<RecordWithRelations[]>;
  getRecordsByEmployeeId(employeeId: string, date?: string): Promise<RecordWithRelations[]>;
  getRecordCountsByMonth(year: number, month: number): Promise<Record<string, number>>;
  getEarningsByMonth(year: number, month: number): Promise<Record<string, number>>;
  createRecord(record: InsertRecord): Promise<RecordType>;
  updateRecord(id: string, record: Partial<InsertRecord>): Promise<RecordType | undefined>;
  deleteRecord(id: string): Promise<void>;
  
  getIncomesByDate(date: string): Promise<IncomeWithRelations[]>;
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
  
  getEmployeeDailyAnalytics(employeeId: string): Promise<{
    employee: { id: string; fullName: string };
    dailyStats: { date: string; revenue: number; completedServices: number }[];
    totalRevenue: number;
    totalServices: number;
  }>;
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
    
    if (result.length === 0 || !result[0].clients || !result[0].services || !result[0].users) {
      return undefined;
    }

    return {
      ...result[0].records,
      client: result[0].clients,
      service: result[0].services,
      employee: result[0].users,
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
    
    return result
      .filter((r) => r.clients && r.services && r.users)
      .map((r) => ({
        ...r.records,
        client: r.clients!,
        service: r.services!,
        employee: r.users!,
      }));
  }

  async getRecordsByClientId(clientId: string): Promise<RecordWithRelations[]> {
    const result = await db
      .select()
      .from(records)
      .where(eq(records.clientId, clientId))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    return result
      .filter((r) => r.clients && r.services && r.users)
      .map((r) => ({
        ...r.records,
        client: r.clients!,
        service: r.services!,
        employee: r.users!,
      }));
  }

  async getRecordsByEmployeeId(employeeId: string, date?: string): Promise<RecordWithRelations[]> {
    const conditions = [eq(records.employeeId, employeeId)];
    if (date) {
      conditions.push(eq(records.date, date));
    }

    const result = await db
      .select()
      .from(records)
      .where(and(...conditions))
      .leftJoin(clients, eq(records.clientId, clients.id))
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));
    
    return result
      .filter((r) => r.clients && r.services && r.users)
      .map((r) => ({
        ...r.records,
        client: r.clients!,
        service: r.services!,
        employee: r.users!,
      }));
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
      .leftJoin(services, eq(records.serviceId, services.id))
      .leftJoin(users, eq(records.employeeId, users.id));

    const totalIncome = monthIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const uniqueClientIds = new Set(
      completedRecords.map((r) => r.records.clientId)
    );

    const employeeMap = new Map<string, { fullName: string; completedServices: number; revenue: number }>();
    for (const row of completedRecords) {
      if (row.users && row.services) {
        const existing = employeeMap.get(row.users.id) || {
          fullName: row.users.fullName,
          completedServices: 0,
          revenue: 0,
        };
        existing.completedServices += 1;
        existing.revenue += row.services.price;
        employeeMap.set(row.users.id, existing);
      }
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

  async getEmployeeDailyAnalytics(employeeId: string) {
    const employee = await this.getUser(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    const completedRecords = await db
      .select({
        date: records.date,
        price: services.price,
      })
      .from(records)
      .leftJoin(services, eq(records.serviceId, services.id))
      .where(
        and(
          eq(records.employeeId, employeeId),
          eq(records.status, "done")
        )
      );

    const dailyMap = new Map<string, { revenue: number; completedServices: number }>();
    let totalRevenue = 0;
    let totalServices = 0;

    for (const row of completedRecords) {
      const existing = dailyMap.get(row.date) || { revenue: 0, completedServices: 0 };
      existing.revenue += row.price || 0;
      existing.completedServices += 1;
      dailyMap.set(row.date, existing);
      totalRevenue += row.price || 0;
      totalServices += 1;
    }

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      employee: { id: employee.id, fullName: employee.fullName },
      dailyStats,
      totalRevenue,
      totalServices,
    };
  }
}

export const storage = new DatabaseStorage();
