import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Package, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InventoryItem } from "@shared/schema";

function AddItemForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/inventory", data);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка добавления товара");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Товар добавлен" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ name, quantity: parseInt(quantity) || 0, unit: "шт" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Наименование</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите название"
          data-testid="input-item-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Начальное количество</Label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          data-testid="input-item-quantity"
        />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-item">
        {mutation.isPending ? "Сохранение..." : "Добавить"}
      </Button>
    </form>
  );
}

function EditQuantityForm({ item, onSuccess }: { item: InventoryItem; onSuccess: () => void }) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(item.quantity.toString());

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/inventory/${item.id}/quantity`, data);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка обновления количества");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${item.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${item.id}/history`] });
      toast({ title: "Количество обновлено" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      quantity: parseInt(quantity) || 0,
      changeType: "manual",
      note: `Изменение с ${item.quantity} на ${quantity}`,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Текущее количество: {item.quantity} шт</Label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Новое количество"
          data-testid="input-edit-quantity"
        />
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-quantity">
        {mutation.isPending ? "Сохранение..." : "Сохранить"}
      </Button>
    </form>
  );
}

function PurchaseForm({ item, onSuccess }: { item: InventoryItem; onSuccess: () => void }) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");

  const total = (parseInt(quantity) || 0) * (parseInt(pricePerUnit) || 0);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/inventory/${item.id}/purchase`, data);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка оформления покупки");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${item.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/inventory/${item.id}/history`] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Покупка оформлена", description: `Расход ${total} с. добавлен` });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Get local date in YYYY-MM-DD format
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    mutation.mutate({
      quantity: parseInt(quantity) || 0,
      pricePerUnit: parseInt(pricePerUnit) || 0,
      date: localDate,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Количество (шт)</Label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Введите количество"
          data-testid="input-purchase-quantity"
        />
      </div>
      <div className="space-y-2">
        <Label>Цена за единицу (с)</Label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pricePerUnit}
          onChange={(e) => setPricePerUnit(e.target.value)}
          placeholder="Введите цену"
          data-testid="input-purchase-price"
        />
      </div>
      {total > 0 && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">Итого к оплате:</p>
          <p className="text-xl font-bold">{total} с.</p>
          <p className="text-xs text-muted-foreground">
            После покупки: {item.quantity} + {quantity || 0} = {item.quantity + (parseInt(quantity) || 0)} шт
          </p>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending || total === 0} data-testid="button-confirm-purchase">
        {mutation.isPending ? "Оформление..." : "Оформить покупку"}
      </Button>
    </form>
  );
}

export default function InventoryPage() {
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [purchasingItem, setPurchasingItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "Товар удалён" });
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-inventory-title">Склад</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-item">
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить товар</DialogTitle>
            </DialogHeader>
            <AddItemForm onSuccess={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Склад пуст</p>
            <p className="text-sm text-muted-foreground">Добавьте товары для учёта</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Наименование</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                  <TableCell>
                    <button
                      className="text-left hover:underline cursor-pointer font-medium text-primary"
                      onClick={() => setLocation(`/inventory/${item.id}`)}
                      data-testid={`link-item-${item.id}`}
                    >
                      {item.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.quantity} шт
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setPurchasingItem(item)}
                        data-testid={`button-purchase-${item.id}`}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Удалить "${item.name}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить количество: {editingItem?.name}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <EditQuantityForm item={editingItem} onSuccess={() => setEditingItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!purchasingItem} onOpenChange={(open) => !open && setPurchasingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Покупка: {purchasingItem?.name}</DialogTitle>
          </DialogHeader>
          {purchasingItem && (
            <PurchaseForm item={purchasingItem} onSuccess={() => setPurchasingItem(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
