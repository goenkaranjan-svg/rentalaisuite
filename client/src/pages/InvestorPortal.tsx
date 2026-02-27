import { RefreshCw, TrendingUp, Building2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStrMarketListings, useSyncStrMarketData } from "@/hooks/use-str-market";

function formatMoney(value: string | number): string {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "$0";
  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function InvestorPortal() {
  const { toast } = useToast();
  const { data: listings, isLoading } = useStrMarketListings();
  const syncMutation = useSyncStrMarketData();

  const topListings = (listings ?? []).slice(0, 50);
  const avgAnnual = topListings.length
    ? topListings.reduce((sum, item) => sum + Number(item.expectedAnnualReturn), 0) / topListings.length
    : 0;

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      toast({
        title: "STR data synced",
        description: `Scraped ${result.scrapedCount} listings and stored ${result.storedCount}.`,
      });
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Investor STR Opportunities</h1>
          <p className="text-slate-500 mt-1">
            Public short-term rental (STR) market data with projected monthly and annual returns.
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncMutation.isPending}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Refresh Public STR Data"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Listings Available</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{topListings.length}</p>
            <Building2 className="w-6 h-6 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Avg Expected Annual Return</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(avgAnnual)}</p>
            <DollarSign className="w-6 h-6 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Data Source</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-xl font-semibold text-slate-900">Inside Airbnb</p>
            <TrendingUp className="w-6 h-6 text-slate-400" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Top STR Deals by Expected Annual Return</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-slate-500">Loading STR opportunities...</p>}
          {!isLoading && topListings.length === 0 && (
            <p className="text-sm text-slate-500">
              No STR data stored yet. Click <span className="font-medium">Refresh Public STR Data</span> to ingest it.
            </p>
          )}
          {topListings.map((listing) => (
            <div key={listing.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {listing.title || `${listing.roomType || "STR"} in ${listing.sourceCity}`}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {listing.sourceCity}, {listing.sourceRegion?.toUpperCase()} • {listing.roomType || "Unknown type"}
                    {listing.neighbourhood ? ` • ${listing.neighbourhood}` : ""}
                  </p>
                </div>
                <Badge>{listing.currency}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                <span>Nightly Rate: {formatMoney(listing.nightlyRate)}</span>
                <span>Expected Monthly Return: {formatMoney(listing.expectedMonthlyReturn)}</span>
                <span>Expected Annual Return: {formatMoney(listing.expectedAnnualReturn)}</span>
                <span>Occupancy: {Number(listing.expectedOccupancyRate).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

