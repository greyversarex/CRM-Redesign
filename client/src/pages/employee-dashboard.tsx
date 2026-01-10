import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Calendar, Clock, Check, X, Bell, User, Briefcase } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { RecordWithRelations, Client, Service } from "@shared/schema";

function RecordForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reminder, setReminder] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });

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
    mutation.mutate({ clientId, serviceId, date, reminder });
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
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="input-record-date"
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

function RecordCard({ record, onStatusChange }: { 
  record: RecordWithRelations; 
  onStatusChange: (id: string, status: string) => void;
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
              <span>{record.service.name}</span>
            </div>
            <p className="text-sm font-medium text-primary">{record.service.price} сомони</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(record.date), "d MMMM yyyy", { locale: ru })}</span>
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
                  onClick={() => onStatusChange(record.id, "done")}
                  data-testid={`button-complete-${record.id}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Выполнено
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onStatusChange(record.id, "canceled")}
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
  const { toast } = useToast();

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  const { data: todayRecords = [], isLoading: loadingToday } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records/my", { date: today }],
  });

  const { data: tomorrowRecords = [], isLoading: loadingTomorrow } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records/my", { date: tomorrow }],
  });

  const { data: allRecords = [], isLoading: loadingAll } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records/my"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/records/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Статус обновлен" });
    },
  });

  function handleStatusChange(id: string, status: string) {
    updateMutation.mutate({ id, status });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-employee-title">Мои записи</h1>
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
            {todayRecords.length > 0 && (
              <Badge variant="secondary" className="ml-2">{todayRecords.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tomorrow" data-testid="tab-tomorrow">
            Завтра
            {tomorrowRecords.length > 0 && (
              <Badge variant="secondary" className="ml-2">{tomorrowRecords.length}</Badge>
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
                <RecordCard key={record.id} record={record} onStatusChange={handleStatusChange} />
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
                <RecordCard key={record.id} record={record} onStatusChange={handleStatusChange} />
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
                <RecordCard key={record.id} record={record} onStatusChange={handleStatusChange} />
              ))}
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
