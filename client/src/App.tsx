import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Maintenance from "@/pages/Maintenance";
import Leases from "@/pages/Leases";
import Messages from "@/pages/Messages";

// Wrapper for protected routes to handle layout
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/properties">
        <ProtectedLayout><Properties /></ProtectedLayout>
      </Route>
      <Route path="/maintenance">
        <ProtectedLayout><Maintenance /></ProtectedLayout>
      </Route>
      <Route path="/leases">
        <ProtectedLayout><Leases /></ProtectedLayout>
      </Route>
      <Route path="/messages">
        <ProtectedLayout><Messages /></ProtectedLayout>
      </Route>
      
      {/* Placeholders for other routes */}
      <Route path="/accounting">
        <ProtectedLayout>
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-slate-900">Accounting Module</h1>
            <p className="text-slate-500">Coming soon in next update.</p>
          </div>
        </ProtectedLayout>
      </Route>
      <Route path="/screenings">
        <ProtectedLayout>
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-slate-900">Tenant Screening</h1>
            <p className="text-slate-500">Coming soon in next update.</p>
          </div>
        </ProtectedLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
