import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, User, Calendar, Users, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Service } from "@shared/schema";

interface EmployeeAnalytics {
  employee: { id: string; fullName: string };
  dailyStats: { 
    date: string; 
    clientsServed: number; 
    completedServices: number;
    serviceDetails: { serviceName: string; patientCount: number; time?: string }[];
  }[];
  totalClientsServed: number;
  totalServices: number;
}

export default function EmployeeAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedService, setSelectedService] = useState("");

  const filterParams: Record<string, string> = {};
  if (selectedDate) {
    filterParams.startDate = selectedDate;
    filterParams.endDate = selectedDate;
  }
  if (selectedService && selectedService !== "all") {
    filterParams.serviceId = selectedService;
  }

  const { data: analytics, isLoading, error } = useQuery<EmployeeAnalytics>({
    queryKey: ["/api/analytics/employees", id, Object.keys(filterParams).length > 0 ? filterParams : undefined].filter(Boolean),
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
                data-testid="filter-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Услуга</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="w-[200px]" data-testid="filter-service">
                  <SelectValue placeholder="Все услуги" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все услуги</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDate("");
                  setSelectedService("");
                }}
                data-testid="button-clear-filters"
              >
                Сбросить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Обслужено клиентов</p>
                <p className="text-2xl font-bold text-green-600">{analytics.totalClientsServed}</p>
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
                <p className="text-sm text-muted-foreground">Выполнено услуг</p>
                <p className="text-2xl font-bold">{analytics.totalServices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Статистика по дням
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
              <div className="space-y-4">
                {analytics.dailyStats.map((day) => (
                  <div key={day.date} className="space-y-2" data-testid={`row-${day.date}`}>
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <Link href={`/day/${day.date}`}>
                        <span className="text-primary hover:underline cursor-pointer font-medium">
                          {format(parseISO(day.date), "d MMMM yyyy", { locale: ru })}
                        </span>
                      </Link>
                      <span className="font-medium text-green-600">
                        {day.clientsServed} пац.
                      </span>
                    </div>
                    <div className="pl-4 space-y-1">
                      {day.serviceDetails.map((service, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 text-sm">
                          <span>
                            {service.time && <span className="text-primary font-medium mr-2">{service.time}</span>}
                            {service.serviceName}
                          </span>
                          <span className="text-muted-foreground">{service.patientCount} пац.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
