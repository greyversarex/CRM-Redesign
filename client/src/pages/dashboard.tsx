import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isTomorrow, addMonths, subMonths, getDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, User, Check, X, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RecordWithRelations } from "@shared/schema";

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
          <p className="font-medium text-sm">{record.client.fullName}</p>
          {record.time && (
            <span className="text-xs text-primary font-medium whitespace-nowrap">{record.time}</span>
          )}
        </div>
        <Badge variant="secondary" className={`text-xs whitespace-nowrap ${statusColors[record.status]}`}>
          <span className="mr-1">{statusIcons[record.status]}</span>
          {statusLabels[record.status]}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{record.service.name}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{record.employee.fullName}</span>
        {record.reminder && (
          <Bell className="h-3 w-3 text-primary ml-auto shrink-0" />
        )}
      </div>
    </div>
  );
}

function RecordsList({ title, records, isLoading }: { title: string; records: RecordWithRelations[]; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          {title}
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">
              {records.length}
            </Badge>
          )}
        </CardTitle>
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
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const { data: recordCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/records/counts", format(baseDate, "yyyy-MM")],
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
                  {count > 0 && (
                    <div className={`w-2 h-2 rounded-full mt-1 ${isCurrentDay ? "bg-primary-foreground" : "bg-primary"}`} />
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
        />
        <RecordsList
          title="Записи на завтра"
          records={tomorrowRecords}
          isLoading={loadingTomorrow}
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
