import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Package, TrendingUp, TrendingDown, RefreshCw, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { InventoryItem, InventoryHistory, Expense } from "@shared/schema";

type HistoryEntry = InventoryHistory & { expense?: Expense | null };

function getChangeIcon(changeType: string) {
  switch (changeType) {
    case "purchase":
      return <ShoppingCart className="h-4 w-4 text-green-600" />;
    case "initial":
      return <Package className="h-4 w-4 text-blue-600" />;
    default:
      return <RefreshCw className="h-4 w-4 text-orange-600" />;
  }
}

function getChangeLabel(changeType: string) {
  switch (changeType) {
    case "purchase":
      return "Покупка";
    case "initial":
      return "Создание";
    case "manual":
      return "Коррекция";
    default:
      return changeType;
  }
}

function getChangeVariant(changeType: string): "default" | "secondary" | "outline" {
  switch (changeType) {
    case "purchase":
      return "default";
    case "initial":
      return "secondary";
    default:
      return "outline";
  }
}

export default function InventoryHistoryPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const itemId = params.id;

  const { data: item, isLoading: itemLoading } = useQuery<InventoryItem>({
    queryKey: [`/api/inventory/${itemId}`],
    enabled: !!itemId,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<HistoryEntry[]>({
    queryKey: [`/api/inventory/${itemId}/history`],
    enabled: !!itemId,
  });

  const isLoading = itemLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Товар не найден</p>
            <Button variant="outline" className="mt-4" onClick={() => setLocation("/inventory")}>
              Вернуться к складу
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/inventory")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-item-name">{item.name}</h1>
          <p className="text-muted-foreground">История изменений</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Текущий остаток
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{item.quantity} {item.unit}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История изменений</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Нет записей</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Изменение</TableHead>
                  <TableHead>Примечание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => {
                  const diff = entry.newQuantity - entry.previousQuantity;
                  const isPositive = diff > 0;
                  
                  return (
                    <TableRow key={entry.id} data-testid={`row-history-${entry.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getChangeVariant(entry.changeType)} className="gap-1">
                          {getChangeIcon(entry.changeType)}
                          {getChangeLabel(entry.changeType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{entry.previousQuantity}</span>
                          <span className="text-muted-foreground">&rarr;</span>
                          <span className="font-medium">{entry.newQuantity}</span>
                          <span className={`text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                            ({isPositive ? "+" : ""}{diff})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.note || "-"}
                        {entry.expense && (
                          <span className="block text-xs text-muted-foreground">
                            Расход: {entry.expense.amount} с.
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
