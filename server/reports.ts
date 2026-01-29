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
  Object.entries(incomeData.byDate).forEach(([date, items]) => {
    items.forEach((item: any) => {
      allIncomes.push({ ...item, date });
    });
  });

  const allExpenses: any[] = [];
  Object.entries(expenseData.byDate).forEach(([date, items]) => {
    items.forEach((item: any) => {
      allExpenses.push({ ...item, date });
    });
  });

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
  summarySheet.addRow({ metric: "Общий доход", value: `${data.analytics.totalIncome.toLocaleString("ru-RU")} ₽` });
  summarySheet.addRow({ metric: "Общий расход", value: `${data.analytics.totalExpense.toLocaleString("ru-RU")} ₽` });
  summarySheet.addRow({ metric: "Итог", value: `${data.analytics.result.toLocaleString("ru-RU")} ₽` });
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
        price: record.service?.price ? `${record.service.price.toLocaleString("ru-RU")} ₽` : "-",
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

  if (data.incomes.length > 0) {
    const incomesSheet = workbook.addWorksheet("Доходы");
    incomesSheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Название", key: "name", width: 35 },
      { header: "Сумма", key: "amount", width: 15 },
      { header: "Источник", key: "source", width: 20 },
    ];

    incomesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.incomes.forEach((income) => {
      incomesSheet.addRow({
        date: format(parseISO(income.date), "dd.MM.yyyy"),
        name: income.name,
        amount: `${income.amount.toLocaleString("ru-RU")} ₽`,
        source: income.recordId ? "Из записи" : "Вручную",
      });
    });

    const totalRow = incomesSheet.addRow({
      date: "",
      name: "ИТОГО",
      amount: `${data.analytics.totalIncome.toLocaleString("ru-RU")} ₽`,
      source: "",
    });
    totalRow.font = { bold: true };

    incomesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          Object.assign(cell, cellStyle);
        });
      }
    });
  }

  if (data.expenses.length > 0) {
    const expensesSheet = workbook.addWorksheet("Расходы");
    expensesSheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Название", key: "name", width: 35 },
      { header: "Сумма", key: "amount", width: 15 },
    ];

    expensesSheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });

    data.expenses.forEach((expense) => {
      expensesSheet.addRow({
        date: format(parseISO(expense.date), "dd.MM.yyyy"),
        name: expense.name,
        amount: `${expense.amount.toLocaleString("ru-RU")} ₽`,
      });
    });

    const totalRow = expensesSheet.addRow({
      date: "",
      name: "ИТОГО",
      amount: `${data.analytics.totalExpense.toLocaleString("ru-RU")} ₽`,
    });
    totalRow.font = { bold: true };

    expensesSheet.eachRow((row, rowNumber) => {
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
            children: [new Paragraph({ text: `${data.analytics.totalIncome.toLocaleString("ru-RU")} ₽`, alignment: AlignmentType.RIGHT })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Общий расход", alignment: AlignmentType.LEFT })],
          }),
          new TableCell({
            children: [new Paragraph({ text: `${data.analytics.totalExpense.toLocaleString("ru-RU")} ₽`, alignment: AlignmentType.RIGHT })],
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
                children: [new TextRun({ text: `${data.analytics.result.toLocaleString("ru-RU")} ₽`, bold: true })],
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
            new TableCell({ children: [new Paragraph({ text: record.service?.price ? `${record.service.price.toLocaleString("ru-RU")} ₽` : "-" })] }),
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

  if (data.incomes.length > 0) {
    sections.push(
      new Paragraph({
        text: "Доходы",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const incomesHeader = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Название", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
      ],
    });

    const incomeRows = data.incomes.map(
      (income) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: format(parseISO(income.date), "dd.MM.yyyy") })] }),
            new TableCell({ children: [new Paragraph({ text: income.name })] }),
            new TableCell({ children: [new Paragraph({ text: `${income.amount.toLocaleString("ru-RU")} ₽` })] }),
          ],
        })
    );

    const totalIncomeRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "" })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.analytics.totalIncome.toLocaleString("ru-RU")} ₽`, bold: true })] })] }),
      ],
    });

    const incomesTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [incomesHeader, ...incomeRows, totalIncomeRow],
    });

    sections.push(incomesTable);
  }

  if (data.expenses.length > 0) {
    sections.push(
      new Paragraph({
        text: "Расходы",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    const expensesHeader = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Дата", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Название", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Сумма", bold: true })] })] }),
      ],
    });

    const expenseRows = data.expenses.map(
      (expense) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: format(parseISO(expense.date), "dd.MM.yyyy") })] }),
            new TableCell({ children: [new Paragraph({ text: expense.name })] }),
            new TableCell({ children: [new Paragraph({ text: `${expense.amount.toLocaleString("ru-RU")} ₽` })] }),
          ],
        })
    );

    const totalExpenseRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "" })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${data.analytics.totalExpense.toLocaleString("ru-RU")} ₽`, bold: true })] })] }),
      ],
    });

    const expensesTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [expensesHeader, ...expenseRows, totalExpenseRow],
    });

    sections.push(expensesTable);
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
