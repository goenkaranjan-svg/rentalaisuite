import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp, Building2, DollarSign, Sparkles, MapPin, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useStrMarketListings, useSyncStrMarketData, type StrMarketFilters } from "@/hooks/use-str-market";
import type { StrMarketListing } from "@shared/schema";

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
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [roomType, setRoomType] = useState("");
  const [minAnnualReturn, setMinAnnualReturn] = useState("0");
  const [maxNightlyRate, setMaxNightlyRate] = useState("");
  const [locationDefault, setLocationDefault] = useState<string | null>(null);
  const [locationApplied, setLocationApplied] = useState(false);

  const filters: StrMarketFilters = {
    search: search || undefined,
    city: city || undefined,
    region: region || undefined,
    roomType: roomType || undefined,
    minAnnualReturn: Number(minAnnualReturn) > 0 ? Number(minAnnualReturn) : undefined,
    maxNightlyRate: Number(maxNightlyRate) > 0 ? Number(maxNightlyRate) : undefined,
    limit: 100,
  };

  const { data: allListings } = useStrMarketListings({ limit: 5000 });
  const { data: listings, isLoading } = useStrMarketListings(filters);
  const syncMutation = useSyncStrMarketData();

  const topListings = listings ?? [];
  const avgAnnual = topListings.length
    ? topListings.reduce((sum, item) => sum + Number(item.expectedAnnualReturn), 0) / topListings.length
    : 0;
  const avgNightly = topListings.length
    ? topListings.reduce((sum, item) => sum + Number(item.nightlyRate), 0) / topListings.length
    : 0;
  const hasActiveFilters = Boolean(search || city || region || roomType || Number(minAnnualReturn) > 0 || Number(maxNightlyRate) > 0);
  const activeFilterCount = [
    Boolean(search),
    Boolean(city),
    Boolean(region),
    Boolean(roomType),
    Number(minAnnualReturn) > 0,
    Number(maxNightlyRate) > 0,
  ].filter(Boolean).length;

  const cities = useMemo(
    () => Array.from(new Set((allListings ?? []).map((item) => item.sourceCity).filter(Boolean))).sort(),
    [allListings]
  );
  const regions = useMemo(
    () => Array.from(new Set((allListings ?? []).map((item) => item.sourceRegion).filter(Boolean))).sort(),
    [allListings]
  );
  const roomTypes = useMemo(
    () => Array.from(new Set((allListings ?? []).map((item) => item.roomType).filter(Boolean))).sort(),
    [allListings]
  );

  const autoApplyLocationFilter = (coords: GeolocationCoordinates, candidates: StrMarketListing[]) => {
    const withCoordinates = candidates.filter((item) => item.latitude && item.longitude);
    if (withCoordinates.length === 0) return;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const earthRadiusKm = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadiusKm * c;
    };

    let nearest: StrMarketListing | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const listing of withCoordinates) {
      const distance = distanceKm(
        coords.latitude,
        coords.longitude,
        Number(listing.latitude),
        Number(listing.longitude)
      );
      if (distance < nearestDistance) {
        nearest = listing;
        nearestDistance = distance;
      }
    }

    if (nearest?.sourceCity) {
      setCity(nearest.sourceCity);
      setRegion(nearest.sourceRegion ?? "");
      setLocationDefault(`${nearest.sourceCity}${nearest.sourceRegion ? `, ${nearest.sourceRegion.toUpperCase()}` : ""}`);
    }
  };

  useEffect(() => {
    if (locationApplied) return;
    if (!allListings || allListings.length === 0) return;
    if (city || region) return;
    setLocationApplied(true);

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => autoApplyLocationFilter(position.coords, allListings),
      () => {
        // Ignore denied/blocked geolocation and keep global filter.
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [allListings, city, region, locationApplied]);

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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Investor Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-bold font-display text-slate-900">Investor STR Opportunities</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Explore high-potential short-term rental markets with projected returns, occupancy insights, and pricing context.
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncMutation.isPending} className="shadow-sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing..." : "Refresh Public STR Data"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Listings Available</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{topListings.length}</p>
            <div className="rounded-full bg-sky-100 p-2.5">
              <Building2 className="w-5 h-5 text-sky-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Avg Expected Annual Return</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(avgAnnual)}</p>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <DollarSign className="w-5 h-5 text-emerald-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Avg Nightly Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(avgNightly)}</p>
            <div className="rounded-full bg-amber-100 p-2.5">
              <MapPin className="w-5 h-5 text-amber-700" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Data Source</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-xl font-semibold text-slate-900">Inside Airbnb</p>
            <div className="rounded-full bg-indigo-100 p-2.5">
              <TrendingUp className="w-5 h-5 text-indigo-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="w-4 h-4" />
            Find Deals Faster
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">Search</p>
              <Input
                placeholder="City, neighborhood, or listing title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">City</p>
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
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">State / Region</p>
              <Select value={region || "all"} onValueChange={(value) => setRegion(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All states/regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states/regions</SelectItem>
                  {regions.map((item) => (
                    <SelectItem key={item!} value={item!}>
                      {item!.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">Room Type</p>
              <Select value={roomType || "all"} onValueChange={(value) => setRoomType(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All room types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All room types</SelectItem>
                  {roomTypes.map((item) => (
                    <SelectItem key={item!} value={item!}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">Min Annual Return (USD)</p>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 25000"
                value={minAnnualReturn}
                onChange={(e) => setMinAnnualReturn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600">Max Nightly Rate (USD)</p>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 300"
                value={maxNightlyRate}
                onChange={(e) => setMaxNightlyRate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {locationDefault
                ? `Defaulted to your location: ${locationDefault}`
                : "Location default is applied automatically when browser location is available."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMinAnnualReturn("25000")}
              >
                25k+ annual return
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMaxNightlyRate("300")}
              >
                Under $300/night
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setCity("");
                  setRegion("");
                  setRoomType("");
                  setMinAnnualReturn("0");
                  setMaxNightlyRate("");
                  setLocationDefault(null);
                  setLocationApplied(false);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Top STR Deals by Expected Annual Return</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{topListings.length} results</Badge>
              {hasActiveFilters && <Badge>{activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-slate-500">Loading STR opportunities...</p>}
          {!isLoading && topListings.length === 0 && (
            <p className="text-sm text-slate-500">
              No STR data stored yet. Click <span className="font-medium">Refresh Public STR Data</span> to ingest it.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {topListings.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                {listing.pictureUrl && (
                  <div className="relative mb-3 h-44 overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={listing.pictureUrl}
                      alt={listing.title || "STR listing"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute left-2 top-2">
                      <Badge className="bg-slate-900/90 text-white">{listing.currency}</Badge>
                    </div>
                  </div>
                )}
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
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {formatMoney(listing.expectedAnnualReturn)} / yr
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Nightly Rate</p>
                    <p className="font-semibold text-slate-900">{formatMoney(listing.nightlyRate)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Monthly Return</p>
                    <p className="font-semibold text-slate-900">{formatMoney(listing.expectedMonthlyReturn)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Sale Price</p>
                    <p className="font-semibold text-slate-900">{formatMoney(listing.estimatedSalePrice)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-xs text-slate-500">Occupancy</p>
                    <p className="font-semibold text-slate-900">{Number(listing.expectedOccupancyRate).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href={`/investor/deals/${listing.id}`}>
                    <Button variant="outline" className="w-full">View Full Deal Details</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
