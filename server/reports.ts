import ExcelJS from "exceljs";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import { storage } from "./storage";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

const CURRENCY = "с.";

interface CompletionDetail {
  employeeId: string;
  employeeName: string;
  patientCount: number;
  serviceName: string;
  servicePrice: number;
  recordDate: string;
  recordTime: string;
}

interface ReportData {
  records: any[];
  incomes: any[];
  expenses: any[];
  analytics: {
    totalIncome: number;
    totalExpense: number;
    result: number;
    uniqueClients: number;
  };
  period: {
    start: string;
    end: string;
    type: "day" | "month" | "year";
  };
  dailyIncome: Record<string, { total: number; items: any[] }>;
  dailyExpense: Record<string, { total: number; items: any[] }>;
  clientStats: { clientId: string; name: string; phone: string; total: number; count: number; patientCount: number }[];
  serviceStats: { serviceId: string; name: string; total: number; count: number; patientCount: number }[];
  employeeStats: { employeeId: string; name: string; total: number; patientCount: number; services: Record<string, { total: number; patientCount: number }> }[];
  completionDetails: CompletionDetail[];
}

async function getReportData(
  startDate: string,
  endDate: string,
  periodType: "day" | "month" | "year"
): Promise<ReportData> {
  const [analytics, incomeData, expenseData, records] = await Promise.all([
    storage.getMonthlyAnalytics(startDate, endDate),
    storage.getDetailedIncome(startDate, endDate),
    storage.getDetailedExpense(startDate, endDate),
    storage.getRecordsByDateRange(startDate, endDate),
  ]);

  const allIncomes: any[] = [];
  const dailyIncome: Record<string, { total: number; items: any[] }> = {};
  Object.entries(incomeData.byDate).forEach(([date, items]) => {
    dailyIncome[date] = { total: 0, items: [] };
    items.forEach((item: any) => {
      allIncomes.push({ ...item, date });
      dailyIncome[date].items.push(item);
      dailyIncome[date].total += item.amount;
    });
  });

  const allExpenses: any[] = [];
  const dailyExpense: Record<string, { total: number; items: any[] }> = {};
  Object.entries(expenseData.byDate).forEach(([date, items]) => {
    dailyExpense[date] = { total: 0, items: [] };
    items.forEach((item: any) => {
      allExpenses.push({ ...item, date });
      dailyExpense[date].items.push(item);
      dailyExpense[date].total += item.amount;
    });
  });

  const clientMap = new Map<string, { name: string; phone: string; total: number; count: number; patientCount: number }>();
  const serviceMap = new Map<string, { name: string; total: number; count: number; patientCount: number }>();
  const employeeMap = new Map<string, { name: string; total: number; patientCount: number; services: Record<string, { total: number; patientCount: number }> }>();
  const completionDetails: CompletionDetail[] = [];

  records.forEach((record: any) => {
    if (record.status === "done" && record.service?.price) {
      const price = record.service.price;
      const patientCount = record.patientCount || 1;
      const recordTotal = price * patientCount;

      if (record.clientId && record.client) {
        const existing = clientMap.get(record.clientId);
        if (existing) {
          existing.total += recordTotal;
          existing.count += 1;
          existing.patientCount += patientCount;
        } else {
          clientMap.set(record.clientId, {
            name: record.client.fullName,
            phone: record.client.phone || "",
            total: recordTotal,
            count: 1,
            patientCount: patientCount,
          });
        }
      }

      if (record.serviceId && record.service) {
        const existing = serviceMap.get(record.serviceId);
        if (existing) {
          existing.total += recordTotal;
          existing.count += 1;
          existing.patientCount += patientCount;
        } else {
          serviceMap.set(record.serviceId, {
            name: record.service.name,
            total: recordTotal,
            count: 1,
            patientCount: patientCount,
          });
        }
      }

      if (record.completions && record.completions.length > 0) {
        record.completions.forEach((completion: any) => {
          const employeeId = completion.employeeId;
          const employeeName = completion.employee?.fullName || "Неизвестно";
          const completionPatientCount = completion.patientCount || 1;
          const completionTotal = price * completionPatientCount;
          const serviceName = record.service?.name || "Неизвестно";

          completionDetails.push({
            employeeId,
            employeeName,
            patientCount: completionPatientCount,
            serviceName,
            servicePrice: price,
            recordDate: record.date,
            recordTime: record.time,
          });

          const existing = employeeMap.get(employeeId);
          if (existing) {
            existing.total += completionTotal;
            existing.patientCount += completionPatientCount;
            if (existing.services[serviceName]) {
              existing.services[serviceName].total += completionTotal;
              existing.services[serviceName].patientCount += completionPatientCount;
            } else {
              existing.services[serviceName] = { total: completionTotal, patientCount: completionPatientCount };
            }
          } else {
            employeeMap.set(employeeId, {
              name: employeeName,
              total: completionTotal,
              patientCount: completionPatientCount,
              services: { [serviceName]: { total: completionTotal, patientCount: completionPatientCount } },
            });
          }
        });
      }
    }
  });

  const clientStats = Array.from(clientMap.entries())
    .map(([clientId, data]) => ({ clientId, ...data }))
    .sort((a, b) => b.total - a.total);

  const serviceStats = Array.from(serviceMap.entries())
    .map(([serviceId, data]) => ({ serviceId, ...data }))
    .sort((a, b) => b.total - a.total);

  const employeeStats = Array.from(employeeMap.entries())
    .map(([employeeId, data]) => ({ employeeId, ...data }))
    .sort((a, b) => b.total - a.total);

  return {
    records,
    incomes: allIncomes,
    expenses: allExpenses,
    analytics: {
      totalIncome: analytics.totalIncome,
      totalExpense: analytics.totalExpense,
      result: analytics.result,
      uniqueClients: analytics.uniqueClients,
    },
    period: {
      start: startDate,
      end: endDate,
      type: periodType,
    },
    dailyIncome,
    dailyExpense,
    clientStats,
    serviceStats,
    employeeStats,
    completionDetails,
  };
}

