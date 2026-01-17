import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Plus, Calendar, Check, X, Clock, Search, UserPlus, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

function RecordForm({ 
  onSuccess, 
  employeeId 
}: { 
  onSuccess: () => void; 
  employeeId: string;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [reminder, setReminder] = useState(false);
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
    mutation.mutate({ clientId, serviceId, date, time, reminder, employeeId });
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
              className="w-full justify-between font-normal"
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
          <SelectTrigger data-testid="select-service">
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
            data-testid="input-record-time"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="reminder"
          checked={reminder}
          onCheckedChange={(checked) => setReminder(checked as boolean)}
        />
        <Label htmlFor="reminder" className="flex items-center gap-1">
          <Bell className="h-3 w-3" />
          Напомнить
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-record">
        {mutation.isPending ? "Сохранение..." : "Создать запись"}
      </Button>
    </form>
  );
}

export default function EmployeeRecordsPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const { toast } = useToast();

  const { data: employee } = useQuery<Omit<User, "passwordHash">>({
    queryKey: ["/api/users", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${employeeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employee");
      return res.json();
    },
  });

  const { data: allRecords = [], isLoading } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records"],
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const employeeRecords = allRecords.filter(r => r.employeeId === employeeId);

  const filteredRecords = employeeRecords.filter(record => {
    if (selectedDate && record.date !== selectedDate) return false;
    if (selectedService && record.serviceId !== selectedService) return false;
    return true;
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/records/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Статус обновлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done":
        return <Badge className="bg-green-500">Выполнено</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Отменено</Badge>;
      default:
        return <Badge variant="secondary">Ожидание</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/employees">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-employee-name">
            {employee?.fullName || "Загрузка..."}
          </h1>
          <p className="text-muted-foreground">Записи сотрудника</p>
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
            <div className="flex items-end ml-auto">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-record">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить запись
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Новая запись для {employee?.fullName}</DialogTitle>
                  </DialogHeader>
                  <RecordForm 
                    onSuccess={() => setIsDialogOpen(false)} 
                    employeeId={employeeId!}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>Записей не найдено</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Время</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Услуга</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id} data-testid={`record-row-${record.id}`}>
                  <TableCell>
                    {format(new Date(record.date), "dd.MM.yyyy")}
                  </TableCell>
                  <TableCell>{record.time}</TableCell>
                  <TableCell className="font-medium">{record.client?.fullName}</TableCell>
                  <TableCell>{record.service?.name}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell className="text-right">
                    {record.status === "pending" && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => statusMutation.mutate({ id: record.id, status: "done" })}
                          data-testid={`button-done-${record.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => statusMutation.mutate({ id: record.id, status: "cancelled" })}
                          data-testid={`button-cancel-${record.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
