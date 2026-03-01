import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, MapPin, LineChart, BedDouble, Bath, Users, CalendarRange } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <Link href="/investor">
        <Button variant="outline" className="shadow-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to STR Deals
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
                {listing.title || `${listing.roomType || "STR"} in ${listing.sourceCity}`}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Expected Monthly Return</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.expectedMonthlyReturn)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Expected Annual Return</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.expectedAnnualReturn)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Nightly Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.nightlyRate)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-white">
            <p className="text-xs text-slate-500">Estimated Sale Price</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(listing.estimatedSalePrice)}</p>
            <p className="text-xs text-slate-500 mt-1">Method: {listing.valuationMethod}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Occupancy</p>
              <p className="font-semibold">{Number(listing.expectedOccupancyRate).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Room Type</p>
              <p className="font-semibold">{listing.roomType || "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Property Type</p>
              <p className="font-semibold">{listing.propertyType || "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Bedrooms</p>
              <p className="font-semibold flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-slate-400" />{listing.bedrooms ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Bathrooms</p>
              <p className="font-semibold flex items-center gap-1"><Bath className="h-3.5 w-3.5 text-slate-400" />{listing.bathrooms ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Accommodates</p>
              <p className="font-semibold flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400" />{listing.accommodates ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Availability (365)</p>
              <p className="font-semibold flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5 text-slate-400" />{listing.availability365 ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Minimum Nights</p>
              <p className="font-semibold">{listing.minimumNights ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Reviews</p>
              <p className="font-semibold">{listing.numberOfReviews ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Rating</p>
              <p className="font-semibold">{listing.reviewScoreRating ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Superhost</p>
              <p className="font-semibold">
                {listing.hostIsSuperhost === null ? "N/A" : listing.hostIsSuperhost ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Latitude</p>
              <p className="font-semibold">{listing.latitude ?? "N/A"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Longitude</p>
              <p className="font-semibold">{listing.longitude ?? "N/A"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
            <p className="text-sm text-slate-600">
              Source: <span className="font-medium">{listing.source}</span> • Snapshot:{" "}
              <span className="font-medium">{listing.sourceSnapshotDate || "N/A"}</span>
            </p>
            {listing.listingUrl && (
              <a
                href={listing.listingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center mt-3 text-sm text-blue-700 hover:text-blue-800 mr-4"
              >
                Open original listing
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center mt-3 text-sm text-blue-700 hover:text-blue-800"
            >
              Open source dataset
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
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
