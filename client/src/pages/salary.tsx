import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Settings, DollarSign, Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "@shared/schema";

interface ServicePayment {
  id: string;
  serviceId: string;
  paymentPerPatient: number;
  service: Service;
}

interface EmployeeSalary {
  id: string;
  fullName: string;
  byService: {
    serviceId: string;
    serviceName: string;
    patientCount: number;
    payment: number;
  }[];
  totalSalary: number;
}

interface SalaryData {
  employees: EmployeeSalary[];
}

function PaymentSettingsDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const { data: servicesData = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: paymentsData = [] } = useQuery<ServicePayment[]>({
    queryKey: ["/api/service-payments"],
    enabled: open,
  });

  const paymentMap = new Map<string, number>();
  for (const p of paymentsData) {
    paymentMap.set(p.serviceId, p.paymentPerPatient);
  }

  const updateMutation = useMutation({
    mutationFn: async ({ serviceId, paymentPerPatient }: { serviceId: string; paymentPerPatient: number }) => 
      apiRequest("PUT", `/api/service-payments/${serviceId}`, { paymentPerPatient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-payments"] });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/salary" });
      toast({ title: "Отчисление сохранено" });
    },
    onError: () => {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    },
  });

  const handleSave = (serviceId: string, value: string) => {
    const amount = parseInt(value) || 0;
    updateMutation.mutate({ serviceId, paymentPerPatient: amount });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-salary-settings">
          <Settings className="h-4 w-4 mr-2" />
          Настройка зарплаты
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Отчисления по услугам</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Укажите сумму отчисления сотруднику за каждого пациента по каждой услуге
          </p>
          {servicesData.map((service) => (
            <div key={service.id} className="flex items-center justify-between gap-4">
              <Label className="flex-1 font-medium">{service.name}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-24"
                  placeholder="0"
                  defaultValue={paymentMap.get(service.id) || 0}
                  onBlur={(e) => handleSave(service.id, e.target.value)}
                  disabled={updateMutation.isPending}
                  data-testid={`input-payment-${service.id}`}
                />
                <span className="text-sm text-muted-foreground">с.</span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SalaryPage() {
  const { toast } = useToast();
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);

  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const { data, isLoading } = useQuery<SalaryData>({
    queryKey: ["/api/salary", startStr, endStr],
    queryFn: async () => {
      const res = await fetch(`/api/salary?start=${startStr}&end=${endStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary data");
      return res.json();
    },
  });

  const handleStartChange = (date: Date | undefined) => {
    if (!date) return;
    if (date > endDate) {
      setEndDate(date);
    }
    setStartDate(date);
  };

  const handleEndChange = (date: Date | undefined) => {
    if (!date) return;
    if (date < startDate) {
      setStartDate(date);
    }
    setEndDate(date);
  };

  const setThisMonth = () => {
    const now = new Date();
    setStartDate(startOfMonth(now));
    setEndDate(endOfMonth(now));
  };

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    setStartDate(startOfMonth(lastMonth));
    setEndDate(endOfMonth(lastMonth));
  };

  const setThisYear = () => {
    const now = new Date();
    setStartDate(startOfYear(now));
    setEndDate(now);
  };

  const setToday = () => {
    const now = new Date();
    setStartDate(now);
    setEndDate(now);
  };

  const totalSalary = data?.employees.reduce((sum, e) => sum + e.totalSalary, 0) || 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Зарплата</h1>
          <p className="text-muted-foreground">Расчёт зарплаты сотрудников по обслуженным пациентам</p>
        </div>
        <PaymentSettingsDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Период</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={setToday} data-testid="button-today">
              Сегодня
            </Button>
            <Button variant="outline" size="sm" onClick={setThisMonth} data-testid="button-this-month">
              Этот месяц
            </Button>
            <Button variant="outline" size="sm" onClick={setLastMonth} data-testid="button-last-month">
              Прошлый месяц
            </Button>
            <Button variant="outline" size="sm" onClick={setThisYear} data-testid="button-this-year">
              Этот год
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>С:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "d MMMM yyyy", { locale: ru })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartChange}
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center gap-2">
              <Label>По:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "d MMMM yyyy", { locale: ru })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndChange}
                    locale={ru}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Общая зарплата</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalSalary.toLocaleString()} с.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Сотрудников</p>
                <p className="text-2xl font-bold">{data?.employees.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Всего пациентов</p>
                <p className="text-2xl font-bold">
                  {data?.employees.reduce((sum, e) => sum + e.byService.reduce((s, srv) => s + srv.patientCount, 0), 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Зарплата по сотрудникам</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !data?.employees.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет данных за выбранный период</p>
              <p className="text-sm">Сотрудники не обслуживали пациентов</p>
            </div>
          ) : (
            <div className="space-y-6">
              {data.employees.map((employee) => (
                <div key={employee.id} className="border rounded-lg p-4" data-testid={`employee-salary-${employee.id}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{employee.fullName}</h3>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {employee.totalSalary.toLocaleString()} с.
                    </span>
                  </div>
                  
                  {employee.byService.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет обслуженных пациентов</p>
                  ) : (
                    <div className="space-y-2">
                      {employee.byService.map((srv) => (
                        <div key={srv.serviceId} className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2">
                          <span className="font-medium">{srv.serviceName}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{srv.patientCount} пац.</span>
                            <span className="font-semibold">{srv.payment.toLocaleString()} с.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
