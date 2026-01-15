import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { useToast } from "@/hooks/use-toast";

export function NotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function checkStatus() {
      const isSupported = await isPushSupported();
      setSupported(isSupported);
      
      if (isSupported) {
        const isSubscribed = await isPushSubscribed();
        setSubscribed(isSubscribed);
      }
      setLoading(false);
    }
    checkStatus();
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        const success = await unsubscribeFromPush();
        if (success) {
          setSubscribed(false);
          toast({
            title: "Уведомления отключены",
            description: "Вы больше не будете получать напоминания о записях",
          });
        }
      } else {
        const success = await subscribeToPush();
        if (success) {
          setSubscribed(true);
          toast({
            title: "Уведомления включены",
            description: "Вы будете получать напоминания о записях за час до приёма",
          });
        } else {
          toast({
            title: "Не удалось включить уведомления",
            description: "Пожалуйста, разрешите уведомления в настройках браузера",
            variant: "destructive",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          disabled={loading}
          className="h-9 w-9 hover:bg-white/20 text-white"
          data-testid="button-notification-toggle"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : subscribed ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{subscribed ? "Уведомления включены" : "Уведомления выключены"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
