import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Phone, User, Trash2, Eye, Search, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

function ClientForm({ onSuccess, client }: { onSuccess: () => void; client?: Client }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(client?.fullName || "");
  const [phone, setPhone] = useState(client?.phone || "");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (client) {
        return apiRequest("PATCH", `/api/clients/${client.id}`, data);
      }
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: client ? "Клиент обновлен" : "Клиент создан" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ fullName, phone });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>ФИО</Label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Введите ФИО клиента"
          data-testid="input-client-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Телефон</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+992 XXX XXX XXX"
          data-testid="input-client-phone"
        />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-client">
        {mutation.isPending ? "Сохранение..." : client ? "Обновить" : "Создать"}
      </Button>
    </form>
  );
}

export default function ClientsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade: boolean }) => 
      apiRequest("DELETE", `/api/clients/${id}?cascade=${cascade}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({ title: "Клиент удален" });
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: () => {
      toast({ title: "Ошибка при удалении", variant: "destructive" });
    },
  });

  async function handleDeleteClick(client: Client) {
    try {
      const res = await fetch(`/api/clients/${client.id}/records-count`, { credentials: "include" });
      const data = await res.json();
      setRecordsCount(data.count || 0);
      setClientToDelete(client);
      setDeleteDialogOpen(true);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  }

  function handleDelete(cascade: boolean) {
    if (clientToDelete) {
      deleteMutation.mutate({ id: clientToDelete.id, cascade });
    }
  }

  const filteredClients = clients.filter(
    (client) =>
      client.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.phone && client.phone.includes(searchQuery))
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-clients-title">Клиенты</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-client">
              <Plus className="h-4 w-4 mr-2" />
              Добавить клиента
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый клиент</DialogTitle>
            </DialogHeader>
            <ClientForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mb-4 opacity-50" />
            <p>{searchQuery ? "Клиенты не найдены" : "Список клиентов пуст"}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                  <TableCell className="font-medium">{client.fullName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {client.phone}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`button-view-client-${client.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(client)}
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Удаление клиента
            </DialogTitle>
            <DialogDescription>
              {clientToDelete && (
                <>
                  Вы уверены, что хотите удалить клиента <strong>{clientToDelete.fullName}</strong>?
                  {recordsCount > 0 && (
                    <span className="block mt-2 text-destructive">
                      У этого клиента есть {recordsCount} записей.
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete-client"
            >
              Отмена
            </Button>
            {recordsCount > 0 ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleDelete(false)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-only-client"
                >
                  Только клиента
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-client-with-records"
                >
                  С записями ({recordsCount})
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => handleDelete(false)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete-client"
              >
                Удалить
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
