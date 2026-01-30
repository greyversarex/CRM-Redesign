import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isTomorrow, addMonths, subMonths, getDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, User as UserIcon, Check, X, Bell, Plus, Search, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { RecordWithRelations, Client, Service, User } from "@shared/schema";

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

function QuickRecordForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
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
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({ title: "Запись создана" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ clientId: clientId || null, serviceId, date, time, reminder, patientCount });
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
              className="w-full justify-between font-normal"
              data-testid="select-client-dashboard"
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
          <SelectTrigger className="w-full" data-testid="select-service-dashboard">
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
          <Label>Время</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            data-testid="input-record-time-dashboard"
          />
        </div>
        <div className="space-y-2">
          <Label>Пациентов</Label>
          <Input
            type="number"
            min={1}
            value={patientCount}
            onChange={(e) => setPatientCount(parseInt(e.target.value) || 1)}
            data-testid="input-patient-count-dashboard"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="reminder-dashboard"
          checked={reminder}
          onCheckedChange={(checked) => setReminder(checked as boolean)}
        />
        <Label htmlFor="reminder-dashboard">Напомнить</Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-record-dashboard">
        {mutation.isPending ? "Сохранение..." : "Создать запись"}
      </Button>
    </form>
  );
}

function RecordCard({ record }: { record: RecordWithRelations }) {
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusIcons = {
    pending: <Clock className="h-3 w-3" />,
    done: <Check className="h-3 w-3" />,
    canceled: <X className="h-3 w-3" />,
  };

  const statusLabels = {
    pending: "Ожидает",
    done: "Выполнено",
    canceled: "Отменено",
  };

  return (
    <div className="p-3 border rounded-lg hover-elevate" data-testid={`record-card-${record.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium text-sm">{record.service.name}</p>
          {record.time && (
            <span className="text-xs text-primary font-medium whitespace-nowrap">{record.time}</span>
          )}
        </div>
        <Badge variant="secondary" className={`text-xs whitespace-nowrap ${statusColors[record.status]}`}>
          <span className="mr-1">{statusIcons[record.status]}</span>
          {statusLabels[record.status]}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{record.client?.fullName || "Без клиента"}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <UserIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{record.employee?.fullName || "—"}</span>
        {record.reminder && (
          <Bell className="h-3 w-3 text-primary ml-auto shrink-0" />
        )}
      </div>
    </div>
  );
}

function RecordsList({ title, records, isLoading, date }: { title: string; records: RecordWithRelations[]; isLoading: boolean; date: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {title}
            {!isLoading && (
              <Badge variant="secondary" className="text-xs">
                {records.length}
              </Badge>
            )}
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid={`button-add-record-${date}`}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новая запись</DialogTitle>
              </DialogHeader>
              <QuickRecordForm date={date} onSuccess={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Clock className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Нет записей</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MonthCalendar({ 
  baseDate, 
  onPrevMonth, 
  onNextMonth, 
  onToday 
}: { 
  baseDate: Date; 
  onPrevMonth: () => void; 
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const { data: recordCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/records/counts", format(baseDate, "yyyy-MM")],
  });

  const { data: dailyEarnings = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/earnings", format(baseDate, "yyyy-MM")],
    enabled: isAdmin,
  });

  const startDayOfWeek = getDay(monthStart);
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevMonth}
            data-testid="button-prev-month"
            className="shadow-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <CardTitle className="text-center text-xl font-bold capitalize">
              {format(baseDate, "LLLL yyyy", { locale: ru })}
            </CardTitle>
            <Button
              variant="default"
              size="sm"
              onClick={onToday}
              data-testid="button-today"
              className="shadow-sm"
            >
              Сегодня
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextMonth}
            data-testid="button-next-month"
            className="shadow-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 border-b border-border mb-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => (
            <div 
              key={day} 
              className={`text-center text-xs sm:text-sm font-semibold text-muted-foreground py-2 sm:py-3 ${
                index < 6 ? "border-r border-border" : ""
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square border-r border-b border-border bg-muted/30" />
          ))}
          {days.map((day, index) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const count = recordCounts[dateKey] || 0;
            const earnings = dailyEarnings[dateKey] || 0;
            const isCurrentDay = isToday(day);
            const totalCells = paddingDays + days.length;
            const currentCell = paddingDays + index + 1;
            const isLastColumn = currentCell % 7 === 0;
            const isLastRow = currentCell > totalCells - 7;

            return (
              <Link
                key={day.toISOString()}
                href={`/day/${dateKey}`}
                data-testid={`calendar-day-${dateKey}`}
              >
                <div
                  className={`aspect-square flex flex-col items-center justify-center text-sm sm:text-base cursor-pointer transition-all hover:bg-primary/10 active:bg-primary/20 ${
                    !isLastColumn ? "border-r border-border" : ""
                  } ${
                    !isLastRow ? "border-b border-border" : ""
                  } ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground font-bold shadow-inner"
                      : "hover:shadow-inner"
                  }`}
                >
                  <span className="text-base sm:text-lg">{format(day, "d")}</span>
                  {isAdmin && earnings > 0 && (
                    <span className={`text-[10px] sm:text-xs font-medium ${isCurrentDay ? "text-primary-foreground/90" : "text-green-600 dark:text-green-400"}`}>
                      +{earnings} с
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  const { data: todayRecords = [], isLoading: loadingToday } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date: today }],
  });

  const { data: tomorrowRecords = [], isLoading: loadingTomorrow } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { date: tomorrow }],
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-dashboard-title">Панель управления</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RecordsList
          title="Записи на сегодня"
          records={todayRecords}
          isLoading={loadingToday}
          date={today}
        />
        <RecordsList
          title="Записи на завтра"
          records={tomorrowRecords}
          isLoading={loadingTomorrow}
          date={tomorrow}
        />
      </div>

      <h2 className="text-lg sm:text-xl font-semibold">Календарь</h2>

      <MonthCalendar 
        baseDate={currentDate}
        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
        onToday={() => setCurrentDate(new Date())}
      />
    </div>
  );
}
