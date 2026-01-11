import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Users, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: analytics, isLoading } = useQuery<MonthlyAnalytics>({
    queryKey: ["/api/analytics/month", { start: monthStart, end: monthEnd }],
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-analytics-title">Аналитика</h1>
        <div className="flex items-center gap-2">
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
            <Card>
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
            <Card>
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
            <Card>
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
            <Card>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Статистика по сотрудникам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!analytics?.employeeStats || analytics.employeeStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <UserCog className="h-12 w-12 mb-4 opacity-50" />
                  <p>Нет данных за этот месяц</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ФИО</TableHead>
                      <TableHead className="text-right">Выполнено услуг</TableHead>
                      <TableHead className="text-right">Принесенный доход</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.employeeStats.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.fullName}</TableCell>
                        <TableCell className="text-right">{employee.completedServices}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {employee.revenue} с
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
