import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminLayout } from "@/components/admin-layout";
import { EmployeeLayout } from "@/components/employee-layout";
import { WelcomeEffect } from "@/components/welcome-effect";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import DayPage from "@/pages/day";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import ServicesPage from "@/pages/services";
import EmployeesPage from "@/pages/employees";
import EmployeeAnalyticsPage from "@/pages/employee-analytics";
import AnalyticsPage from "@/pages/analytics";
import EmployeeDashboard from "@/pages/employee-dashboard";
import EmployeeRecordsPage from "@/pages/employee-records";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function AdminRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/day/:date" component={DayPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/services" component={ServicesPage} />
        <Route path="/employees" component={EmployeesPage} />
        <Route path="/employees/:id/analytics" component={EmployeeAnalyticsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function ManagerRouter() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/day/:date" component={DayPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/employees" component={EmployeesPage} />
        <Route path="/employees/:id/records" component={EmployeeRecordsPage} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function EmployeeRouter() {
  return (
    <EmployeeLayout>
      <Switch>
        <Route path="/" component={EmployeeDashboard} />
        <Route component={NotFound} />
      </Switch>
    </EmployeeLayout>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [previousUser, setPreviousUser] = useState<typeof user>(null);

  useEffect(() => {
    if (user && user.role === "admin" && !previousUser) {
      setShowWelcome(true);
    }
    setPreviousUser(user);
  }, [user, previousUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (showWelcome && user.role === "admin") {
    return (
      <WelcomeEffect 
        userName={user.fullName} 
        onComplete={() => setShowWelcome(false)} 
      />
    );
  }

  if (user.role === "admin") {
    return <AdminRouter />;
  }

  if (user.role === "manager") {
    return <ManagerRouter />;
  }

  return <EmployeeRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
