import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, UserCog, Trash2, Shield, User, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

function EmployeeForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Сотрудник создан" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ fullName, login, password, role });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>ФИО</Label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Введите ФИО сотрудника"
          data-testid="input-employee-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Логин</Label>
        <Input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Введите логин"
          data-testid="input-employee-login"
        />
      </div>
      <div className="space-y-2">
        <Label>Пароль</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Введите пароль"
          data-testid="input-employee-password"
        />
      </div>
      <div className="space-y-2">
        <Label>Роль</Label>
        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "employee")}>
          <SelectTrigger data-testid="select-employee-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Сотрудник</SelectItem>
            <SelectItem value="admin">Администратор</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-employee">
        {mutation.isPending ? "Сохранение..." : "Создать"}
      </Button>
    </form>
  );
}

export default function EmployeesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, cascade }: { id: string; cascade: boolean }) => 
      apiRequest("DELETE", `/api/users/${id}?cascade=${cascade}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({ title: "Сотрудник удален" });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: async (error: any) => {
      try {
        const data = await error.json?.();
        if (data?.hasRecords) {
          toast({ 
            title: "Невозможно удалить", 
            description: "Сначала удалите записи сотрудника или выберите 'С записями'",
            variant: "destructive" 
          });
        } else {
          toast({ title: "Ошибка при удалении", variant: "destructive" });
        }
      } catch {
        toast({ title: "Ошибка при удалении", variant: "destructive" });
      }
    },
  });

  async function handleDeleteClick(user: UserType) {
    try {
      const res = await fetch(`/api/users/${user.id}/records-count`, { credentials: "include" });
      const data = await res.json();
      setRecordsCount(data.count || 0);
      setUserToDelete(user);
      setDeleteDialogOpen(true);
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  }

  function handleDelete(cascade: boolean) {
    if (userToDelete) {
      deleteMutation.mutate({ id: userToDelete.id, cascade });
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-employees-title">Сотрудники</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee">
              <Plus className="h-4 w-4 mr-2" />
              Добавить сотрудника
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый сотрудник</DialogTitle>
            </DialogHeader>
            <EmployeeForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <UserCog className="h-12 w-12 mb-4 opacity-50" />
            <p>Список сотрудников пуст</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Логин</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`employee-row-${user.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/employees/${user.id}/analytics`}>
                      <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                        {user.role === "admin" ? (
                          <Shield className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {user.fullName}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.login}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Администратор" : "Сотрудник"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/employees/${user.id}/analytics`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-analytics-${user.id}`}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(user)}
                        data-testid={`button-delete-employee-${user.id}`}
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
              Удаление сотрудника
            </DialogTitle>
            <DialogDescription>
              {userToDelete && (
                <>
                  Вы уверены, что хотите удалить сотрудника <strong>{userToDelete.fullName}</strong>?
                  {recordsCount > 0 && (
                    <span className="block mt-2 text-destructive">
                      У этого сотрудника есть {recordsCount} записей.
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
              data-testid="button-cancel-delete"
            >
              Отмена
            </Button>
            {recordsCount > 0 ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleDelete(false)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-only-employee"
                >
                  Только сотрудника
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-with-records"
                >
                  С записями ({recordsCount})
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => handleDelete(false)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
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
