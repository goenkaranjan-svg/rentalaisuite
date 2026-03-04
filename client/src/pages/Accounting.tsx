import { useMemo, useState, type ComponentType } from "react";
import { format } from "date-fns";
import { DollarSign, Receipt, AlertTriangle, TrendingUp, Plus, FileDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

import { useLeases } from "@/hooks/use-leases";
import { useProperties } from "@/hooks/use-properties";
import { useTenants } from "@/hooks/use-auth";
import { useAccountingSummary, useCreatePayment, usePayments } from "@/hooks/use-payments";
import { useMonthlyOwnerReportExport } from "@/hooks/use-insights";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PaymentFormState = {
  leaseId: string;
  amount: string;
  status: "paid" | "pending" | "overdue" | "failed";
  type: "rent" | "deposit" | "fee";
};

export default function Accounting() {
  const { data: leases } = useLeases();
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();
  const { data: payments } = usePayments();
  const { data: summary } = useAccountingSummary();
  const { mutate: createPayment, isPending: isSavingPayment } = useCreatePayment();
  const { mutateAsync: exportMonthlyReport, isPending: isExportingReport } = useMonthlyOwnerReportExport();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>({
    leaseId: "",
    amount: "",
    status: "paid",
    type: "rent",
  });

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

  const savePayment = () => {
    if (!form.leaseId || !form.amount) return;
    createPayment(
      {
        leaseId: Number(form.leaseId),
        amount: form.amount,
        status: form.status,
        type: form.type,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setForm({ leaseId: "", amount: "", status: "paid", type: "rent" });
        },
      },
    );
  };

  const handleExportMonthlyReport = async () => {
    try {
      const report = await exportMonthlyReport(undefined);
      const blob = new Blob([report.csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `owner-report-${report.month}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export monthly report:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Accounting</h1>
          <p className="text-slate-500 mt-1">Collections, receivables, and rent roll management.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportMonthlyReport} disabled={isExportingReport}>
            <FileDown className="w-4 h-4 mr-2" />
            {isExportingReport ? "Exporting..." : "Export Monthly Owner Report"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Lease</Label>
                  <Select value={form.leaseId} onValueChange={(v) => setForm((s) => ({ ...s, leaseId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lease" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLeases.map((lease) => (
                        <SelectItem key={lease.id} value={String(lease.id)}>
                          #{lease.id} · {propertyLookup.get(lease.propertyId) ?? `Property ${lease.propertyId}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v: PaymentFormState["status"]) => setForm((s) => ({ ...s, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: PaymentFormState["type"]) => setForm((s) => ({ ...s, type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="fee">Fee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={savePayment} disabled={isSavingPayment}>
                  {isSavingPayment ? "Saving..." : "Save Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
