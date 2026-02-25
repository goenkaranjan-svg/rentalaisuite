import { useProperties } from "@/hooks/use-properties";
import { useMaintenanceRequests } from "@/hooks/use-maintenance";
import { useLeases } from "@/hooks/use-leases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Wrench, Wallet, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const data = [
  { name: 'Jan', revenue: 18000 },
  { name: 'Feb', revenue: 21000 },
  { name: 'Mar', revenue: 19500 },
  { name: 'Apr', revenue: 24500 },
  { name: 'May', revenue: 23000 },
  { name: 'Jun', revenue: 24500 },
];

export default function Dashboard() {
  const { data: properties } = useProperties();
  const { data: maintenance } = useMaintenanceRequests();
  const { data: leases } = useLeases();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your rental portfolio performance.</p>
        </div>
        <div className="text-sm text-slate-500">
          Last updated: Today, 9:41 AM
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
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { title: 'New Lease Signed', desc: 'Unit 4B - John Doe', time: '2h ago' },
                { title: 'Maintenance Request', desc: 'Leaky faucet at 123 Main', time: '4h ago' },
                { title: 'Rent Payment', desc: '$1,200 from Unit 2A', time: '5h ago' },
                { title: 'Screening Complete', desc: 'Sarah Smith approved', time: '1d ago' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <span className="ml-auto text-xs text-slate-400">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
