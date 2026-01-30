import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Calendar, Clock, Check, X, Bell, User, Briefcase, Search, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RecordWithRelations, Client, Service } from "@shared/schema";

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

function RecordForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [reminder, setReminder] = useState(false);
  const [patientCount, setPatientCount] = useState(1);
  const [clientOpen, setClientOpen] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const selectedClient = clients.find(c => c.id === clientId);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Запись создана" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ clientId, serviceId, date, time, reminder, patientCount });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Клиент</Label>
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal bg-white dark:bg-white dark:text-black"
              data-testid="select-client"
            >
              {selectedClient ? selectedClient.fullName : "Выберите клиента"}
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
                {service.name}
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
        />
        <Label htmlFor="reminder">Напомнить</Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-record">
        {mutation.isPending ? "Сохранение..." : "Создать запись"}
      </Button>
    </form>
  );
}

function CompleteRecordDialog({ 
  record, 
  open, 
  onOpenChange,
  onComplete
}: { 
  record: RecordWithRelations; 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (recordId: string, patientCount: number) => void;
}) {
  const [patientCount, setPatientCount] = useState(record.patientCount || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Выполнить запись</DialogTitle>
          <DialogDescription>
            Укажите количество обслуженных пациентов
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Клиент</Label>
            <p className="text-sm font-medium">{record.client.fullName}</p>
          </div>
          <div className="space-y-2">
            <Label>Услуга</Label>
            <p className="text-sm">{record.service.name}</p>
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
              data-testid="input-complete-patient-count"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={() => onComplete(record.id, patientCount)}
            data-testid="button-confirm-complete"
          >
            <Check className="h-4 w-4 mr-2" />
            Выполнить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordCard({ record, onComplete, onCancel }: { 
  record: RecordWithRelations; 
  onComplete: (record: RecordWithRelations) => void;
  onCancel: (id: string) => void;
}) {
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusLabels = {
    pending: "Ожидает",
    done: "Выполнено",
    canceled: "Отменено",
  };

  return (
    <Card className="mb-3" data-testid={`employee-record-${record.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">{record.client.fullName}</h3>
              {record.reminder && <Bell className="h-4 w-4 text-primary" />}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Briefcase className="h-3 w-3" />
              <span>
                {record.service.name}
                {record.patientCount && record.patientCount > 1 && ` (${record.patientCount} пац.)`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(record.date), "d MMMM yyyy", { locale: ru })}</span>
              {record.time && (
                <>
                  <Clock className="h-3 w-3 ml-2" />
                  <span className="font-medium">{record.time}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={statusColors[record.status]}>
              {statusLabels[record.status]}
            </Badge>
            {record.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onComplete(record)}
                  data-testid={`button-complete-${record.id}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Выполнить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onCancel(record.id)}
                  data-testid={`button-cancel-${record.id}`}
                >
                  <X className="h-4 w-4 mr-1" />
                  Отменить
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployeeDashboard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [completeRecord, setCompleteRecord] = useState<RecordWithRelations | null>(null);
  const { toast } = useToast();

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  const { data: todayRecords = [], isLoading: loadingToday } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date: today }],
  });

  const { data: tomorrowRecords = [], isLoading: loadingTomorrow } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date: tomorrow }],
  });

  const { data: allRecords = [], isLoading: loadingAll } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records"],
  });

  const pendingTodayRecords = todayRecords.filter(r => r.status === "pending");
  const pendingTomorrowRecords = tomorrowRecords.filter(r => r.status === "pending");
  const pendingAllRecords = allRecords.filter(r => r.status === "pending");

  const completeMutation = useMutation({
    mutationFn: ({ id, patientCount }: { id: string; patientCount: number }) =>
      apiRequest("POST", `/api/records/${id}/complete`, { patientCount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      toast({ title: "Запись выполнена" });
      setCompleteRecord(null);
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/records/${id}`, { status: "canceled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Запись отменена" });
    },
  });

  function handleComplete(recordId: string, patientCount: number) {
    completeMutation.mutate({ id: recordId, patientCount });
  }

  function handleCancel(id: string) {
    cancelMutation.mutate(id);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-employee-title">Все записи</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-record">
              <Plus className="h-4 w-4 mr-2" />
              Новая запись
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать запись</DialogTitle>
            </DialogHeader>
            <RecordForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today" data-testid="tab-today">
            Сегодня
            {pendingTodayRecords.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingTodayRecords.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" data-testid="tab-tomorrow">
            Завтра
            {pendingTomorrowRecords.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingTomorrowRecords.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">Все</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6">
          {loadingToday ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : todayRecords.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p>Нет записей на сегодня</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              {todayRecords.map((record) => (
                <RecordCard 
                  key={record.id} 
                  record={record} 
                  onComplete={(r) => setCompleteRecord(r)}
                  onCancel={handleCancel}
                />
              ))}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="mt-6">
          {loadingTomorrow ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : tomorrowRecords.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p>Нет записей на завтра</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              {tomorrowRecords.map((record) => (
                <RecordCard 
                  key={record.id} 
                  record={record} 
                  onComplete={(r) => setCompleteRecord(r)}
                  onCancel={handleCancel}
                />
              ))}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {loadingAll ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : allRecords.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p>Нет записей</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              {allRecords.map((record) => (
                <RecordCard 
                  key={record.id} 
                  record={record} 
                  onComplete={(r) => setCompleteRecord(r)}
                  onCancel={handleCancel}
                />
              ))}
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {completeRecord && (
        <CompleteRecordDialog
          record={completeRecord}
          open={!!completeRecord}
          onOpenChange={(open) => !open && setCompleteRecord(null)}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
