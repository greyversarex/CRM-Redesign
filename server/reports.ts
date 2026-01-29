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
  clientStats: { clientId: number; name: string; phone: string; total: number; count: number }[];
  serviceStats: { serviceId: number; name: string; total: number; count: number }[];
  employeeStats: { employeeId: number; name: string; total: number; count: number; services: Record<string, { total: number; count: number }> }[];
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

  const clientMap = new Map<number, { name: string; phone: string; total: number; count: number }>();
  const serviceMap = new Map<number, { name: string; total: number; count: number }>();
  const employeeMap = new Map<number, { name: string; total: number; count: number; services: Record<string, { total: number; count: number }> }>();

  records.forEach((record: any) => {
    if (record.status === "done" && record.service?.price) {
      const price = record.service.price;
      
      if (record.clientId && record.client) {
        const existing = clientMap.get(record.clientId);
        if (existing) {
          existing.total += price;
          existing.count += 1;
        } else {
          clientMap.set(record.clientId, {
            name: record.client.fullName,
            phone: record.client.phone || "",
            total: price,
            count: 1,
          });
        }
      }

      if (record.serviceId && record.service) {
        const existing = serviceMap.get(record.serviceId);
        if (existing) {
          existing.total += price;
          existing.count += 1;
        } else {
          serviceMap.set(record.serviceId, {
            name: record.service.name,
            total: price,
            count: 1,
          });
        }
      }

      if (record.employeeId && record.employee) {
        const existing = employeeMap.get(record.employeeId);
        const serviceName = record.service?.name || "Неизвестно";
        if (existing) {
          existing.total += price;
          existing.count += 1;
          if (existing.services[serviceName]) {
            existing.services[serviceName].total += price;
            existing.services[serviceName].count += 1;
          } else {
            existing.services[serviceName] = { total: price, count: 1 };
          }
        } else {
          employeeMap.set(record.employeeId, {
            name: record.employee.fullName,
            total: price,
            count: 1,
            services: { [serviceName]: { total: price, count: 1 } },
          });
        }
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

  const summarySheet = workbook.addWorksheet("Сводка");
  summarySheet.columns = [
    { header: "Показатель", key: "metric", width: 25 },
    { header: "Значение", key: "value", width: 20 },
  ];

  summarySheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  const periodTitle = formatPeriodTitle(data);
  summarySheet.addRow({ metric: "Период", value: periodTitle });
  summarySheet.addRow({ metric: "Общий доход", value: formatMoney(data.analytics.totalIncome) });
  summarySheet.addRow({ metric: "Общий расход", value: formatMoney(data.analytics.totalExpense) });
  summarySheet.addRow({ metric: "Итог", value: formatMoney(data.analytics.result) });
  summarySheet.addRow({ metric: "Уникальных клиентов", value: data.analytics.uniqueClients });
  summarySheet.addRow({ metric: "Всего записей", value: data.records.length });

  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        Object.assign(cell, cellStyle);
      });
    }
  });

  if (data.records.length > 0) {
    const recordsSheet = workbook.addWorksheet("Записи");
    recordsSheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Время", key: "time", width: 10 },
      { header: "Клиент", key: "client", width: 25 },
      { header: "Телефон", key: "phone", width: 15 },
      { header: "Услуга", key: "service", width: 25 },
      { header: "Сумма", key: "price", width: 12 },
      { header: "Сотрудник", key: "employee", width: 20 },
      { header: "Статус", key: "status", width: 15 },
    ];

    recordsSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    const statusMap: Record<string, string> = {
      pending: "Ожидает",
      confirmed: "Подтверждено",
      done: "Выполнено",
      cancelled: "Отменено",
    };

    data.records.forEach((record) => {
      recordsSheet.addRow({
        date: format(parseISO(record.date), "dd.MM.yyyy"),
        time: record.time,
        client: record.client?.fullName || "-",
        phone: record.client?.phone || "-",
        service: record.service?.name || "-",
        price: record.service?.price ? formatMoney(record.service.price) : "-",
        employee: record.employee?.fullName || "-",
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
    { header: "Дата", key: "date", width: 12 },
    { header: "Название", key: "name", width: 35 },
    { header: "Сумма", key: "amount", width: 15 },
    { header: "Источник", key: "source", width: 20 },
  ];

  incomesSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });

  const sortedDates = Object.keys(data.dailyIncome).sort();
  sortedDates.forEach((date) => {
    const dayData = data.dailyIncome[date];
    const dateRow = incomesSheet.addRow({
      date: format(parseISO(date), "dd.MM.yyyy"),
      name: `День: ${format(parseISO(date), "EEEE", { locale: ru })}`,
      amount: formatMoney(dayData.total),
      source: "",
    });
    dateRow.eachCell((cell) => {
      Object.assign(cell, subHeaderStyle);
    });

    dayData.items.forEach((item) => {
      incomesSheet.addRow({
        date: "",
        name: item.name,
        amount: formatMoney(item.amount),
        source: item.recordId ? "Из записи" : "Вручную",
      });
    });
  });

  const totalIncomeRow = incomesSheet.addRow({
    date: "",
    name: "ИТОГО",
    amount: formatMoney(data.analytics.totalIncome),
    source: "",
  });
  totalIncomeRow.font = { bold: true };

  incomesSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        if (!cell.style.fill) {
          Object.assign(cell, cellStyle);
        }
      });
    }
  });

  const expensesSheet = workbook.addWorksheet("Расходы по дням");
  expensesSheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Название", key: "name", width: 35 },
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
  totalExpenseRow.font = { bold: true };

  expensesSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        if (!cell.style.fill) {
          Object.assign(cell, cellStyle);
        }
      });
    }
  });

  if (data.clientStats.length > 0) {
    const clientsSheet = workbook.addWorksheet("Клиенты");
    clientsSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Клиент", key: "name", width: 25 },
      { header: "Телефон", key: "phone", width: 15 },
      { header: "Записей", key: "count", width: 10 },
      { header: "Сумма", key: "total", width: 15 },
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

  if (data.serviceStats.length > 0) {
    const servicesSheet = workbook.addWorksheet("ТОП услуг");
    servicesSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Услуга", key: "name", width: 35 },
      { header: "Кол-во", key: "count", width: 10 },
      { header: "Сумма", key: "total", width: 15 },
    ];

    servicesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.serviceStats.forEach((service, index) => {
      servicesSheet.addRow({
        rank: index + 1,
        name: service.name,
        count: service.count,
        total: formatMoney(service.total),
      });
    });

    servicesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          Object.assign(cell, cellStyle);
        });
      }
    });
  }

  if (data.employeeStats.length > 0) {
    const employeesSheet = workbook.addWorksheet("ТОП сотрудников");
    employeesSheet.columns = [
      { header: "#", key: "rank", width: 5 },
      { header: "Сотрудник", key: "name", width: 25 },
      { header: "Записей", key: "count", width: 10 },
      { header: "Сумма", key: "total", width: 15 },
      { header: "Услуги (подробно)", key: "services", width: 50 },
    ];

    employeesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.employeeStats.forEach((employee, index) => {
      const servicesDetail = Object.entries(employee.services)
        .map(([name, stats]) => `${name}: ${stats.count} шт. (${formatMoney(stats.total)})`)
        .join("; ");

      employeesSheet.addRow({
        rank: index + 1,
        name: employee.name,
        count: employee.count,
        total: formatMoney(employee.total),
        services: servicesDetail,
      });
    });

    employeesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          Object.assign(cell, cellStyle);
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
            children: [new Paragraph({ children: [new TextRun({ text: "Итог", bold: true })] })],
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
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Клиент", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Статус", bold: true })] })] }),
      ],
    });

    const recordRows = data.records.map(
      (record) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: format(parseISO(record.date), "dd.MM.yyyy") })] }),
            new TableCell({ children: [new Paragraph({ text: record.client?.fullName || "-" })] }),
            new TableCell({ children: [new Paragraph({ text: record.service?.name || "-" })] }),
            new TableCell({ children: [new Paragraph({ text: record.service?.price ? formatMoney(record.service.price) : "-" })] }),
            new TableCell({ children: [new Paragraph({ text: statusMap[record.status] || record.status })] }),
          ],
        })
    );

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
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(dayData.total), bold: true })] })] }),
          ],
        })
      );
      dayData.items.forEach((item) => {
        incomeRows.push(
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

    incomeRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
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

  if (data.clientStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "Клиенты",
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

  if (data.serviceStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "ТОП услуг",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const serviceRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Кол-во", bold: true })] })] }),
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

  if (data.employeeStats.length > 0) {
    sections.push(
      new Paragraph({
        text: "ТОП сотрудников",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    data.employeeStats.forEach((employee, index) => {
      sections.push(
        new Paragraph({
          text: `${index + 1}. ${employee.name} - ${formatMoney(employee.total)} (${employee.count} записей)`,
          spacing: { before: 100, after: 50 },
        })
      );

      const serviceRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Услуга", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Кол-во", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
          ],
        }),
      ];

      Object.entries(employee.services).forEach(([serviceName, stats]) => {
        serviceRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: serviceName })] }),
              new TableCell({ children: [new Paragraph({ text: String(stats.count) })] }),
              new TableCell({ children: [new Paragraph({ text: formatMoney(stats.total) })] }),
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
