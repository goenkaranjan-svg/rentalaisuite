import { useMemo, useState } from "react";
import { Building2, DollarSign, ExternalLink, Search, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useMultifamilySaleListings,
  useSyncMultifamilySaleData,
  type MultifamilySaleListing,
} from "@/hooks/use-multifamily-sale";

function formatMoney(value: string | number): string {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "$0";
  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function buildLocation(listing: MultifamilySaleListing): string {
  return [
    listing.formattedAddress || listing.addressLine1,
    listing.city,
    listing.state?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ");
}

function buildForSaleLink(location: string, site: "zillow" | "redfin"): string {
  const normalized = location.trim();
  if (!normalized) return site === "zillow" ? "https://www.zillow.com/homes/for_sale/" : "https://www.redfin.com/";
  if (site === "zillow") {
    const slug = normalized.replace(/\s+/g, "-");
    return `https://www.zillow.com/homes/for_sale/${encodeURIComponent(slug)}_rb/`;
  }
  return `https://www.redfin.com/search?q=${encodeURIComponent(normalized)}`;
}

export default function InvestorMultifamily() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [minSalePrice, setMinSalePrice] = useState("");

  const filters = {
    search: search || undefined,
    city: city || undefined,
    region: region || undefined,
    minPrice: Number(minSalePrice) > 0 ? Number(minSalePrice) : undefined,
    limit: 150,
  };
  const syncFilters = {
    city: city || undefined,
    region: region || undefined,
    limit: 250,
  };

  const { data: multifamilyListings, isLoading, error } = useMultifamilySaleListings(filters);
  const syncMutation = useSyncMultifamilySaleData(syncFilters);

  const cities = useMemo(
    () => Array.from(new Set((multifamilyListings ?? []).map((item) => item.city).filter(Boolean))).sort(),
    [multifamilyListings]
  );
  const regions = useMemo(
    () => Array.from(new Set((multifamilyListings ?? []).map((item) => item.state).filter(Boolean))).sort(),
    [multifamilyListings]
  );

  const filteredListings = useMemo(() => multifamilyListings ?? [], [multifamilyListings]);
  const averageSalePrice = filteredListings.length
    ? filteredListings.reduce((sum, item) => sum + Number(item.price), 0) / filteredListings.length
    : 0;
  const averageAnnualReturn = filteredListings.length
    ? filteredListings.reduce((sum, item) => sum + Number(item.projectedAnnualReturn ?? 0), 0) / filteredListings.length
    : 0;

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      toast({
        title: "Multifamily data synced",
        description: `Fetched ${result.fetchedCount} and stored ${result.storedCount} listings.`,
      });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err?.message || "Unable to sync multifamily listings.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Investor Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-bold font-display text-slate-900">Multifamily For-Sale Opportunities</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Discover real multifamily properties currently listed for sale.</p>
          </div>
          <Button onClick={handleSync} disabled={syncMutation.isPending} className="shadow-sm">
            {syncMutation.isPending ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Multifamily Listings</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{filteredListings.length}</p>
            <div className="rounded-full bg-sky-100 p-2.5">
              <Building2 className="h-5 w-5 text-sky-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Avg Estimated Sale Price</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(averageSalePrice)}</p>
            <div className="rounded-full bg-amber-100 p-2.5">
              <DollarSign className="h-5 w-5 text-amber-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Avg Annual Return</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(averageAnnualReturn)}</p>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <TrendingUp className="h-5 w-5 text-emerald-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Filter Multifamily Deals
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input placeholder="Search city, neighborhood, title" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={city || "all"} onValueChange={(value) => setCity(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={region || "all"} onValueChange={(value) => setRegion(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="All states/regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states/regions</SelectItem>
              {regions.map((item) => (
                <SelectItem key={item!} value={item!}>
                  {item?.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            placeholder="Min sale price (USD)"
            value={minSalePrice}
            onChange={(e) => setMinSalePrice(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>For-Sale Multifamily Deals</CardTitle>
            <Badge variant="secondary">{filteredListings.length} results</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-slate-500">Loading multifamily sale opportunities...</p>}
          {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
          {!isLoading && filteredListings.length === 0 && (
            <p className="text-sm text-slate-500">No multifamily opportunities found for current filters.</p>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredListings.map((listing) => {
              const location = buildLocation(listing);
              const salePrice = Number(listing.price);
              const annualReturn = Number(listing.projectedAnnualReturn ?? 0);
              const grossYield = salePrice > 0 ? (annualReturn / salePrice) * 100 : 0;

              return (
                <div key={listing.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {listing.formattedAddress || listing.addressLine1 || `Property in ${listing.city}`}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {listing.city}, {listing.state?.toUpperCase()}
                        {listing.zipCode ? ` • ${listing.zipCode}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{listing.propertyType || "Multifamily"}</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {formatMoney(annualReturn)} / yr
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-xs text-slate-500">Estimated Sale Price</p>
                      <p className="font-semibold text-slate-900">{formatMoney(salePrice)}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-xs text-slate-500">Projected Gross Yield</p>
                      <p className="font-semibold text-slate-900">{grossYield.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <a
                      href={buildForSaleLink(location, "zillow")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      Find For-Sale on Zillow
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                    <a
                      href={buildForSaleLink(location, "redfin")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      Find For-Sale on Redfin
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </div>

                  {listing.listingUrl && (
                    <div className="mt-4">
                      <a href={listing.listingUrl} target="_blank" rel="noreferrer" className="block">
                        <Button variant="outline" className="w-full">Open Listing Details</Button>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
