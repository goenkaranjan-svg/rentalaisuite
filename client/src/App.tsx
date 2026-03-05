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
import PropertyDetails from "@/pages/PropertyDetails";
import Maintenance from "@/pages/Maintenance";
import Leases from "@/pages/Leases";
import Messages from "@/pages/Messages";
import Accounting from "@/pages/Accounting";
import RenterPortal from "@/pages/RenterPortal";
import ListingExports from "@/pages/ListingExports";
import InvestorPortal from "@/pages/InvestorPortal";
import InvestorDealDetails from "@/pages/InvestorDealDetails";
import LeaseSign from "@/pages/LeaseSign";

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

  if (user.role === "tenant") {
    const allowedTenantRoutes = ["/renter", "/messages", "/login"];
    const tenantDetailRoutes = ["/properties/"];
    const isAllowed =
      allowedTenantRoutes.includes(location) ||
      tenantDetailRoutes.some((prefix) => location.startsWith(prefix));
    if (!isAllowed) {
      setLocation("/renter");
      return null;
    }
  }
  if (user.role === "investor") {
    const allowedInvestorRoutes = ["/investor", "/messages", "/login"];
    const investorDetailRoutes = ["/investor/deals/"];
    const isAllowedInvestorRoute =
      allowedInvestorRoutes.includes(location) ||
      investorDetailRoutes.some((prefix) => location.startsWith(prefix));
    if (!isAllowedInvestorRoute) {
      setLocation("/investor");
      return null;
    }
  }

  if (user.role === "manager" && location === "/renter") {
    setLocation("/");
    return null;
  }
  if (user.role === "manager" && location === "/investor") {
    setLocation("/");
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
      <Route path="/lease-sign/:token" component={LeaseSign} />
      
      {/* Protected Routes */}
      <Route path="/">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/renter">
        <ProtectedLayout><RenterPortal /></ProtectedLayout>
      </Route>
      <Route path="/investor">
        <ProtectedLayout><InvestorPortal /></ProtectedLayout>
      </Route>
      <Route path="/investor/deals/:id">
        <ProtectedLayout><InvestorDealDetails /></ProtectedLayout>
      </Route>
      <Route path="/properties">
        <ProtectedLayout><Properties /></ProtectedLayout>
      </Route>
      <Route path="/properties/:id">
        <ProtectedLayout><PropertyDetails /></ProtectedLayout>
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
      <Route path="/accounting">
        <ProtectedLayout><Accounting /></ProtectedLayout>
      </Route>
      <Route path="/listing-exports">
        <ProtectedLayout><ListingExports /></ProtectedLayout>
      </Route>
      
      {/* Placeholders for other routes */}
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
