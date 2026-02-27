import { gunzipSync } from "zlib";
import type { InsertStrMarketListing } from "@shared/schema";

const STR_SOURCE = "insideairbnb";
const INSIDE_AIRBNB_DATA_PAGE = "https://insideairbnb.com/get-the-data/";
const MAX_DATASETS = 4;
const MAX_ROWS_PER_DATASET = 80;

type DatasetMeta = {
  url: string;
  sourceCountry: string;
  sourceRegion: string;
  sourceCity: string;
  sourceSnapshotDate?: string;
};

type CsvRow = Record<string, string>;

function titleizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text: string): CsvRow[] {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]).map((header) => header.trim());
  const records: CsvRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCsvLine(rows[i]);
    if (values.length === 0) continue;
    const record: CsvRow = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? "";
    });
    records.push(record);
  }

  return records;
}

function extractDatasetsFromInsideAirbnbPage(html: string): DatasetMeta[] {
  const linkMatches = html.match(/https?:\/\/[^"'\\\s>]+listings\.csv\.gz/gi) ?? [];
  const uniqueLinks = Array.from(new Set(linkMatches));

  const datasetCandidates: DatasetMeta[] = uniqueLinks
    .filter((link) => link.includes("/united-states/"))
    .map((url) => {
      const normalized = url.toLowerCase();
      const prefix = "https://data.insideairbnb.com/";
      const path = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : "";
      const parts = path.split("/").filter(Boolean);
      const sourceCountry = parts[0] ?? "united-states";
      const sourceRegion = parts[1] ?? "";
      const sourceCity = parts[2] ?? "unknown-city";
      const sourceSnapshotDate = parts[3];
      return {
        url,
        sourceCountry,
        sourceRegion,
        sourceCity,
        sourceSnapshotDate,
      };
    })
    .filter((dataset) => dataset.sourceCity !== "unknown-city");

  return datasetCandidates.slice(0, MAX_DATASETS);
}

async function fetchDatasets(): Promise<DatasetMeta[]> {
  const response = await fetch(INSIDE_AIRBNB_DATA_PAGE);
  if (!response.ok) {
    throw new Error(`Failed to fetch Inside Airbnb data page: ${response.status}`);
  }
  const html = await response.text();
  return extractDatasetsFromInsideAirbnbPage(html);
}

function toStrListing(dataset: DatasetMeta, row: CsvRow): InsertStrMarketListing | null {
  const externalId = row.id?.trim();
  const nightlyRate = parseNumber(row.price);
  const availability365 = parseNumber(row.availability_365);
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const accommodates = parseNumber(row.accommodates);
  const bedrooms = parseNumber(row.bedrooms);
  const bathrooms = parseNumber(row.bathrooms);

  if (!externalId || nightlyRate === null || nightlyRate <= 0) return null;

  const occupancyRate = availability365 === null
    ? 0.62
    : clamp((365 - availability365) / 365, 0.2, 0.95);
  const annualReturn = nightlyRate * 365 * occupancyRate * 0.72;
  const monthlyReturn = annualReturn / 12;

  return {
    source: STR_SOURCE,
    sourceCountry: dataset.sourceCountry,
    sourceRegion: dataset.sourceRegion,
    sourceCity: titleizeSlug(dataset.sourceCity),
    sourceSnapshotDate: dataset.sourceSnapshotDate,
    sourceUrl: dataset.url,
    externalListingId: externalId,
    title: row.name?.trim() || null,
    roomType: row.room_type?.trim() || null,
    neighbourhood: row.neighbourhood_cleansed?.trim() || row.neighbourhood?.trim() || null,
    latitude: latitude !== null ? latitude.toFixed(6) : null,
    longitude: longitude !== null ? longitude.toFixed(6) : null,
    accommodates: accommodates !== null ? Math.round(accommodates) : null,
    bedrooms: bedrooms !== null ? bedrooms.toFixed(1) : null,
    bathrooms: bathrooms !== null ? bathrooms.toFixed(1) : null,
    nightlyRate: nightlyRate.toFixed(2),
    availability365: availability365 !== null ? Math.round(availability365) : null,
    expectedOccupancyRate: (occupancyRate * 100).toFixed(2),
    expectedMonthlyReturn: monthlyReturn.toFixed(2),
    expectedAnnualReturn: annualReturn.toFixed(2),
    currency: "USD",
    lastScrapedAt: new Date(),
  };
}

export async function scrapePublicStrListings(): Promise<InsertStrMarketListing[]> {
  const datasets = await fetchDatasets();
  const listings: InsertStrMarketListing[] = [];

  for (const dataset of datasets) {
    const response = await fetch(dataset.url);
    if (!response.ok) continue;

    const compressedBuffer = Buffer.from(await response.arrayBuffer());
    const csvText = gunzipSync(compressedBuffer).toString("utf-8");
    const rows = parseCsv(csvText).slice(0, MAX_ROWS_PER_DATASET);
    for (const row of rows) {
      const listing = toStrListing(dataset, row);
      if (!listing) continue;
      listings.push(listing);
    }
  }

  return listings;
}
