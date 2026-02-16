import { useLeases, useCreateLease, useGenerateLeaseDoc } from "@/hooks/use-leases";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, Wand2 } from "lucide-react";
import { format } from "date-fns";

export default function Leases() {
  const { data: leases, isLoading } = useLeases();
  const { mutate: generateDoc, isPending: isGenerating } = useGenerateLeaseDoc();

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Lease Management</h1>
          <p className="text-slate-500 mt-1">Contracts, renewals, and digital signatures.</p>
        </div>
        <Button className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          New Lease
        </Button>
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
                <TableCell className="font-medium text-slate-900">{lease.tenantId.substring(0, 8)}...</TableCell>
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
                    {lease.documentUrl ? (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Download className="w-4 h-4 text-slate-500" />
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-2 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                        onClick={() => generateDoc(lease.id)}
                        disabled={isGenerating}
                      >
                        <Wand2 className="w-3 h-3" />
                        Generate Doc
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
