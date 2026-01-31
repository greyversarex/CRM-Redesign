import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Phone, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import type { Client, RecordWithRelations } from "@shared/schema";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: client, isLoading: loadingClient } = useQuery<Client>({
    queryKey: ["/api/clients", id],
  });

  const { data: records = [], isLoading: loadingRecords } = useQuery<RecordWithRelations[]>({
    queryKey: ["/api/records", { clientId: id }],
  });

  if (loadingClient) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Клиент не найден</p>
      </div>
    );
  }

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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{client.fullName}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{client.phone}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            История записей
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecords ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50" />
              <p>Нет записей для этого клиента</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Услуга</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead className="text-right">Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.date), "d MMMM yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.service.name}</p>
                        {isAdmin && <p className="text-sm text-muted-foreground">{record.service.price} с</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.completions?.map(c => c.employee?.fullName).filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={statusColors[(record.completions && record.completions.length > 0 ? "done" : record.status) as keyof typeof statusColors]}>
                        {statusLabels[(record.completions && record.completions.length > 0 ? "done" : record.status) as keyof typeof statusLabels]}
                      </Badge>
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
