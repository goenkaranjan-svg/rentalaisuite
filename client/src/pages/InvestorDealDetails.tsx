import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, MapPin, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrMarketListing } from "@/hooks/use-str-market";

function formatMoney(value: string | number): string {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "$0";
  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function buildForSaleLocation(
  city?: string | null,
  region?: string | null,
  neighbourhood?: string | null,
): string {
  return [neighbourhood, city, region?.toUpperCase()].filter(Boolean).join(", ");
}

function buildSearchLink(location: string, site: "zillow" | "redfin"): string {
  const normalized = location.trim();
  if (!normalized) return site === "zillow" ? "https://www.zillow.com/homes/for_sale/" : "https://www.redfin.com/";

  if (site === "zillow") {
    const zillowSlug = normalized.replace(/\s+/g, "-");
    return `https://www.zillow.com/homes/for_sale/${encodeURIComponent(zillowSlug)}_rb/`;
  }

  return `https://www.redfin.com/search?q=${encodeURIComponent(normalized)}`;
}

export default function InvestorDealDetails() {
  const [match, params] = useRoute("/investor/deals/:id");
  const id = match ? Number(params.id) : 0;
  const { data: listing, isLoading } = useStrMarketListing(id);

  if (!match) return null;

  if (isLoading) {
    return <div className="py-10 text-slate-500">Loading deal details...</div>;
  }

  if (!listing) {
    return (
      <div className="space-y-4 py-10">
        <p className="text-slate-600">Deal not found.</p>
        <Link href="/investor">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to STR Deals
          </Button>
        </Link>
      </div>
    );
  }

  const estimatedSalePrice = Number(listing.estimatedSalePrice);
  const expectedAnnualReturn = Number(listing.expectedAnnualReturn);
  const expectedMonthlyReturn = Number(listing.expectedMonthlyReturn);
  const expectedOccupancyRate = Number(listing.expectedOccupancyRate);
  const grossYieldPct =
    Number.isFinite(estimatedSalePrice) && estimatedSalePrice > 0 && Number.isFinite(expectedAnnualReturn)
      ? (expectedAnnualReturn / estimatedSalePrice) * 100
      : 0;
  const monthlyYieldPct =
    Number.isFinite(estimatedSalePrice) && estimatedSalePrice > 0 && Number.isFinite(expectedMonthlyReturn)
      ? (expectedMonthlyReturn / estimatedSalePrice) * 100
      : 0;
  const saleSearchLocation = buildForSaleLocation(
    listing.sourceCity,
    listing.sourceRegion,
    listing.neighbourhood,
  );

  return (
    <div className="space-y-6">
      <Link href="/investor">
        <Button variant="outline" className="shadow-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Deals
        </Button>
      </Link>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {listing.pictureUrl && (
          <div className="relative h-72 bg-slate-100 md:h-80">
            <img
              src={listing.pictureUrl}
              alt={listing.title || "STR listing"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/45 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-white/95 text-slate-900">{listing.currency}</Badge>
            </div>
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">
                {listing.title || `Property in ${listing.sourceCity}`}
              </CardTitle>
              <p className="text-slate-500 mt-2 flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {listing.sourceCity}, {listing.sourceRegion?.toUpperCase()}
                {listing.neighbourhood ? ` • ${listing.neighbourhood}` : ""}
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {formatMoney(listing.expectedAnnualReturn)} / year
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-medium tracking-wide text-emerald-800 uppercase">Investment Snapshot</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-emerald-700">Estimated Buy Price</p>
                <p className="text-xl font-bold text-slate-900">{formatMoney(listing.estimatedSalePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Projected Annual Return</p>
                <p className="text-xl font-bold text-slate-900">{formatMoney(listing.expectedAnnualReturn)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Projected Gross Yield</p>
                <p className="text-xl font-bold text-slate-900">{grossYieldPct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Projected Occupancy</p>
                <p className="text-xl font-bold text-slate-900">{expectedOccupancyRate.toFixed(1)}%</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Valuation method: {listing.valuationMethod}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Expected Monthly Return</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.expectedMonthlyReturn)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Expected Annual Return</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.expectedAnnualReturn)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-white">
            <p className="text-xs text-slate-500">Deal Underwriting</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatMoney(listing.expectedMonthlyReturn)} / mo
              <span className="ml-2 text-base font-semibold text-slate-600">({monthlyYieldPct.toFixed(2)}% monthly yield)</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Buy estimate {formatMoney(estimatedSalePrice)} based on projected STR income.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">Find live properties currently for sale</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={buildSearchLink(saleSearchLocation, "zillow")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm text-blue-700 hover:text-blue-800"
              >
                Find for-sale homes on Zillow
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
              <a
                href={buildSearchLink(saleSearchLocation, "redfin")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm text-blue-700 hover:text-blue-800"
              >
                Find for-sale homes on Redfin
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <LineChart className="w-3.5 h-3.5" />
            Returns are projected from public listing price/availability and are estimates, not guaranteed results.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