function formatPeriodTitle(data: ReportData): string {
  const start = parseISO(data.period.start);
  if (data.period.type === "day") {
    return format(start, "d MMMM yyyy", { locale: ru });
  } else if (data.period.type === "month") {
    return format(start, "LLLL yyyy", { locale: ru });
  } else {
    return format(start, "yyyy") + " год";
  }
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ${CURRENCY}`;
}

export async function generateExcelReport(
  startDate: string,
  endDate: string,
  periodType: "day" | "month" | "year"
): Promise<Buffer> {
  const data = await getReportData(startDate, endDate, periodType);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM System";
  workbook.created = new Date();

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const subHeaderStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const cellStyle: Partial<ExcelJS.Style> = {
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
    alignment: { vertical: "middle" },
  };

  const totalRowStyle: Partial<ExcelJS.Style> = {
    font: { bold: true },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const summarySheet = workbook.addWorksheet("Сводка");
  summarySheet.columns = [
    { header: "Показатель", key: "metric", width: 30 },
    { header: "Значение", key: "value", width: 25 },
  ];

  summarySheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  const periodTitle = formatPeriodTitle(data);
  const completedRecords = data.records.filter(r => r.status === "done");
  const totalPatients = completedRecords.reduce((sum, r) => sum + (r.patientCount || 1), 0);

  summarySheet.addRow({ metric: "Период", value: periodTitle });
  summarySheet.addRow({ metric: "Общий доход", value: formatMoney(data.analytics.totalIncome) });
  summarySheet.addRow({ metric: "Общий расход", value: formatMoney(data.analytics.totalExpense) });
  summarySheet.addRow({ metric: "Итог (прибыль)", value: formatMoney(data.analytics.result) });
  summarySheet.addRow({ metric: "Уникальных клиентов", value: data.analytics.uniqueClients });
  summarySheet.addRow({ metric: "Всего записей", value: data.records.length });
  summarySheet.addRow({ metric: "Всего пациентов обслужено", value: totalPatients });

  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        Object.assign(cell, cellStyle);
      });
    }
  });

  const statusMap: Record<string, string> = {
    pending: "Ожидает",
    confirmed: "Подтверждено",
    done: "Выполнено",
    cancelled: "Отменено",
  };

  if (data.records.length > 0) {
    const recordsSheet = workbook.addWorksheet("Записи");
    recordsSheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Время", key: "time", width: 10 },
      { header: "Клиент", key: "client", width: 25 },
      { header: "Телефон", key: "phone", width: 15 },
      { header: "Услуга", key: "service", width: 25 },
      { header: "Цена услуги", key: "price", width: 12 },
      { header: "Кол-во пациентов", key: "patientCount", width: 18 },
      { header: "Итого сумма", key: "total", width: 15 },
      { header: "Сотрудники", key: "employees", width: 30 },
      { header: "Статус", key: "status", width: 15 },
    ];

    recordsSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.records.forEach((record) => {
      const employees = record.completions && record.completions.length > 0
        ? record.completions.map((c: any) => c.employee?.fullName || "").filter(Boolean).join(", ")
        : "-";
      const patientCount = record.patientCount || 1;
      const total = record.service?.price ? record.service.price * patientCount : 0;

      recordsSheet.addRow({
        date: format(parseISO(record.date), "dd.MM.yyyy"),
        time: record.time,
        client: record.client?.fullName || "-",
        phone: record.client?.phone || "-",
        service: record.service?.name || "-",
        price: record.service?.price ? formatMoney(record.service.price) : "-",
        patientCount: patientCount,
        total: total > 0 ? formatMoney(total) : "-",
        employees: employees,
        status: statusMap[record.status] || record.status,
      });
    });

    recordsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          Object.assign(cell, cellStyle);
        });
      }
    });
  }

  const incomesSheet = workbook.addWorksheet("Доходы по дням");
  incomesSheet.columns = [
    { header: "Дата", key: "date", width: 14 },
    { header: "Описание", key: "name", width: 35 },
    { header: "Сотрудники", key: "employees", width: 25 },
    { header: "Сумма", key: "amount", width: 15 },
  ];

  incomesSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  const sortedDates = Object.keys(data.dailyIncome).sort();
  sortedDates.forEach((date) => {
    const dayData = data.dailyIncome[date];
    const dateRow = incomesSheet.addRow({
      date: format(parseISO(date), "dd.MM.yyyy"),
      name: format(parseISO(date), "EEEE", { locale: ru }),
      employees: "",
      amount: formatMoney(dayData.total),
    });
    dateRow.eachCell((cell) => {
      Object.assign(cell, subHeaderStyle);
    });

    dayData.items.forEach((item) => {
      incomesSheet.addRow({
        date: item.time || "",
        name: item.name,
        employees: item.employeeName || "-",
        amount: formatMoney(item.amount),
      });
    });
  });

  const totalIncomeRow = incomesSheet.addRow({
    date: "",
    name: "ИТОГО",
    employees: "",
    amount: formatMoney(data.analytics.totalIncome),
  });
  totalIncomeRow.eachCell((cell) => {
    Object.assign(cell, totalRowStyle);
  });

  incomesSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
          Object.assign(cell, cellStyle);
        }
      });
    }
  });

  const expensesSheet = workbook.addWorksheet("Расходы по дням");
  expensesSheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Название", key: "name", width: 40 },
    { header: "Сумма", key: "amount", width: 15 },
  ];

  expensesSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  const sortedExpenseDates = Object.keys(data.dailyExpense).sort();
  sortedExpenseDates.forEach((date) => {
    const dayData = data.dailyExpense[date];
    const dateRow = expensesSheet.addRow({
      date: format(parseISO(date), "dd.MM.yyyy"),
      name: `День: ${format(parseISO(date), "EEEE", { locale: ru })}`,
      amount: formatMoney(dayData.total),
    });
    dateRow.eachCell((cell) => {
      Object.assign(cell, subHeaderStyle);
    });

    dayData.items.forEach((item) => {
      expensesSheet.addRow({
        date: "",
        name: item.name,
        amount: formatMoney(item.amount),
      });
    });
  });

  const totalExpenseRow = expensesSheet.addRow({
    date: "",
    name: "ИТОГО",
    amount: formatMoney(data.analytics.totalExpense),
  });
  totalExpenseRow.eachCell((cell) => {
    Object.assign(cell, totalRowStyle);
  });

  expensesSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
          Object.assign(cell, cellStyle);
        }
      });
    }
  });

  if (data.serviceStats.length > 0) {
    const servicesSheet = workbook.addWorksheet("Статистика по услугам");
    servicesSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Услуга", key: "name", width: 35 },
      { header: "Записей", key: "count", width: 12 },
      { header: "Пациентов", key: "patientCount", width: 12 },
      { header: "Сумма дохода", key: "total", width: 18 },
    ];

    servicesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    let totalServiceIncome = 0;
    let totalPatientCount = 0;
    data.serviceStats.forEach((service, index) => {
      totalServiceIncome += service.total;
      totalPatientCount += service.patientCount;
      servicesSheet.addRow({
        rank: index + 1,
        name: service.name,
        count: service.count,
        patientCount: service.patientCount,
        total: formatMoney(service.total),
      });
    });

    const totalServiceRow = servicesSheet.addRow({
      rank: "",
      name: "ИТОГО",
      count: data.serviceStats.reduce((sum, s) => sum + s.count, 0),
      patientCount: totalPatientCount,
      total: formatMoney(totalServiceIncome),
    });
    totalServiceRow.eachCell((cell) => {
      Object.assign(cell, totalRowStyle);
    });

    servicesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
            Object.assign(cell, cellStyle);
          }
        });
      }
    });
  }

  if (data.clientStats.length > 0) {
    const clientsSheet = workbook.addWorksheet("Статистика по клиентам");
    clientsSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Клиент", key: "name", width: 25 },
      { header: "Телефон", key: "phone", width: 15 },
      { header: "Записей", key: "count", width: 12 },
      { header: "Пациентов", key: "patientCount", width: 12 },
      { header: "Сумма", key: "total", width: 18 },
    ];

    clientsSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.clientStats.forEach((client, index) => {
      clientsSheet.addRow({
        rank: index + 1,
        name: client.name,
        phone: client.phone || "-",
        count: client.count,
        patientCount: client.patientCount,
        total: formatMoney(client.total),
      });
    });

    clientsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          Object.assign(cell, cellStyle);
        });
      }
    });
  }

  if (data.employeeStats.length > 0) {
    const employeesSheet = workbook.addWorksheet("Статистика по сотрудникам");
    employeesSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Сотрудник", key: "name", width: 25 },
      { header: "Пациентов обслужено", key: "patientCount", width: 22 },
    ];

    employeesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    let totalEmployeePatients = 0;
    data.employeeStats.forEach((employee, index) => {
      totalEmployeePatients += employee.patientCount;
      employeesSheet.addRow({
        rank: index + 1,
        name: employee.name,
        patientCount: employee.patientCount,
      });
    });

    const totalEmployeeRow = employeesSheet.addRow({
      rank: "",
      name: "ИТОГО",
      patientCount: totalEmployeePatients,
    });
    totalEmployeeRow.eachCell((cell) => {
      Object.assign(cell, totalRowStyle);
    });

    employeesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
            Object.assign(cell, cellStyle);
          }
        });
      }
    });

    const detailSheet = workbook.addWorksheet("Детализация по сотрудникам");
    detailSheet.columns = [
      { header: "Сотрудник", key: "employee", width: 25 },
      { header: "Услуга", key: "service", width: 30 },
      { header: "Пациентов", key: "patientCount", width: 15 },
    ];

    detailSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.employeeStats.forEach((employee) => {
      const employeeHeaderRow = detailSheet.addRow({
        employee: employee.name,
        service: "",
        patientCount: employee.patientCount,
      });
      employeeHeaderRow.eachCell((cell) => {
        Object.assign(cell, subHeaderStyle);
      });

      Object.entries(employee.services).forEach(([serviceName, stats]) => {
        detailSheet.addRow({
          employee: "",
          service: serviceName,
          patientCount: stats.patientCount,
        });
      });
    });

    detailSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
            Object.assign(cell, cellStyle);
          }
        });
      }
    });
  }

  if (data.completionDetails.length > 0) {
    const completionsSheet = workbook.addWorksheet("Выполнение услуг");
    completionsSheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Время", key: "time", width: 10 },
      { header: "Сотрудник", key: "employee", width: 25 },
      { header: "Услуга", key: "service", width: 30 },
      { header: "Пациентов", key: "patientCount", width: 12 },
      { header: "Цена за пациента", key: "price", width: 18 },
      { header: "Сумма", key: "total", width: 15 },
    ];

    completionsSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.completionDetails
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.recordTime.localeCompare(b.recordTime))
      .forEach((detail) => {
        completionsSheet.addRow({
          date: format(parseISO(detail.recordDate), "dd.MM.yyyy"),
          time: detail.recordTime,
          employee: detail.employeeName,
          service: detail.serviceName,
          patientCount: detail.patientCount,
          price: formatMoney(detail.servicePrice),
          total: formatMoney(detail.servicePrice * detail.patientCount),
        });
      });

    const totalCompletionPatients = data.completionDetails.reduce((sum, d) => sum + d.patientCount, 0);
    const totalCompletionIncome = data.completionDetails.reduce((sum, d) => sum + d.servicePrice * d.patientCount, 0);
    const totalCompletionRow = completionsSheet.addRow({
      date: "",
      time: "",
      employee: "ИТОГО",
      service: "",
      patientCount: totalCompletionPatients,
      price: "",
      total: formatMoney(totalCompletionIncome),
    });
    totalCompletionRow.eachCell((cell) => {
      Object.assign(cell, totalRowStyle);
    });

    completionsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          if (!cell.style.fill || (cell.style.fill as any).fgColor?.argb === undefined) {
            Object.assign(cell, cellStyle);
          }
        });
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateWordReport(
  startDate: string,
  endDate: string,
  periodType: "day" | "month" | "year"
): Promise<Buffer> {
  const data = await getReportData(startDate, endDate, periodType);
  const periodTitle = formatPeriodTitle(data);

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: "000000",
  };

  const tableBorders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
    insideHorizontal: borderStyle,
    insideVertical: borderStyle,
  };

  const sections: any[] = [];
  const completedRecords = data.records.filter(r => r.status === "done");
  const totalPatients = completedRecords.reduce((sum, r) => sum + (r.patientCount || 1), 0);

  sections.push(
    new Paragraph({
      text: "Отчёт CRM",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Период: ${periodTitle}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: "Общая статистика",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 200 },
    })
  );

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "Общий доход", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: formatMoney(data.analytics.totalIncome), alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Общий расход", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            children: [new Paragraph({ text: formatMoney(data.analytics.totalExpense), alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Итог (прибыль)", bold: true })] })],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: formatMoney(data.analytics.result), bold: true })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Уникальных клиентов", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            children: [new Paragraph({ text: String(data.analytics.uniqueClients), alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Всего записей", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            children: [new Paragraph({ text: String(data.records.length), alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Всего пациентов обслужено", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            children: [new Paragraph({ text: String(totalPatients), alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
    ],
  });

  sections.push(summaryTable);

  if (data.records.length > 0) {
    sections.push(
      new Paragraph({
        text: "Записи",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const statusMap: Record<string, string> = {
      pending: "Ожидает",
      confirmed: "Подтверждено",
      done: "Выполнено",
      cancelled: "Отменено",
    };

    const recordsHeader = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Время", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Клиент", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Цена", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Пац.", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Итого", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сотрудники", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
      ],
    });

    const recordRows = data.records.map((record) => {
      const patientCount = record.patientCount || 1;
      const total = record.service?.price ? record.service.price * patientCount : 0;
      const employees = record.completions && record.completions.length > 0
        ? record.completions.map((c: any) => c.employee?.fullName || "").filter(Boolean).join(", ")
        : "-";
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: format(parseISO(record.date), "dd.MM.yyyy") })] }),
          new TableCell({ children: [new Paragraph({ text: record.time || "-" })] }),
          new TableCell({ children: [new Paragraph({ text: record.client?.fullName || "-" })] }),
          new TableCell({ children: [new Paragraph({ text: record.service?.name || "-" })] }),
          new TableCell({ children: [new Paragraph({ text: record.service?.price ? formatMoney(record.service.price) : "-" })] }),
          new TableCell({ children: [new Paragraph({ text: String(patientCount) })] }),
          new TableCell({ children: [new Paragraph({ text: total > 0 ? formatMoney(total) : "-" })] }),
          new TableCell({ children: [new Paragraph({ text: employees })] }),
          new TableCell({ children: [new Paragraph({ text: statusMap[record.status] || record.status })] }),
        ],
      });
    });

    const recordsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [recordsHeader, ...recordRows],
    });

    sections.push(recordsTable);
  }

  sections.push(
    new Paragraph({
      text: "Доходы по дням",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    })
  );

  const sortedIncomeDates = Object.keys(data.dailyIncome).sort();
  if (sortedIncomeDates.length > 0) {
    const incomeRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сотрудники", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        ],
      }),
    ];

    sortedIncomeDates.forEach((date) => {
      const dayData = data.dailyIncome[date];
      incomeRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: format(parseISO(date), "dd.MM.yyyy"), bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: format(parseISO(date), "EEEE", { locale: ru }), bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ text: "" })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(dayData.total), bold: true })] })] }),
          ],
        })
      );
      dayData.items.forEach((item) => {
        incomeRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: item.time || "" })] }),
              new TableCell({ children: [new Paragraph({ text: item.name })] }),
              new TableCell({ children: [new Paragraph({ text: item.employeeName || "-" })] }),
              new TableCell({ children: [new Paragraph({ text: formatMoney(item.amount) })] }),
            ],
          })
        );
      });
    });

    incomeRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(data.analytics.totalIncome), bold: true })] })] }),
        ],
      })
    );

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: incomeRows,
      })
    );
  } else {
    sections.push(new Paragraph({ text: "Нет данных о доходах за выбранный период." }));
  }

  sections.push(
    new Paragraph({
      text: "Расходы по дням",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    })
  );

  const sortedExpenseDates = Object.keys(data.dailyExpense).sort();
  if (sortedExpenseDates.length > 0) {
    const expenseRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Описание", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        ],
      }),
    ];

    sortedExpenseDates.forEach((date) => {
      const dayData = data.dailyExpense[date];
      expenseRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: format(parseISO(date), "dd.MM.yyyy"), bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: format(parseISO(date), "EEEE", { locale: ru }), bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(dayData.total), bold: true })] })] }),
          ],
        })
      );
      dayData.items.forEach((item) => {
        expenseRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: "" })] }),
              new TableCell({ children: [new Paragraph({ text: item.name })] }),
              new TableCell({ children: [new Paragraph({ text: formatMoney(item.amount) })] }),
            ],
          })
        );
      });
    });

    expenseRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(data.analytics.totalExpense), bold: true })] })] }),
        ],
      })
    );

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: expenseRows,
      })
    );
  } else {
    sections.push(new Paragraph({ text: "Нет данных о расходах за выбранный период." }));
  }

  if (data.serviceStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "Статистика по услугам",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const serviceRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Записей", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Пациентов", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        ],
      }),
    ];

    data.serviceStats.forEach((service, index) => {
      serviceRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(index + 1) })] }),
            new TableCell({ children: [new Paragraph({ text: service.name })] }),
            new TableCell({ children: [new Paragraph({ text: String(service.count) })] }),
            new TableCell({ children: [new Paragraph({ text: String(service.patientCount) })] }),
            new TableCell({ children: [new Paragraph({ text: formatMoney(service.total) })] }),
          ],
        })
      );
    });

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: serviceRows,
      })
    );
  }

  if (data.clientStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "Статистика по клиентам",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const clientRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Клиент", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Записей", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Пациентов", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        ],
      }),
    ];

    data.clientStats.forEach((client, index) => {
      clientRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: String(index + 1) })] }),
            new TableCell({ children: [new Paragraph({ text: client.name })] }),
            new TableCell({ children: [new Paragraph({ text: String(client.count) })] }),
            new TableCell({ children: [new Paragraph({ text: String(client.patientCount) })] }),
            new TableCell({ children: [new Paragraph({ text: formatMoney(client.total) })] }),
          ],
        })
      );
    });

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: clientRows,
      })
    );
  }

  if (data.employeeStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "Статистика по сотрудникам",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    data.employeeStats.forEach((employee, index) => {
      sections.push(
        new Paragraph({
          text: `${index + 1}. ${employee.name} (${employee.patientCount} пациентов)`,
          spacing: { before: 100, after: 50 },
        })
      );

      const serviceRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Пациентов", bold: true })] })] }),
          ],
        }),
      ];

      Object.entries(employee.services).forEach(([serviceName, stats]) => {
        serviceRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: serviceName })] }),
              new TableCell({ children: [new Paragraph({ text: String(stats.patientCount) })] }),
            ],
          })
        );
      });

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: serviceRows,
        })
      );
    });
  }

  if (data.completionDetails.length > 0) {
    sections.push(
      new Paragraph({
        text: "Выполнение услуг (детализация)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const completionRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Время", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сотрудник", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Пац.", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        ],
      }),
    ];

    data.completionDetails
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.recordTime.localeCompare(b.recordTime))
      .forEach((detail) => {
        completionRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: format(parseISO(detail.recordDate), "dd.MM.yyyy") })] }),
              new TableCell({ children: [new Paragraph({ text: detail.recordTime })] }),
              new TableCell({ children: [new Paragraph({ text: detail.employeeName })] }),
              new TableCell({ children: [new Paragraph({ text: detail.serviceName })] }),
              new TableCell({ children: [new Paragraph({ text: String(detail.patientCount) })] }),
              new TableCell({ children: [new Paragraph({ text: formatMoney(detail.servicePrice * detail.patientCount) })] }),
            ],
          })
        );
      });

    const totalCompletionPatients = data.completionDetails.reduce((sum, d) => sum + d.patientCount, 0);
    const totalCompletionIncome = data.completionDetails.reduce((sum, d) => sum + d.servicePrice * d.patientCount, 0);
    completionRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(totalCompletionPatients), bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totalCompletionIncome), bold: true })] })] }),
        ],
      })
    );

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: completionRows,
      })
    );
  }

  sections.push(
    new Paragraph({
      text: `Отчёт сформирован: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: ru })}`,
      spacing: { before: 400 },
      alignment: AlignmentType.RIGHT,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
