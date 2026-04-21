import axios from "axios";
import { env } from "../../config/env.js";

export type ExternalJob = {
  title: string;
  description: string;
  company: string;
  city?: string;
  state?: string;
  country?: string;
  applyUrl?: string;
  externalId?: string;
  sourceType: "api";
};

export async function fetchAdzunaJobs(): Promise<ExternalJob[]> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return [];

  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${env.ADZUNA_APP_ID}&app_key=${env.ADZUNA_APP_KEY}`;
  const response = await axios.get(url, { timeout: 10000 });

  return (response.data.results ?? []).map((item: any) => ({
    title: item.title,
    description: item.description,
    company: item.company?.display_name ?? "Unknown",
    city: item.location?.area?.[1],
    state: item.location?.area?.[2],
    country: "US",
    applyUrl: item.redirect_url,
    externalId: String(item.id),
    sourceType: "api"
  }));
}

export async function fetchJoobleJobs(): Promise<ExternalJob[]> {
  if (!env.JOOBLE_API_KEY) return [];

  const response = await axios.post(
    `https://jooble.org/api/${env.JOOBLE_API_KEY}`,
    {
      keywords: "software engineer",
      location: "United States"
    },
    { timeout: 10000 }
  );

  return (response.data.jobs ?? []).map((item: any) => ({
    title: item.title,
    description: item.snippet ?? item.title,
    company: item.company ?? "Unknown",
    city: item.location,
    country: "US",
    applyUrl: item.link,
    externalId: item.id,
    sourceType: "api"
  }));
}
