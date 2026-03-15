export type CollegeType = "private" | "public" | "liberal_arts";

export type ApplicationStatus =
  | "not_started"
  | "in_progress"
  | "submitted";

export type ApplicationRound = "ea" | "ed" | "rd" | "rolling" | "unknown";

export type DecisionResult =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "deferred";

export type AdmissionsCategory = "reach" | "target" | "safety";

export interface College {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  state: string | null;
  acceptance_rate: number | null;
  website_url: string | null;
  logo_url: string | null;
  college_type: CollegeType | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedCollege extends College {
  application_status: ApplicationStatus;
  application_round: ApplicationRound;
  decision: DecisionResult | null;
  admissions_category: AdmissionsCategory | null;
  personal_deadline: string | null; // ISO date string YYYY-MM-DD
  notes: string;
  added_at: string;
}

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  acceptance_rate: number | null;
  website_url: string | null;
}
