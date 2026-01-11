import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, User, TrendingUp, Calendar, DollarSign, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmployeeAnalytics {
  employee: { id: string; fullName: string };
  dailyStats: { date: string; revenue: number; completedServices: number }[];
  totalRevenue: number;
  totalServices: number;
}

export default function EmployeeAnalyticsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: analytics, isLoading, error } = useQuery<EmployeeAnalytics>({
    queryKey: ["/api/analytics/employees", id],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6">
        <Link href="/employees">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Сотрудник не найден</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/employees">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-employee-analytics-title">
            <User className="h-6 w-6" />
            {analytics.employee.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">Аналитика сотрудника</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Общий доход</p>
                <p className="text-2xl font-bold text-green-600">{analytics.totalRevenue} сомони</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего услуг</p>
                <p className="text-2xl font-bold">{analytics.totalServices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Средний чек</p>
                <p className="text-2xl font-bold">
                  {analytics.totalServices > 0
                    ? Math.round(analytics.totalRevenue / analytics.totalServices)
                    : 0} сомони
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Доходы по дням
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.dailyStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p>Нет данных о выполненных услугах</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-center">Услуг</TableHead>
                    <TableHead className="text-right">Доход</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.dailyStats.map((day) => (
                    <TableRow key={day.date} data-testid={`row-${day.date}`}>
                      <TableCell>
                        <Link href={`/day/${day.date}`}>
                          <span className="text-primary hover:underline cursor-pointer">
                            {format(parseISO(day.date), "d MMMM yyyy", { locale: ru })}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">{day.completedServices}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{day.revenue} сомони
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
