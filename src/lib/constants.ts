export const MAX_TRACKED_COLLEGES = 50;

export const LOCALSTORAGE_TRACKED_KEY = "college-trackr-tracked";
export const LOCALSTORAGE_NOTES_KEY = "college-trackr-notes";
export const LOCALSTORAGE_STATUSES_KEY = "college-trackr-statuses";
export const LOCALSTORAGE_DECISIONS_KEY = "college-trackr-decisions";
export const LOCALSTORAGE_ROUNDS_KEY = "college-trackr-rounds";

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_RESULTS = 10;

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
};

export const APPLICATION_ROUND_LABELS: Record<string, string> = {
  ea: "Early Action",
  ed: "Early Decision",
  rd: "Regular Decision",
  rolling: "Rolling",
  unknown: "Unknown",
};

export const COLLEGE_TYPE_LABELS: Record<string, string> = {
  private: "Private",
  public: "Public",
  liberal_arts: "Liberal Arts",
};
