import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, startOfYear, endOfYear, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Users, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface MonthlyAnalytics {
  totalIncome: number;
  totalExpense: number;
  result: number;
  uniqueClients: number;
  employeeStats: {
    id: string;
    fullName: string;
    completedServices: number;
    revenue: number;
  }[];
}

export default function AnalyticsPage() {
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<"day" | "month" | "year">("month");
  const [exportFormat, setExportFormat] = useState<"excel" | "word">("excel");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: analytics, isLoading } = useQuery<MonthlyAnalytics>({
    queryKey: ["/api/analytics/month", { start: monthStart, end: monthEnd }],
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let start: string, end: string;
      
      if (exportPeriod === "day") {
        const dayStr = format(currentMonth, "yyyy-MM-dd");
        start = dayStr;
        end = dayStr;
      } else if (exportPeriod === "month") {
        start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      } else {
        start = format(startOfYear(currentMonth), "yyyy-MM-dd");
        end = format(endOfYear(currentMonth), "yyyy-MM-dd");
      }

      const endpoint = exportFormat === "excel" ? "/api/reports/excel" : "/api/reports/word";
      const response = await fetch(`${endpoint}?start=${start}&end=${end}&period=${exportPeriod}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFormat === "excel" 
        ? `report_${start}_${end}.xlsx` 
        : `report_${start}_${end}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Отчёт скачан" });
      setIsExportDialogOpen(false);
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось скачать отчёт", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-analytics-title">Аналитика</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-export-report">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Скачать отчёт</span>
                <span className="sm:hidden">Скачать</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Скачать отчёт</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Период</Label>
                  <Select value={exportPeriod} onValueChange={(v) => setExportPeriod(v as any)}>
                    <SelectTrigger data-testid="select-export-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Текущий день ({format(currentMonth, "d MMMM yyyy", { locale: ru })})</SelectItem>
                      <SelectItem value="month">Текущий месяц ({format(currentMonth, "LLLL yyyy", { locale: ru })})</SelectItem>
                      <SelectItem value="year">Текущий год ({format(currentMonth, "yyyy")})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Формат</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={exportFormat === "excel" ? "default" : "outline"}
                      className="flex items-center gap-2"
                      onClick={() => setExportFormat("excel")}
                      data-testid="button-format-excel"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel
                    </Button>
                    <Button
                      type="button"
                      variant={exportFormat === "word" ? "default" : "outline"}
                      className="flex items-center gap-2"
                      onClick={() => setExportFormat("word")}
                      data-testid="button-format-word"
                    >
                      <FileText className="h-4 w-4" />
                      Word
                    </Button>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleExport}
                  disabled={isExporting}
                  data-testid="button-download-report"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Формирование...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Скачать
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[120px] sm:w-40 text-center text-sm sm:text-base font-medium capitalize">
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => setLocation("/analytics/income")}
              data-testid="card-total-income"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Общий доход</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{analytics?.totalIncome || 0}</p>
                    <p className="text-xs text-muted-foreground">с</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => setLocation("/analytics/expense")}
              data-testid="card-total-expense"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                    <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Общий расход</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{analytics?.totalExpense || 0}</p>
                    <p className="text-xs text-muted-foreground">с</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-month-result">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Итог месяца</p>
                    <p className={`text-xl sm:text-2xl font-bold ${(analytics?.result || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(analytics?.result || 0) >= 0 ? "+" : ""}{analytics?.result || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">с</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover-elevate" 
              onClick={() => setLocation("/analytics/clients")}
              data-testid="card-clients"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Клиентов</p>
                    <p className="text-xl sm:text-2xl font-bold">{analytics?.uniqueClients || 0}</p>
                    <p className="text-xs text-muted-foreground">уникальных</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
