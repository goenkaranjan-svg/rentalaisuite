import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { AIAssistantFab } from "@/components/AIAssistantFab";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import PropertyDetails from "@/pages/PropertyDetails";
import Maintenance from "@/pages/Maintenance";
import Leases from "@/pages/Leases";
import Accounting from "@/pages/Accounting";
import RenterPortal from "@/pages/RenterPortal";
import ListingExports from "@/pages/ListingExports";
import InvestorPortal from "@/pages/InvestorPortal";
import InvestorDealDetails from "@/pages/InvestorDealDetails";
import InvestorMultifamily from "@/pages/InvestorMultifamily.tsx";
import LeaseSign from "@/pages/LeaseSign";
import Profile from "@/pages/Profile";
import Screenings from "@/pages/Screenings";

// Wrapper for protected routes to handle layout
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutTriggeredRef = useRef(false);

  useEffect(() => {
    if (user?.role !== "manager") return;
    logoutTriggeredRef.current = false;

    const sendExitLogout = () => {
      if (logoutTriggeredRef.current) return;
      logoutTriggeredRef.current = true;
      try {
        const payload = new Blob([], { type: "application/json" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/auth/logout", payload);
          return;
        }
      } catch {
        // Fall through to fetch keepalive.
      }
      void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendExitLogout();
      }
    };

    const onPageHide = () => {
      sendExitLogout();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.role]);

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
    const allowedTenantRoutes = ["/renter", "/profile", "/login"];
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
    const allowedInvestorRoutes = ["/investor", "/investor/multifamily", "/profile", "/login"];
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
  if (user.role === "manager" && location === "/investor/multifamily") {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-72 p-4 md:p-8 overflow-y-auto min-h-dvh">
        <div className="max-w-6xl mx-auto pt-16 lg:pt-0 pb-20">
          {children}
        </div>
      </main>
      <AIAssistantFab />
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
      <Route path="/investor/multifamily">
        <ProtectedLayout><InvestorMultifamily /></ProtectedLayout>
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
      <Route path="/accounting">
        <ProtectedLayout><Accounting /></ProtectedLayout>
      </Route>
      <Route path="/listing-exports">
        <ProtectedLayout><ListingExports /></ProtectedLayout>
      </Route>
      <Route path="/profile">
        <ProtectedLayout><Profile /></ProtectedLayout>
      </Route>
      
      <Route path="/screenings">
        <ProtectedLayout><Screenings /></ProtectedLayout>
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
