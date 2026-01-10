import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Plus, Check, X, Calendar, Pencil, Trash2, Bell, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RecordWithRelations, Client, Service, Income, Expense } from "@shared/schema";

function RecordForm({ 
  onSuccess, 
  date,
  record 
}: { 
  onSuccess: () => void; 
  date: string;
  record?: RecordWithRelations;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState(record?.clientId || "");
  const [serviceId, setServiceId] = useState(record?.serviceId || "");
  const [selectedDate, setSelectedDate] = useState(record?.date || date);
  const [reminder, setReminder] = useState(record?.reminder || false);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (record) {
        return apiRequest("PATCH", `/api/records/${record.id}`, data);
      }
      return apiRequest("POST", "/api/records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: record ? "Запись обновлена" : "Запись создана" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ clientId, serviceId, date: selectedDate, reminder });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Клиент</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger data-testid="select-client">
            <SelectValue placeholder="Выберите клиента" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Услуга</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger data-testid="select-service">
            <SelectValue placeholder="Выберите услугу" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} - {service.price} сомони
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Дата</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          data-testid="input-record-date"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="reminder"
          checked={reminder}
          onCheckedChange={(checked) => setReminder(checked as boolean)}
          data-testid="checkbox-reminder"
        />
        <Label htmlFor="reminder">Напомнить</Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-record">
        {mutation.isPending ? "Сохранение..." : record ? "Обновить" : "Создать"}
      </Button>
    </form>
  );
}

function FinanceForm({ 
  type, 
  onSuccess, 
  date 
}: { 
  type: "income" | "expense"; 
  onSuccess: () => void; 
  date: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [reminder, setReminder] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/${type === "income" ? "incomes" : "expenses"}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${type === "income" ? "incomes" : "expenses"}`] });
      toast({ title: type === "income" ? "Доход добавлен" : "Расход добавлен" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ name, amount: parseInt(amount), date, reminder });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Наименование</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите наименование"
          data-testid="input-finance-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Сумма (сомони)</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          data-testid="input-finance-amount"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="finance-reminder"
          checked={reminder}
          onCheckedChange={(checked) => setReminder(checked as boolean)}
          data-testid="checkbox-finance-reminder"
        />
        <Label htmlFor="finance-reminder">Напомнить</Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-finance">
        {mutation.isPending ? "Сохранение..." : "Добавить"}
      </Button>
    </form>
  );
}

function RecordsTab({ date }: { date: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: records = [], isLoading } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date }],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/records/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({ title: "Статус обновлен" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Запись удалена" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-record">
              <Plus className="h-4 w-4 mr-2" />
              Добавить запись
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая запись</DialogTitle>
            </DialogHeader>
            <RecordForm date={date} onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>Нет записей на этот день</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Card key={record.id} data-testid={`day-record-${record.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{record.client.fullName}</h3>
                      {record.reminder && <Bell className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{record.service.name}</p>
                    <p className="text-sm font-medium text-primary mt-1">{record.service.price} сомони</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Сотрудник: {record.employee.fullName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => updateMutation.mutate({ id: record.id, status: "done" })}
                          data-testid={`button-complete-${record.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => updateMutation.mutate({ id: record.id, status: "canceled" })}
                          data-testid={`button-cancel-${record.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Badge
                      variant={
                        record.status === "done"
                          ? "default"
                          : record.status === "canceled"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {record.status === "done"
                        ? "Выполнено"
                        : record.status === "canceled"
                        ? "Отменено"
                        : "Ожидает"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(record.id)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IncomesTab({ date }: { date: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: incomes = [], isLoading } = useQuery<Income[]>({
    queryKey: ["/api/incomes", { date }],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/incomes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({ title: "Доход удален" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const total = incomes.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Общий доход</p>
          <p className="text-2xl font-bold text-green-600">{total} сомони</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-income">
              <Plus className="h-4 w-4 mr-2" />
              Добавить доход
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый доход</DialogTitle>
            </DialogHeader>
            <FinanceForm type="income" date={date} onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {incomes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
            <p>Нет доходов за этот день</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomes.map((income) => (
              <TableRow key={income.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {income.name}
                    {income.reminder && <Bell className="h-3 w-3 text-primary" />}
                    {income.recordId && (
                      <Badge variant="outline" className="text-xs">Авто</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  +{income.amount} сомони
                </TableCell>
                <TableCell>
                  {!income.recordId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(income.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ExpensesTab({ date }: { date: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { date }],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Расход удален" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Общий расход</p>
          <p className="text-2xl font-bold text-red-600">{total} сомони</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Добавить расход
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый расход</DialogTitle>
            </DialogHeader>
            <FinanceForm type="expense" date={date} onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mb-4 opacity-50" />
            <p>Нет расходов за этот день</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {expense.name}
                    {expense.reminder && <Bell className="h-3 w-3 text-primary" />}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-red-600">
                  -{expense.amount} сомони
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(expense.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function AnalyticsTab({ date }: { date: string }) {
  const { data: incomes = [] } = useQuery<Income[]>({
    queryKey: ["/api/incomes", { date }],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { date }],
  });

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const result = totalIncome - totalExpense;

  const incomePercent = totalIncome + totalExpense > 0 
    ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Доходы</p>
                <p className="text-xl font-bold text-green-600">{totalIncome}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Расходы</p>
                <p className="text-xl font-bold text-red-600">{totalExpense}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Результат</p>
                <p className={`text-xl font-bold ${result >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {result >= 0 ? "+" : ""}{result}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Доходы %</p>
                <p className="text-xl font-bold">{incomePercent}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Доходы</CardTitle>
          </CardHeader>
          <CardContent>
            {incomes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {incomes.map((income) => (
                  <div key={income.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm">{income.name}</span>
                    <span className="font-medium text-green-600">+{income.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Расходы</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="text-sm">{expense.name}</span>
                    <span className="font-medium text-red-600">-{expense.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>();
  const formattedDate = date ? format(parseISO(date), "d MMMM yyyy", { locale: ru }) : "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold capitalize">{formattedDate}</h1>
          <p className="text-sm text-muted-foreground">Страница дня</p>
        </div>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="records" data-testid="tab-records">Записи</TabsTrigger>
          <TabsTrigger value="incomes" data-testid="tab-incomes">Доходы</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Расходы</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Аналитика</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="mt-6">
          {date && <RecordsTab date={date} />}
        </TabsContent>
        <TabsContent value="incomes" className="mt-6">
          {date && <IncomesTab date={date} />}
        </TabsContent>
        <TabsContent value="expenses" className="mt-6">
          {date && <ExpensesTab date={date} />}
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          {date && <AnalyticsTab date={date} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
