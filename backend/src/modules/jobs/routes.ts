import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { JOBS_INDEX, meili } from "../../db/meili.js";
import { env } from "../../config/env.js";
import { fetchAdzunaJobs, fetchJoobleJobs, type ExternalJob } from "../ingestion/adapters.js";
import { normalizeAndStoreJobs } from "../ingestion/service.js";

const router = Router();
const blockedCompanyWebsites = new Set(["https://redresumes.com", "https://www.redresumes.com"]);
const blockedCompanyNames = new Set(["redresumes labs"]);

const listJobsSchema = z.object({
  keyword: z.string().optional(),
  location: z.string().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  remoteType: z.enum(["onsite", "hybrid", "remote"]).optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "internship", "freelance"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

function mapExternalJobsToResponseItems(items: ExternalJob[]) {
  return items.map((item, index) => {
    const locationText = [item.city, item.state, item.country].filter(Boolean).join(", ").toLowerCase();
    const isRemote = locationText.includes("remote");
    const idSeed = `${item.externalId ?? `${item.title}-${item.company}-${index}`}`;

    return {
      id: `ext-${idSeed}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
      title: item.title,
      description: item.description,
      city: item.city ?? null,
      state: item.state ?? null,
      country: item.country ?? null,
      remoteType: isRemote ? "remote" : ("onsite" as const),
      employmentType: "full_time" as const,
      experienceLevel: "mid" as const,
      salaryMin: null,
      salaryMax: null,
      currency: "USD",
      applyUrl: item.applyUrl ?? null,
      originalJobUrl: item.originalJobUrl ?? item.applyUrl ?? null,
      source: item.source ?? "api",
      isNew: true,
      postedAt: new Date().toISOString(),
      company: {
        id: `ext-company-${item.company}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        name: item.company,
        website: item.applyUrl ?? null
      }
    };
  });
}

function normalizeUrl(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function isBlockedCompanyJob(item: {
  applyUrl?: string | null;
  originalJobUrl?: string | null;
  company?: string | { name?: string | null; website?: string | null } | null;
}): boolean {
  const companyName = typeof item.company === "string" ? item.company : item.company?.name;
  const companyWebsite = typeof item.company === "string" ? undefined : item.company?.website;
  const normalizedName = companyName?.trim().toLowerCase();
  const urls = [companyWebsite, item.applyUrl, item.originalJobUrl].map(normalizeUrl);

  return (
    (normalizedName ? blockedCompanyNames.has(normalizedName) : false) ||
    urls.some((url) => blockedCompanyWebsites.has(url) || url.startsWith("https://redresumes.com/") || url.startsWith("https://www.redresumes.com/"))
  );
}

const fallbackCatalog = [
  {
    id: "demo-cloud-sales-google",
    title: "Cloud Sales Executive",
    description: "Own B2B cloud sales conversations, manage pipeline, and support enterprise customers through consultative discovery.",
    city: "Gurugram",
    state: "Haryana",
    country: "India",
    remoteType: "hybrid" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 1800000,
    salaryMax: 2800000,
    currency: "INR",
    applyUrl: "https://careers.google.com/",
    originalJobUrl: "https://careers.google.com/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    company: { id: "demo-company-google", name: "Google", website: "https://google.com" },
  },
  {
    id: "demo-account-executive-microsoft",
    title: "Account Executive",
    description: "Build enterprise customer relationships, negotiate SaaS contracts, and grow strategic accounts.",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    remoteType: "hybrid" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 1500000,
    salaryMax: 2400000,
    currency: "INR",
    applyUrl: "https://careers.microsoft.com/",
    originalJobUrl: "https://careers.microsoft.com/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
    company: { id: "demo-company-microsoft", name: "Microsoft", website: "https://microsoft.com" },
  },
  {
    id: "demo-frontend-engineer-vercel",
    title: "Senior Frontend Engineer",
    description: "Build performant React and TypeScript interfaces for developer workflows and customer-facing product surfaces.",
    city: "Remote",
    state: null,
    country: null,
    remoteType: "remote" as const,
    employmentType: "full_time" as const,
    experienceLevel: "senior" as const,
    salaryMin: 140000,
    salaryMax: 180000,
    currency: "USD",
    applyUrl: "https://vercel.com/careers",
    originalJobUrl: "https://vercel.com/careers",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    company: { id: "demo-company-vercel", name: "Vercel", website: "https://vercel.com" },
  },
  {
    id: "demo-product-designer-stripe",
    title: "Product Designer",
    description: "Design polished payment and dashboard experiences through research, prototyping, and design systems.",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    remoteType: "hybrid" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 3000000,
    salaryMax: 4500000,
    currency: "INR",
    applyUrl: "https://stripe.com/jobs",
    originalJobUrl: "https://stripe.com/jobs",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    company: { id: "demo-company-stripe", name: "Stripe", website: "https://stripe.com" },
  },
  {
    id: "demo-growth-marketing-notion",
    title: "Growth Marketing Manager",
    description: "Drive lifecycle campaigns, SEO experiments, and performance marketing programs for product-led growth.",
    city: "Remote",
    state: null,
    country: null,
    remoteType: "remote" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 120000,
    salaryMax: 160000,
    currency: "USD",
    applyUrl: "https://www.notion.so/careers",
    originalJobUrl: "https://www.notion.so/careers",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 38).toISOString(),
    company: { id: "demo-company-notion", name: "Notion", website: "https://notion.so" },
  },
  {
    id: "demo-data-analyst-spotify",
    title: "Data Analyst",
    description: "Use SQL, experimentation, and dashboards to guide product and marketing decisions.",
    city: "Remote",
    state: null,
    country: null,
    remoteType: "remote" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 100000,
    salaryMax: 140000,
    currency: "USD",
    applyUrl: "https://www.lifeatspotify.com/",
    originalJobUrl: "https://www.lifeatspotify.com/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    company: { id: "demo-company-spotify", name: "Spotify", website: "https://spotify.com" },
  },
  {
    id: "demo-backend-engineer-netflix",
    title: "Backend Software Engineer",
    description: "Build distributed services and APIs for reliable, high-scale streaming product infrastructure.",
    city: "Remote",
    state: null,
    country: null,
    remoteType: "remote" as const,
    employmentType: "full_time" as const,
    experienceLevel: "senior" as const,
    salaryMin: 200000,
    salaryMax: 350000,
    currency: "USD",
    applyUrl: "https://jobs.netflix.com/",
    originalJobUrl: "https://jobs.netflix.com/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    company: { id: "demo-company-netflix", name: "Netflix", website: "https://netflix.com" },
  },
  {
    id: "demo-ui-ux-designer-airbnb",
    title: "UI/UX Designer",
    description: "Create interaction flows, prototypes, and visual systems for traveler and host experiences.",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    remoteType: "hybrid" as const,
    employmentType: "full_time" as const,
    experienceLevel: "mid" as const,
    salaryMin: 2500000,
    salaryMax: 4000000,
    currency: "INR",
    applyUrl: "https://careers.airbnb.com/",
    originalJobUrl: "https://careers.airbnb.com/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    company: { id: "demo-company-airbnb", name: "Airbnb", website: "https://airbnb.com" },
  },
  {
    id: "demo-remote-marketing-intern-hubspot",
    title: "Remote Marketing Intern",
    description: "Support campaign research, content updates, reporting, and lead-generation experiments for a remote growth team.",
    city: "Remote",
    state: null,
    country: "India",
    remoteType: "remote" as const,
    employmentType: "internship" as const,
    experienceLevel: "entry" as const,
    salaryMin: 25000,
    salaryMax: 45000,
    currency: "INR",
    applyUrl: "https://www.hubspot.com/careers",
    originalJobUrl: "https://www.hubspot.com/careers",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    company: { id: "demo-company-hubspot", name: "HubSpot", website: "https://hubspot.com" },
  },
  {
    id: "demo-frontend-intern-figma",
    title: "Frontend Engineering Intern",
    description: "Build small React features, fix UI bugs, and learn production frontend workflows with senior engineers.",
    city: "Remote",
    state: null,
    country: "India",
    remoteType: "remote" as const,
    employmentType: "internship" as const,
    experienceLevel: "entry" as const,
    salaryMin: 30000,
    salaryMax: 60000,
    currency: "INR",
    applyUrl: "https://www.figma.com/careers/",
    originalJobUrl: "https://www.figma.com/careers/",
    source: "demo",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    company: { id: "demo-company-figma", name: "Figma", website: "https://figma.com" },
  },
];

function getFallbackJobsResponse(query: z.infer<typeof listJobsSchema>) {
  const keyword = query.keyword?.trim().toLowerCase();
  const location = query.location?.trim().toLowerCase();
  const filtered = fallbackCatalog.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.title.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword) ||
      item.company.name.toLowerCase().includes(keyword);
    const locationText = [item.city, item.state, item.country].filter(Boolean).join(", ").toLowerCase();
    const matchLocation = !location || locationText.includes(location);
    return (
      matchKeyword &&
      matchLocation &&
      (!query.remoteType || item.remoteType === query.remoteType) &&
      (!query.employmentType || item.employmentType === query.employmentType) &&
      (!query.experienceLevel || item.experienceLevel === query.experienceLevel)
    );
  });
  const offset = (query.page - 1) * query.limit;
  return {
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    items: filtered.slice(offset, offset + query.limit).map((item) => ({
      ...item,
      isNew: Date.now() - new Date(item.postedAt).getTime() <= 864e5,
    })),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const query = listJobsSchema.parse(req.query);

    // Bootstrap job catalog from Jooble on first run so Job Finder works out-of-the-box.
    if (env.JOOBLE_API_KEY || (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY)) {
      try {
        const jobsCount = await prisma.job.count();
        if (jobsCount === 0) {
          try {
            const externalJobs = env.JOOBLE_API_KEY ? await fetchJoobleJobs() : await fetchAdzunaJobs();
            if (externalJobs.length > 0) {
              await normalizeAndStoreJobs(env.JOOBLE_API_KEY ? "jooble" : "adzuna", externalJobs);
            }
          } catch (error) {
            console.error("Job ingestion failed:", error);
            // Ignore ingestion bootstrap errors and continue with normal query path.
          }
        }
      } catch {
        // Database unavailable; fallback is handled below.
      }
    }

    if (query.keyword || query.location || query.remoteType || query.employmentType || query.experienceLevel) {
      try {
        const filters: string[] = [];
        if (query.remoteType) filters.push(`remoteType = '${query.remoteType}'`);
        if (query.employmentType) filters.push(`employmentType = '${query.employmentType}'`);
        if (query.experienceLevel) filters.push(`experienceLevel = '${query.experienceLevel}'`);
        if (query.salaryMin !== undefined) filters.push(`salaryMin >= ${query.salaryMin}`);
        if (query.salaryMax !== undefined) filters.push(`salaryMax <= ${query.salaryMax}`);

        const index = meili.index(JOBS_INDEX);
        const result = await index.search(query.keyword ?? query.location ?? "", {
          filter: filters.length > 0 ? filters.join(" AND ") : undefined,
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
          sort: ["postedAt:desc"]
        });

        const now = Date.now();
        const itemsWithIsNew = result.hits.map(hit => ({
          ...hit,
          isNew: hit.postedAt ? now - new Date(hit.postedAt).getTime() <= 864e5 : false
        })).filter((hit) => !isBlockedCompanyJob(hit as Parameters<typeof isBlockedCompanyJob>[0]));

        if (itemsWithIsNew.length > 0) {
          res.json({
            total: result.estimatedTotalHits ?? result.hits.length,
            page: query.page,
            limit: query.limit,
            items: itemsWithIsNew
          });
          return;
        }
      } catch {
        // Fallback to PostgreSQL if Meilisearch is not available.
      }
    }

    const where = {
      remoteType: query.remoteType,
      employmentType: query.employmentType,
      experienceLevel: query.experienceLevel,
      salaryMin: query.salaryMin !== undefined ? { gte: query.salaryMin } : undefined,
      salaryMax: query.salaryMax !== undefined ? { lte: query.salaryMax } : undefined,
      OR: query.location
        ? [
            { city: { contains: query.location, mode: "insensitive" as const } },
            { state: { contains: query.location, mode: "insensitive" as const } },
            { country: { contains: query.location, mode: "insensitive" as const } }
          ]
        : undefined,
      title: query.keyword ? { contains: query.keyword, mode: "insensitive" as const } : undefined
    };

    try {
      const [items, total] = await Promise.all([
        prisma.job.findMany({
          where,
          include: { company: true },
          orderBy: { postedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.job.count({ where })
      ]);

      const now = Date.now();
      const itemsWithIsNew = items.map(job => ({
        ...job,
        isNew: now - new Date(job.postedAt).getTime() <= 864e5
      })).filter((job) => !isBlockedCompanyJob(job));

      if (!env.JOOBLE_API_KEY && !(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY)) {
        const fallback = getFallbackJobsResponse(query);
        if (total === 0) {
          res.json(fallback);
          return;
        }

        if (itemsWithIsNew.length < query.limit) {
          const seen = new Set(itemsWithIsNew.map((item) => `${item.title.toLowerCase()}-${item.company.name.toLowerCase()}`));
          const filler = fallback.items.filter((item) => {
            const key = `${item.title.toLowerCase()}-${item.company.name.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          res.json({
            total: Math.max(total, fallback.total),
            page: query.page,
            limit: query.limit,
            items: [...itemsWithIsNew, ...filler].slice(0, query.limit),
          });
          return;
        }
      }

      if (total === 0) {
        res.json(getFallbackJobsResponse(query));
        return;
      }

      res.json({ total, page: query.page, limit: query.limit, items: itemsWithIsNew });
      return;
    } catch {
      // Fallback mode: serve live jobs directly from provider when DB is unavailable.
      if (!env.JOOBLE_API_KEY && !(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY)) {
        res.json(getFallbackJobsResponse(query));
        return;
      }

      try {
        const externalJobs = env.JOOBLE_API_KEY ? await fetchJoobleJobs() : await fetchAdzunaJobs();
        const mapped = mapExternalJobsToResponseItems(externalJobs);
        const filtered = mapped.filter((item) => {
          const keyword = query.keyword?.trim().toLowerCase();
          const location = query.location?.trim().toLowerCase();
          const matchKeyword =
            !keyword ||
            item.title.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword) ||
            item.company.name.toLowerCase().includes(keyword);
          const locationText = [item.city, item.state, item.country].filter(Boolean).join(", ").toLowerCase();
          const matchLocation = !location || locationText.includes(location);
          return matchKeyword && matchLocation;
        });

        const offset = (query.page - 1) * query.limit;
        const paged = filtered.slice(offset, offset + query.limit);
        res.json({ total: filtered.length, page: query.page, limit: query.limit, items: paged });
        return;
      } catch {
        res.json(getFallbackJobsResponse(query));
        return;
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { company: true }
    });

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    const isNew = Date.now() - new Date(job.postedAt).getTime() <= 864e5;
    res.json({ ...job, isNew });
  } catch (error) {
    next(error);
  }
});

export default router;
