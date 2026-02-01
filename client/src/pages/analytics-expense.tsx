import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, TrendingDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ExpenseItem {
  id: string;
  date: string;
  time: string | null;
  name: string;
  amount: number;
}

interface DetailedExpenseData {
  byDate: Record<string, ExpenseItem[]>;
  byCategory: Record<string, number>;
  totalExpense: number;
}

const COLORS = ["#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#10B981", "#3B82F6"];

export default function AnalyticsExpensePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data, isLoading } = useQuery<DetailedExpenseData>({
    queryKey: ["/api/analytics/expense", { start: monthStart, end: monthEnd }],
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (expense: { name: string; amount: number; date: string }) => {
      return apiRequest("POST", "/api/expenses", { ...expense, reminder: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/expense"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/month"] });
      setIsAddDialogOpen(false);
      setNewExpense({ name: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });
      toast({ title: "Расход добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить расход", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/expense"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/month"] });
      toast({ title: "Расход удален" });
    },
  });

  const handleAddExpense = () => {
    if (!newExpense.name || !newExpense.amount) return;
    addExpenseMutation.mutate({
      name: newExpense.name,
      amount: parseInt(newExpense.amount),
      date: newExpense.date,
    });
  };

  const chartData = data?.byCategory
    ? Object.entries(data.byCategory).map(([name, value]) => ({ name, value }))
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
          <h1 className="text-2xl sm:text-3xl font-bold text-red-600" data-testid="text-expense-title">
            Общий расход
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
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                    <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Общий расход за месяц</p>
                    <p className="text-3xl font-bold text-red-600">{data?.totalExpense || 0} с</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Расходы по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} с`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    Нет данных
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Расходы по дням</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-expense">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавить расход</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={newExpense.name}
                        onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                        placeholder="Название расхода"
                        data-testid="input-expense-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Сумма</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        placeholder="Сумма"
                        data-testid="input-expense-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Дата</Label>
                      <Input
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                        data-testid="input-expense-date"
                      />
                    </div>
                    <Button
                      onClick={handleAddExpense}
                      disabled={addExpenseMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-expense"
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
                  <TrendingDown className="h-12 w-12 mb-4 opacity-50" />
                  <p>Нет данных за этот месяц</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sortedDates.map((date) => {
                    const expenses = data!.byDate[date];
                    const dayTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div key={date} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">
                            {format(parseISO(date), "d MMMM yyyy", { locale: ru })}
                          </h3>
                          <span className="font-medium text-red-600">{dayTotal} с</span>
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-red-200 dark:border-red-800">
                          {expenses.map((expense) => (
                            <div
                              key={expense.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              data-testid={`expense-item-${expense.id}`}
                            >
                              <div className="flex items-center gap-2">
                                {expense.time && (
                                  <span className="text-xs text-muted-foreground">{expense.time}</span>
                                )}
                                <p className="font-medium">{expense.name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-red-600">{expense.amount} с</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteExpenseMutation.mutate(expense.id)}
                                  data-testid={`button-delete-expense-${expense.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
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
        </>
      )}
    </div>
  );
}
