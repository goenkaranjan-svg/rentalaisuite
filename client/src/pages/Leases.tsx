import {
  useLeases,
  useCreateLease,
  useGenerateLeaseDoc,
  useSendLeaseForSigning,
  useLeaseExpiryNotificationSettings,
  useUpdateLeaseExpiryNotificationSettings,
} from "@/hooks/use-leases";
import { useProperties } from "@/hooks/use-properties";
import { useTenants } from "@/hooks/use-auth";
import { useLeaseRenewalPipeline } from "@/hooks/use-insights";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, Wand2, Loader2, Send, Settings2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaseSchema } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function Leases() {
  const { user } = useAuth();
  const { data: leases, isLoading, refetch } = useLeases();
  const { data: properties } = useProperties();
  const { data: tenants } = useTenants();
  const { mutate: createLease, isPending: isCreating } = useCreateLease();
  const { mutate: generateDoc, isPending: isGenerating } = useGenerateLeaseDoc();
  const { mutate: sendForSigning, isPending: isSendingForSigning } = useSendLeaseForSigning();
  const { data: leaseExpirySettings } = useLeaseExpiryNotificationSettings(user?.role === "manager");
  const { mutate: updateLeaseExpirySettings, isPending: isSavingLeaseExpirySettings } = useUpdateLeaseExpiryNotificationSettings();
  const { data: pipeline } = useLeaseRenewalPipeline();
  const [open, setOpen] = useState(false);
  const [leaseExpiryEnabled, setLeaseExpiryEnabled] = useState(true);
  const [leaseExpiryDays, setLeaseExpiryDays] = useState("30");
  const [isEditingLeaseExpiryDays, setIsEditingLeaseExpiryDays] = useState(false);
  const [leaseSettingsReady, setLeaseSettingsReady] = useState(false);
  const lastSavedLeaseSettingsRef = useRef<string | null>(null);
  const selectableProperties = (properties ?? []).filter(
    (p) => p.status === "available" && p.managerId === user?.id,
  );

  useEffect(() => {
    refetch();
  }, [open, refetch]);

  useEffect(() => {
    if (!leaseExpirySettings) return;
    setLeaseExpiryEnabled(leaseExpirySettings.enabled);
    setLeaseExpiryDays(String(leaseExpirySettings.daysBeforeExpiry));
    lastSavedLeaseSettingsRef.current = `${leaseExpirySettings.enabled}:${leaseExpirySettings.daysBeforeExpiry}`;
    setLeaseSettingsReady(true);
  }, [leaseExpirySettings]);

  const form = useForm({
    resolver: zodResolver(insertLeaseSchema),
    defaultValues: {
      propertyId: 0,
      tenantId: "",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      rentAmount: "0.00",
      status: "active",
    },
  });

  const onSubmit = (data: any) => {
    createLease(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  useEffect(() => {
    if (!leaseSettingsReady || user?.role !== "manager") return;
    const parsed = Number(leaseExpiryDays);
    if (!Number.isFinite(parsed)) return;
    const nextDays = Math.min(365, Math.max(1, Math.floor(parsed)));
    const nextSignature = `${leaseExpiryEnabled}:${nextDays}`;
    if (lastSavedLeaseSettingsRef.current === nextSignature) return;
    const timer = setTimeout(() => {
      updateLeaseExpirySettings({
        enabled: leaseExpiryEnabled,
        daysBeforeExpiry: nextDays,
      }, {
        onSuccess: () => {
          lastSavedLeaseSettingsRef.current = nextSignature;
        },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [leaseExpiryEnabled, leaseExpiryDays, leaseSettingsReady, user?.role, updateLeaseExpirySettings]);

  const displayedLeaseExpiryDays = (() => {
    const parsed = Number(leaseExpiryDays);
    if (!Number.isFinite(parsed)) return 30;
    return Math.min(365, Math.max(1, Math.floor(parsed)));
  })();

  console.log("Leases Page - Data:", leases);
  console.log("Leases Page - Loading:", isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Lease Management</h1>
          <p className="text-slate-500 mt-1">Contracts, renewals, and digital signatures. (Role: {user?.role})</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-200 bg-white text-slate-600"
                aria-label="Lease settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[24rem] p-3 space-y-2">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                <div className="text-sm font-medium text-slate-700">Lease expiry reminders</div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={leaseExpiryEnabled}
                    onCheckedChange={(checked) => {
                      setLeaseExpiryEnabled(checked);
                      if (!checked) {
                        setIsEditingLeaseExpiryDays(false);
                      }
                    }}
                  />
                  {leaseExpiryEnabled && !isEditingLeaseExpiryDays ? (
                    <>
                      <span className="text-xs text-slate-600 whitespace-nowrap">
                        {displayedLeaseExpiryDays} days
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label="Edit reminder days"
                        title="Edit reminder days"
                        onClick={() => setIsEditingLeaseExpiryDays(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                  {leaseExpiryEnabled && isEditingLeaseExpiryDays ? (
                    <>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={leaseExpiryDays}
                        onChange={(e) => setLeaseExpiryDays(e.target.value)}
                        placeholder="30"
                        className="h-8 w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setIsEditingLeaseExpiryDays(false)}
                      >
                        Done
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {isSavingLeaseExpirySettings ? "Saving..." : "Changes are saved automatically."}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" />
                New Lease
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-[560px] max-h-[90dvh] p-0 overflow-hidden flex flex-col">
              <DialogHeader className="px-6 pt-6 pb-2 border-b">
                <DialogTitle>Create New Lease</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  id="create-lease-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex-1 overflow-y-auto px-6 pt-4 pb-0 space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(Number(v))} 
                          defaultValue={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a property" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectableProperties.map((prop) => (
                              <SelectItem key={prop.id} value={prop.id.toString()}>
                                {prop.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a tenant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tenants?.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.firstName} {tenant.lastName} ({tenant.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="rentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="sticky bottom-0 -mx-6 mt-4 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Lease
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Tenant ID</TableHead>
              <TableHead>Property ID</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Monthly Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases?.map((lease) => (
              <TableRow key={lease.id}>
                <TableCell className="font-medium text-slate-900">
                  {lease.tenantId ? `${lease.tenantId.substring(0, 8)}...` : 'N/A'}
                </TableCell>
                <TableCell>Unit #{lease.propertyId}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(lease.startDate), 'MMM yyyy')} - {format(new Date(lease.endDate), 'MMM yyyy')}
                </TableCell>
                <TableCell className="font-mono">${Number(lease.rentAmount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={lease.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}>
                    {lease.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {lease.draftText && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <FileText className="w-4 h-4 text-purple-600" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Lease Draft (AI Generated)</DialogTitle>
                          </DialogHeader>
                          <div className="mt-4 p-6 bg-slate-50 rounded-md border border-slate-200 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                            {lease.draftText}
                          </div>
                          <DialogFooter>
                            <Button onClick={() => {
                              const blob = new Blob([lease.draftText || ''], { type: 'text/plain' });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `lease-draft-${lease.id}.txt`;
                              a.click();
                            }}>
                              <Download className="w-4 h-4 mr-2" />
                              Download TXT
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                      onClick={() => generateDoc(lease.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {lease.draftText ? 'Regenerate AI' : 'AI Generate'}
                    </Button>
                    {user?.role === "manager" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => sendForSigning(lease.id)}
                        disabled={isSendingForSigning}
                      >
                        {isSendingForSigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Send for Sign
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {leases?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                  No leases found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-900">Automated Lease Renewal Pipeline</h3>
          <p className="text-xs text-slate-500 mt-1">Stages: outreach, negotiating, renewed, move-out.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lease</TableHead>
              <TableHead>Days to End</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pipeline ?? []).slice(0, 12).map((item) => (
              <TableRow key={item.leaseId}>
                <TableCell className="font-medium">#{item.leaseId} · Property {item.propertyId}</TableCell>
                <TableCell>{item.daysUntilEnd}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      item.stage === "negotiating"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : item.stage === "move-out"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : item.stage === "renewed"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-blue-300 bg-blue-50 text-blue-700"
                    }
                  >
                    {item.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600">{item.nextAction}</TableCell>
              </TableRow>
            ))}
            {(pipeline ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-slate-500">
                  No renewal pipeline items available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
