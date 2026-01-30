import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Plus, Check, X, Calendar, Pencil, Trash2, Bell, TrendingUp, TrendingDown, DollarSign, Users, Search, UserPlus, Clock } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { RecordWithRelations, Client, Service, IncomeWithRelations, Expense, User } from "@shared/schema";

function QuickAddClientForm({ onSuccess, onClientCreated }: { onSuccess: () => void; onClientCreated?: (clientId: string) => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clients", data),
    onSuccess: async (response: Response) => {
      const newClient = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Клиент добавлен" });
      if (onClientCreated && newClient?.id) {
        onClientCreated(newClient.id);
      }
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleAddClient() {
    if (!fullName.trim()) return;
    mutation.mutate({ fullName, phone: phone || null });
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label>ФИО клиента</Label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Введите имя"
          data-testid="input-quick-client-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Телефон (необязательно)</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+992"
          data-testid="input-quick-client-phone"
        />
      </div>
      <Button type="button" size="sm" className="w-full" disabled={mutation.isPending} onClick={handleAddClient}>
        {mutation.isPending ? "Добавление..." : "Добавить клиента"}
      </Button>
    </div>
  );
}

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [clientId, setClientId] = useState(record?.clientId || "");
  const [serviceId, setServiceId] = useState(record?.serviceId || "");
  const [selectedDate, setSelectedDate] = useState(record?.date || date);
  const [time, setTime] = useState(record?.time || "09:00");
  const [reminder, setReminder] = useState(record?.reminder || false);
  const [patientCount, setPatientCount] = useState(record?.patientCount || 1);
  const [clientOpen, setClientOpen] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const selectedClient = clients.find(c => c.id === clientId);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (record) {
        return apiRequest("PATCH", `/api/records/${record.id}`, data);
      }
      return apiRequest("POST", "/api/records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({ title: record ? "Запись обновлена" : "Запись создана" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ clientId: clientId || null, serviceId, date: selectedDate, time, reminder, patientCount });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Клиент (необязательно)</Label>
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal bg-white dark:bg-white dark:text-black"
              data-testid="select-client"
            >
              {selectedClient ? selectedClient.fullName : "Без клиента"}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Поиск клиента..." />
              <CommandList>
                <CommandEmpty>Клиент не найден</CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.fullName}
                      onSelect={() => {
                        setClientId(client.id);
                        setClientOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${clientId === client.id ? "opacity-100" : "opacity-0"}`}
                      />
                      {client.fullName}
                      {client.phone && <span className="ml-2 text-xs text-muted-foreground">{client.phone}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-primary"
          onClick={() => setShowAddClient(!showAddClient)}
          data-testid="button-toggle-add-client"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {showAddClient ? "Скрыть" : "Добавить нового клиента"}
        </Button>
        {showAddClient && (
          <QuickAddClientForm 
            onSuccess={() => setShowAddClient(false)} 
            onClientCreated={(id) => setClientId(id)}
          />
        )}
      </div>
      <div className="space-y-2">
        <Label>Услуга</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger className="bg-white dark:bg-white dark:text-black" data-testid="select-service">
            <SelectValue placeholder="Выберите услугу" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {isAdmin ? `${service.name} - ${service.price} с` : service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Дата
          </Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white dark:bg-white dark:text-black"
            data-testid="input-record-date"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Время
          </Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-white dark:bg-white dark:text-black"
            data-testid="input-record-time"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Количество пациентов
        </Label>
        <Input
          type="number"
          min="1"
          value={patientCount}
          onChange={(e) => setPatientCount(parseInt(e.target.value) || 1)}
          className="bg-white dark:bg-white dark:text-black"
          data-testid="input-patient-count"
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
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
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
        <Label>Сумма (с)</Label>
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<RecordWithRelations | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canEditRecords = isAdmin || isManager;

  const { data: records = [], isLoading } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date }],
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const filteredRecords = records.filter(record => {
    if (selectedService && selectedService !== "all" && record.serviceId !== selectedService) return false;
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/records/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      toast({ title: "Статус обновлен" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
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
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[180px]" data-testid="filter-service-day">
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
          {selectedService && selectedService !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedService("")} data-testid="button-clear-service-filter">
              Сбросить
            </Button>
          )}
        </div>
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

      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>Нет записей на этот день</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <Card key={record.id} data-testid={`day-record-${record.id}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm sm:text-base">{record.client?.fullName || "Без клиента"}</h3>
                      {record.reminder && <Bell className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {record.service.name} 
                      {record.patientCount && record.patientCount > 1 && ` (${record.patientCount} пац.)`}
                    </p>
                    {isAdmin && <p className="text-xs sm:text-sm font-medium text-primary mt-1">{record.service.price} с</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {record.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateMutation.mutate({ id: record.id, status: "done" })}
                          data-testid={`button-complete-${record.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateMutation.mutate({ id: record.id, status: "canceled" })}
                          data-testid={`button-cancel-${record.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Badge
                      className="text-xs"
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
                    {canEditRecords && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditRecord(record);
                            setIsEditDialogOpen(true);
                          }}
                          data-testid={`button-edit-${record.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(record.id)}
                          data-testid={`button-delete-${record.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать запись</DialogTitle>
          </DialogHeader>
          {editRecord && (
            <RecordForm
              date={date}
              record={editRecord}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setEditRecord(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceTab({ date }: { date: string }) {
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: incomes = [], isLoading: loadingIncomes } = useQuery<IncomeWithRelations[]>({
    queryKey: ["/api/incomes", { date }],
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { date }],
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/incomes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      toast({ title: "Доход удален" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      toast({ title: "Расход удален" });
    },
  });

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Доходы
              </CardTitle>
              <p className="text-2xl font-bold text-green-600 mt-1">{totalIncome} с</p>
            </div>
            <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-income">
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый доход</DialogTitle>
                </DialogHeader>
                <FinanceForm type="income" date={date} onSuccess={() => setIsIncomeDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingIncomes ? (
            <Skeleton className="h-32 w-full" />
          ) : incomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Нет доходов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incomes.map((income) => (
                <div key={income.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">{income.name}</span>
                      {income.employeeName && (
                        <span className="text-xs text-muted-foreground">({income.employeeName})</span>
                      )}
                      {income.reminder && <Bell className="h-3 w-3 text-primary shrink-0" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-green-600 whitespace-nowrap">+{income.amount}</span>
                    {!income.recordId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteIncomeMutation.mutate(income.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Расходы
              </CardTitle>
              <p className="text-2xl font-bold text-red-600 mt-1">{totalExpense} с</p>
            </div>
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive" data-testid="button-add-expense">
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый расход</DialogTitle>
                </DialogHeader>
                <FinanceForm type="expense" date={date} onSuccess={() => setIsExpenseDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingExpenses ? (
            <Skeleton className="h-32 w-full" />
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingDown className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Нет расходов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm truncate">{expense.name}</span>
                    {expense.reminder && <Bell className="h-3 w-3 text-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-red-600">-{expense.amount}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteExpenseMutation.mutate(expense.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsTab({ date }: { date: string }) {
  const { data: incomes = [] } = useQuery<IncomeWithRelations[]>({
    queryKey: ["/api/incomes", { date }],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { date }],
  });

  const { data: records = [] } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date }],
  });

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const result = totalIncome - totalExpense;

  const incomePercent = totalIncome + totalExpense > 0 
    ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) 
    : 0;

  const completedRecords = records.filter(r => r.status === "done");
  const employeeStats = completedRecords.reduce((acc, record) => {
    if (!record.employee) return acc;
    const empId = record.employee.id;
    if (!acc[empId]) {
      acc[empId] = { name: record.employee.fullName, services: 0, revenue: 0 };
    }
    acc[empId].services += 1;
    acc[empId].revenue += record.service.price;
    return acc;
  }, {} as Record<string, { name: string; services: number; revenue: number }>);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Сотрудники за день
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(employeeStats).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Нет выполненных услуг</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead className="text-center">Услуг</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(employeeStats).map(([empId, stats]) => (
                  <TableRow key={empId}>
                    <TableCell className="font-medium">{stats.name}</TableCell>
                    <TableCell className="text-center">{stats.services}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {stats.revenue} с
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>();
  const { user } = useAuth();
  const formattedDate = date ? format(parseISO(date), "d MMMM yyyy", { locale: ru }) : "";
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold capitalize">{formattedDate}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Страница дня</p>
        </div>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
          <TabsTrigger value="records" className="text-xs sm:text-sm" data-testid="tab-records">Записи</TabsTrigger>
          {isAdmin && <TabsTrigger value="finance" className="text-xs sm:text-sm" data-testid="tab-finance">Финансы</TabsTrigger>}
          {isAdmin && <TabsTrigger value="analytics" className="text-xs sm:text-sm" data-testid="tab-analytics">Аналитика</TabsTrigger>}
        </TabsList>
        <TabsContent value="records" className="mt-4 sm:mt-6">
          {date && <RecordsTab date={date} />}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="finance" className="mt-4 sm:mt-6">
            {date && <FinanceTab date={date} />}
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="analytics" className="mt-4 sm:mt-6">
            {date && <AnalyticsTab date={date} />}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
