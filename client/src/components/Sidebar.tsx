import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  Wrench, 
  FileText, 
  DollarSign, 
  UserSearch, 
  MessageSquare, 
  LogOut,
  Menu,
  Send,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";

function getNavigation(role?: string) {
  if (role === "tenant") {
    return [
      { name: "Renter Portal", href: "/renter", icon: LayoutDashboard },
      { name: "Messages", href: "/messages", icon: MessageSquare },
    ];
  }
  if (role === "investor") {
    return [
      { name: "STR Market", href: "/investor", icon: TrendingUp },
      { name: "Messages", href: "/messages", icon: MessageSquare },
    ];
  }
  return [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Properties", href: "/properties", icon: Building2 },
    { name: "Maintenance", href: "/maintenance", icon: Wrench },
    { name: "Leases", href: "/leases", icon: FileText },
    { name: "Accounting", href: "/accounting", icon: DollarSign },
    { name: "Syndication", href: "/listing-exports", icon: Send },
    { name: "Screening", href: "/screenings", icon: UserSearch },
    { name: "Messages", href: "/messages", icon: MessageSquare },
  ];
}

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigation = getNavigation(user?.role);

  const NavContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold font-display tracking-tight">PropMan.ai</span>
        </div>
        
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-slate-300">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.firstName || user?.email}</p>
            <p className="text-xs text-slate-500 truncate">
              {user?.role === "tenant" ? "Renter" : user?.role === "investor" ? "Investor" : "Property Manager"}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white shadow-md">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 h-screen fixed left-0 top-0 border-r border-slate-200 shadow-xl z-40">
        <NavContent />
      </div>
    </>
  );
}
