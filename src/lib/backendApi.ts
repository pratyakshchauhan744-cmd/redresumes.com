const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  token?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message ?? errorMessage;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type BackendJob = {
  id: string;
  title: string;
  description: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  remoteType: "onsite" | "hybrid" | "remote";
  employmentType: "full_time" | "part_time" | "contract" | "internship" | "freelance";
  experienceLevel: "entry" | "mid" | "senior" | "lead";
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  postedAt?: string;
  company?: {
    id: string;
    name: string;
  };
};

export type JobsListResponse = {
  total: number;
  page: number;
  limit: number;
  items: BackendJob[];
};

export type JobFilters = {
  keyword?: string;
  location?: string;
  remoteType?: "onsite" | "hybrid" | "remote";
  employmentType?: "full_time" | "part_time" | "contract" | "internship" | "freelance";
  experienceLevel?: "entry" | "mid" | "senior" | "lead";
  salaryMin?: number;
  salaryMax?: number;
  page?: number;
  limit?: number;
};

function buildQuery(params: JobFilters): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export const backendApi = {
  health: () => request<{ status: string; service: string }>("/health"),

  register: (body: { name: string; email: string; password: string; role?: "candidate" | "employer" | "admin" }) =>
    request<{ accessToken: string; refreshToken: string }>("/api/auth/register", { method: "POST", body }),

  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
      "/api/auth/login",
      { method: "POST", body }
    ),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken }
    }),

  listJobs: (filters: JobFilters = {}) => request<JobsListResponse>(`/api/jobs${buildQuery(filters)}`),

  getJobById: (jobId: string) => request<BackendJob>(`/api/jobs/${jobId}`),

  saveJob: (jobId: string, token: string) => request(`/api/jobs/${jobId}/save`, { method: "POST", token }),

  applyToJob: (jobId: string, token: string, resumeUrl?: string) =>
    request(`/api/jobs/${jobId}/apply`, {
      method: "POST",
      token,
      body: resumeUrl ? { resumeUrl } : {}
    }),

  getMyApplications: (token: string) => request(`/api/users/me/applications`, { token }),

  getMySavedJobs: (token: string) => request(`/api/users/me/saved-jobs`, { token })
};

export function mapBackendJobToUiJob(job: BackendJob): {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  match: number;
  skills: string[];
  url?: string;
  postedAt?: string;
} {
  const location = [job.city, job.state, job.country].filter(Boolean).join(", ") || "Remote / Global";
  const salary =
    job.salaryMin && job.salaryMax
      ? `${job.currency ?? "USD"} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
      : "Competitive";

  return {
    id: job.id,
    title: job.title,
    company: job.company?.name ?? "Unknown Company",
    location,
    type: job.remoteType,
    salary,
    match: 82,
    skills: [job.employmentType, job.experienceLevel].map((value) => value.replace("_", " ")),
    postedAt: job.postedAt
  };
}
