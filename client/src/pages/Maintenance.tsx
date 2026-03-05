import { useMaintenanceRequests, useUpdateMaintenanceRequest, useAnalyzeMaintenance } from "@/hooks/use-maintenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Clock3, Wrench } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNowStrict } from "date-fns";

export default function Maintenance() {
  const { data: requests, isLoading } = useMaintenanceRequests();
  const { mutate: updateStatus } = useUpdateMaintenanceRequest();
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeMaintenance();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'emergency': return 'bg-red-500 text-white border-red-600 animate-pulse';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Maintenance Requests</h1>
          <p className="text-slate-500 mt-1">Track and manage property repairs.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-10">Loading requests...</div>
        ) : requests?.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No active maintenance requests.</p>
          </div>
        ) : (
          requests?.map((req) => (
            <Card key={req.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className={getPriorityColor(req.priority)}>
                        {req.priority}
                      </Badge>
                      <span className="text-sm text-slate-400">
                        {format(new Date(req.createdAt || new Date()), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{req.title}</h3>
                    <p className="text-slate-600 text-sm mb-4">{req.description}</p>

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="capitalize">
                        {req.category || "general"}
                      </Badge>
                      {req.assignedVendor ? (
                        <Badge variant="secondary" className="inline-flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {req.assignedVendor}
                        </Badge>
                      ) : null}
                      {req.assignmentNote ? (
                        <span className="text-slate-500">{req.assignmentNote}</span>
                      ) : null}
                      {req.slaDueAt ? (
                        <Badge variant="outline" className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          SLA {formatDistanceToNowStrict(new Date(req.slaDueAt), { addSuffix: true })}
                        </Badge>
                      ) : null}
                      {req.escalatedAt ? (
                        <Badge className="bg-red-600 text-white hover:bg-red-600">
                          Escalated
                        </Badge>
                      ) : null}
                    </div>
                    
                    {req.aiAnalysis && (
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 text-sm text-blue-800">
                        <Bot className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">AI Analysis:</span> {req.aiAnalysis}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      Status:
                      <Select 
                        defaultValue={req.status} 
                        onValueChange={(val) => updateStatus({ id: req.id, status: val })}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {!req.aiAnalysis && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={() => analyze(req.id)}
                        disabled={isAnalyzing}
                      >
                        <Bot className="w-4 h-4" />
                        {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
