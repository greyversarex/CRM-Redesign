import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock, User, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      await login(data.login, data.password);
    } catch (error) {
      toast({
        title: "Ошибка входа",
        description: "Неверный логин или пароль",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-purple-500/15 to-pink-500/20 dark:from-violet-600/30 dark:via-purple-600/20 dark:to-pink-600/25" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-pink-400/30 to-transparent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-r from-purple-400/20 to-violet-400/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
      
      <Card className="w-full max-w-md relative z-10 shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center space-y-4 mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                U-sistem
              </h1>
              <p className="text-muted-foreground text-sm mt-2">
                Система учета клиентов, услуг и финансов
              </p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Логин</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Введите логин"
                          className="pl-10 h-11 bg-background/50 border-border/50 focus:border-violet-400 focus:ring-violet-400/20"
                          data-testid="input-login"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Пароль</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Введите пароль"
                          className="pl-10 h-11 bg-background/50 border-border/50 focus:border-violet-400 focus:ring-violet-400/20"
                          data-testid="input-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 border-0"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Вход..." : "Войти в систему"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-6 border-t border-border/50">
            <p className="text-center text-xs text-muted-foreground">
              Управляйте бизнесом эффективно
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
