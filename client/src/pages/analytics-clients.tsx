import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Users, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface ClientStat {
  client: {
    id: string;
    fullName: string;
    phone: string | null;
  };
  totalSpent: number;
  servicesCount: number;
}

interface DetailedClientsData {
  clientStats: ClientStat[];
  totalFromClients: number;
  uniqueClients: number;
}

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#EF4444"];

export default function AnalyticsClientsPage() {
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data, isLoading } = useQuery<DetailedClientsData>({
    queryKey: ["/api/analytics/clients", { start: monthStart, end: monthEnd }],
  });

  const chartData = data?.clientStats.slice(0, 10).map((stat) => ({
    name: stat.client.fullName.length > 15 
      ? stat.client.fullName.substring(0, 15) + "..." 
      : stat.client.fullName,
    value: stat.totalSpent,
  })) || [];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/analytics")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-600" data-testid="text-clients-title">
            Клиенты
          </h1>
        </div>
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
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Уникальных клиентов</p>
                    <p className="text-3xl font-bold">{data?.uniqueClients || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Общий доход от клиентов</p>
                    <p className="text-3xl font-bold text-green-600">{data?.totalFromClients || 0} с</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Топ клиентов по доходу</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <XAxis type="number" tickFormatter={(value) => `${value} с`} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value: number) => `${value} с`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Все клиенты за месяц</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.clientStats || data.clientStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>Нет данных за этот месяц</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.clientStats.map((stat, index) => (
                    <div
                      key={stat.client.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/clients/${stat.client.id}`)}
                      data-testid={`client-stat-${stat.client.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{stat.client.fullName}</p>
                          {stat.client.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {stat.client.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{stat.totalSpent} с</p>
                        <p className="text-sm text-muted-foreground">{stat.servicesCount} услуг</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
