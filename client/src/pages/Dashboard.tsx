import { useProperties } from "@/hooks/use-properties";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { useLeases } from "@/hooks/use-leases";
import { usePortfolioHealth, useSmartAlerts } from "@/hooks/use-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Building2, Settings2, Wrench, Wallet, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";

const data = [
  { name: 'Jan', revenue: 18000 },
  { name: 'Feb', revenue: 21000 },
  { name: 'Mar', revenue: 19500 },
  { name: 'Apr', revenue: 24500 },
  { name: 'May', revenue: 23000 },
  { name: 'Jun', revenue: 24500 },
];

export default function Dashboard() {
  const { isDarkMode, setIsDarkMode } = useTheme();
  const { data: properties } = useProperties();
  const { data: maintenance } = useMaintenanceRequests();
  const { data: leases } = useLeases();
  const { data: alerts } = useSmartAlerts();
  const { data: health } = usePortfolioHealth();

  const totalProperties = properties?.length ?? 0;
  const activeLeases = leases?.filter((lease) => lease.status === "active").length ?? 0;
  const openRequests = maintenance?.filter((request) => request.status === "open").length ?? 0;
  const monthlyRevenue = leases
    ? leases
        .filter((lease) => lease.status === "active")
        .reduce((sum, lease) => sum + Number(lease.rentAmount), 0)
    : 0;

  const stats = [
    { name: "Total Properties", value: totalProperties.toString(), icon: Building2, subtext: "Live data" },
    { name: "Active Leases", value: activeLeases.toString(), icon: Users, subtext: "Live data" },
    { name: "Open Requests", value: openRequests.toString(), icon: Wrench, subtext: "Live data" },
    { name: "Monthly Revenue", value: `$${monthlyRevenue.toLocaleString()}`, icon: Wallet, subtext: "From active leases" },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your rental portfolio performance.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="hidden text-sm text-slate-500 sm:block">
            Last updated: Today, 9:41 AM
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-200 bg-white text-slate-600"
                aria-label="Dashboard settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                <span className="text-sm text-slate-700">Dark Theme</span>
                <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-500">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-slate-900">{stat.value}</div>
              <p className="text-xs text-slate-500 mt-1 flex items-center">
                {stat.subtext}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Smart Alerts Center
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(alerts ?? []).slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 mt-2 rounded-full ${
                      item.severity === "high"
                        ? "bg-red-500"
                        : item.severity === "medium"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <Badge className="ml-auto capitalize" variant="outline">{item.severity}</Badge>
                </div>
              ))}
              {(alerts ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No alerts right now.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Portfolio Health Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(health ?? []).slice(0, 8).map((item) => (
            <div key={item.propertyId} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.address}</p>
                  <p className="text-xs text-slate-500">{item.city}, {item.state}</p>
                </div>
                <Badge variant={item.score >= 80 ? "default" : "outline"}>{item.score}/100</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
                <span>Occupancy: {item.occupancyScore}</span>
                <span>On-time Rent: {item.onTimeRentScore}</span>
                <span>Maintenance: {item.maintenanceScore}</span>
                <span>NOI Trend: {item.noiTrendScore}</span>
              </div>
              <div className="mt-3">
                <Link href={`/properties/${item.propertyId}`} className="text-xs text-blue-700 hover:text-blue-800">
                  View Property Details
                </Link>
              </div>
            </div>
          ))}
          {(health ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No health score data available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
