import { useEffect, useMemo, useState, type ComponentType } from "react";
import { format } from "date-fns";
import { DollarSign, Receipt, AlertTriangle, TrendingUp, Settings2, Pencil } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

import { useLeases } from "@/hooks/use-leases";
import { useProperties } from "@/hooks/use-properties";
import { useTenants } from "@/hooks/use-auth";
import {
  useAccountingSummary,
  usePayments,
  useRentOverdueNotificationSettings,
  useUpdateRentOverdueNotificationSettings,
} from "@/hooks/use-payments";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Accounting() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const { data: leases } = useLeases();
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();
  const { data: payments } = usePayments();
  const { data: summary } = useAccountingSummary();
  const { data: rentNotificationSettings } = useRentOverdueNotificationSettings(isManager);
  const { mutate: updateRentNotificationSettings, isPending: isSavingRentNotificationSettings } =
    useUpdateRentOverdueNotificationSettings();

  const [rentNotifEnabled, setRentNotifEnabled] = useState(true);
  const [rentNotifDays, setRentNotifDays] = useState("5");
  const [isEditingRentNotifDays, setIsEditingRentNotifDays] = useState(false);
  const [rentNotifSettingsReady, setRentNotifSettingsReady] = useState(false);

  useEffect(() => {
    if (!rentNotificationSettings) return;
    setRentNotifEnabled(rentNotificationSettings.enabled);
    setRentNotifDays(String(rentNotificationSettings.overdueDays));
    setRentNotifSettingsReady(true);
  }, [rentNotificationSettings]);

  useEffect(() => {
    if (!isManager || !rentNotifSettingsReady) return;
    const parsedDays = Number(rentNotifDays);
    if (!Number.isFinite(parsedDays)) return;
    const nextDays = Math.min(60, Math.max(1, Math.floor(parsedDays)));
    const timer = setTimeout(() => {
      updateRentNotificationSettings({
        enabled: rentNotifEnabled,
        overdueDays: nextDays,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isManager, rentNotifDays, rentNotifEnabled, rentNotifSettingsReady, updateRentNotificationSettings]);

  const activeLeases = useMemo(
    () => (leases ?? []).filter((l) => l.status === "active"),
    [leases],
  );

  const now = new Date();
  const expectedMonthlyRent = activeLeases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
  const collectedThisMonth = (payments ?? [])
    .filter((p) => {
      const d = new Date(p.date ?? new Date());
      return p.status === "paid" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const collectionRate = expectedMonthlyRent > 0 ? (collectedThisMonth / expectedMonthlyRent) * 100 : 0;

  const leaseLookup = useMemo(() => {
    const map = new Map<number, (typeof activeLeases)[number]>();
    (leases ?? []).forEach((l) => map.set(l.id, l));
    return map;
  }, [leases]);

  const propertyLookup = useMemo(() => {
    const map = new Map<number, string>();
    (properties ?? []).forEach((p) => map.set(p.id, p.address));
    return map;
  }, [properties]);

  const tenantLookup = useMemo(() => {
    const map = new Map<string, string>();
    (tenants ?? []).forEach((t) => {
      const name = [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.email || t.id;
      map.set(t.id, name);
    });
    return map;
  }, [tenants]);

  const recentTransactions = useMemo(
    () =>
      [...(payments ?? [])]
        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
        .slice(0, 12),
    [payments],
  );

  const rentRoll = useMemo(
    () =>
      activeLeases.map((lease) => {
        const monthPaid = (payments ?? [])
          .filter((p) => {
            const d = new Date(p.date ?? new Date());
            return (
              p.leaseId === lease.id &&
              p.status === "paid" &&
              p.type === "rent" &&
              d.getMonth() === now.getMonth() &&
              d.getFullYear() === now.getFullYear()
            );
          })
          .reduce((sum, p) => sum + Number(p.amount), 0);
        const expected = Number(lease.rentAmount);
        return {
          lease,
          expected,
          collected: monthPaid,
          balance: Math.max(expected - monthPaid, 0),
        };
      }),
    [activeLeases, payments, now],
  );

  const displayedRentNotifDays = (() => {
    const parsedDays = Number(rentNotifDays);
    if (!Number.isFinite(parsedDays)) return 5;
    return Math.min(60, Math.max(1, Math.floor(parsedDays)));
  })();

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Accounting</h1>
          <p className="text-slate-500 mt-1">Collections, receivables, and rent roll management.</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-200 bg-white text-slate-600"
                  aria-label="Accounting settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[24rem] p-3 space-y-2">
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div className="text-sm font-medium text-slate-700">Overdue rent email alerts</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rentNotifEnabled}
                      onCheckedChange={(checked) => {
                        setRentNotifEnabled(checked);
                        if (!checked) {
                          setIsEditingRentNotifDays(false);
                        }
                      }}
                    />
                    {rentNotifEnabled && !isEditingRentNotifDays ? (
                      <>
                        <span className="text-xs text-slate-600 whitespace-nowrap">
                          {displayedRentNotifDays} days
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          aria-label="Edit overdue days"
                          title="Edit overdue days"
                          onClick={() => setIsEditingRentNotifDays(true)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                    {rentNotifEnabled && isEditingRentNotifDays ? (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={rentNotifDays}
                          onChange={(e) => setRentNotifDays(e.target.value)}
                          placeholder="5"
                          className="h-8 w-20"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setIsEditingRentNotifDays(false)}
                        >
                          Done
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {isSavingRentNotificationSettings ? "Saving..." : "Changes are saved automatically."}
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Expected Rent (Month)" value={`$${expectedMonthlyRent.toLocaleString()}`} icon={DollarSign} />
        <MetricCard title="Collected (Month)" value={`$${collectedThisMonth.toLocaleString()}`} icon={Receipt} />
        <MetricCard title="Outstanding" value={`$${(summary?.outstanding ?? 0).toLocaleString()}`} icon={AlertTriangle} />
        <MetricCard title="Collection Rate" value={`${collectionRate.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle>Cash Flow (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.chart ?? []}>
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="collected" name="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>AR Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SnapshotRow label="Total Collected" value={summary?.totalCollected ?? 0} />
            <SnapshotRow label="Pending" value={summary?.pending ?? 0} />
            <SnapshotRow label="Overdue" value={summary?.overdue ?? 0} />
            <SnapshotRow label="Transactions" value={summary?.paymentCount ?? 0} isCurrency={false} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.map((payment) => {
                const lease = leaseLookup.get(payment.leaseId);
                const propertyName = lease ? propertyLookup.get(lease.propertyId) : undefined;
                const tenantName = lease ? tenantLookup.get(lease.tenantId) : undefined;
                return (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.date ? format(new Date(payment.date), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{propertyName ?? `Lease ${payment.leaseId}`}</TableCell>
                    <TableCell>{tenantName ?? "-"}</TableCell>
                    <TableCell className="capitalize">{payment.type}</TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant="outline">
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">${Number(payment.amount).toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
              {recentTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Rent Roll (Current Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentRoll.map((row) => (
                <TableRow key={row.lease.id}>
                  <TableCell>{propertyLookup.get(row.lease.propertyId) ?? `Property ${row.lease.propertyId}`}</TableCell>
                  <TableCell>{tenantLookup.get(row.lease.tenantId) ?? row.lease.tenantId}</TableCell>
                  <TableCell className="text-right">${row.expected.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${row.collected.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium text-amber-700">${row.balance.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {rentRoll.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                    No active leases found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-slate-500">{title}</CardTitle>
        <Icon className="w-4 h-4 text-blue-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function SnapshotRow({
  label,
  value,
  isCurrency = true,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">
        {isCurrency ? `$${value.toLocaleString()}` : value.toLocaleString()}
      </span>
    </div>
  );
}
