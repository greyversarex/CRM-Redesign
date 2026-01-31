import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, TrendingUp, Trash2, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface IncomeItem {
  id: string;
  date: string;
  time: string | null;
  name: string;
  amount: number;
  recordId: string | null;
  serviceName: string | null;
  employeeName: string | null;
}

interface DetailedIncomeData {
  byDate: Record<string, IncomeItem[]>;
  byService: Record<string, number>;
  totalIncome: number;
  recordCount: number;
  clientCount: number;
}

export default function AnalyticsIncomePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newIncome, setNewIncome] = useState({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data, isLoading } = useQuery<DetailedIncomeData>({
    queryKey: ["/api/analytics/income", { start: monthStart, end: monthEnd }],
  });

  const addIncomeMutation = useMutation({
    mutationFn: async (income: { name: string; amount: number; date: string }) => {
      return apiRequest("POST", "/api/incomes", { ...income, reminder: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/month"] });
      setIsAddDialogOpen(false);
      setNewIncome({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Доход добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить доход", variant: "destructive" });
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/incomes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/month"] });
      toast({ title: "Доход удален" });
    },
  });

  const handleAddIncome = () => {
    if (!newIncome.name || !newIncome.amount) return;
    addIncomeMutation.mutate({
      name: newIncome.name,
      amount: parseInt(newIncome.amount),
      date: newIncome.date,
    });
  };

  const serviceList = data?.byService
    ? Object.entries(data.byService).sort((a, b) => b[1] - a[1])
    : [];

  const sortedDates = data?.byDate
    ? Object.keys(data.byDate).sort((a, b) => b.localeCompare(a))
    : [];

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
          <h1 className="text-2xl sm:text-3xl font-bold text-green-600" data-testid="text-income-title">
            Общий доход
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold">Доходы по дням</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-income">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавить доход</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={newIncome.name}
                        onChange={(e) => setNewIncome({ ...newIncome, name: e.target.value })}
                        placeholder="Название дохода"
                        data-testid="input-income-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Сумма</Label>
                      <Input
                        type="number"
                        value={newIncome.amount}
                        onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                        placeholder="Сумма"
                        data-testid="input-income-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Дата</Label>
                      <Input
                        type="date"
                        value={newIncome.date}
                        onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                        data-testid="input-income-date"
                      />
                    </div>
                    <Button
                      onClick={handleAddIncome}
                      disabled={addIncomeMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-income"
                    >
                      Добавить
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {sortedDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
                  <p>Нет данных за этот месяц</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedDates.map((date) => {
                    const incomes = data!.byDate[date];
                    const dayTotal = incomes.reduce((sum, i) => sum + i.amount, 0);
                    return (
                      <div key={date} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">
                            {format(parseISO(date), "d MMMM yyyy", { locale: ru })}
                          </h3>
                          <span className="font-medium text-green-600">{dayTotal} с</span>
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-green-200 dark:border-green-800">
                          {incomes.map((income) => (
                            <div
                              key={income.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              data-testid={`income-item-${income.id}`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  {income.time && (
                                    <span className="text-xs text-muted-foreground">{income.time}</span>
                                  )}
                                  <p className="font-medium">{income.serviceName || income.name}</p>
                                </div>
                                {income.employeeName && (
                                  <p className="text-sm text-muted-foreground">{income.employeeName}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-green-600">{income.amount} с</span>
                                {!income.recordId && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteIncomeMutation.mutate(income.id)}
                                    data-testid={`button-delete-income-${income.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Итоги за месяц</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm text-muted-foreground">Общий доход</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">{data?.totalIncome || 0} с</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm text-muted-foreground">Записей</span>
                    </div>
                    <span className="text-xl font-semibold">{data?.recordCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm text-muted-foreground">Клиентов</span>
                    </div>
                    <span className="text-xl font-semibold">{data?.clientCount || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Доход по услугам</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceList.length > 0 ? (
                  <div className="space-y-3">
                    {serviceList.map(([serviceName, amount]) => (
                      <div key={serviceName} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm">{serviceName}</span>
                        <span className="text-base font-semibold text-green-600">{amount} с</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
