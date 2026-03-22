export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChecklistItem {
  id: string;
  college: string;
  action: string;
  why: string;
  urgency: "now" | "this_summer" | "senior_year";
  completed: boolean;
}

export interface StudentProfile {
  grade?: string;
  gpa_weighted?: number;
  gpa_unweighted?: number;
  sat?: number;
  act?: number;
  ap_courses?: string[];
  activities?: string[];
  awards?: string[];
  intended_major?: string;
  target_colleges?: string[];
  state_of_residence?: string;
  state?: string;
  city?: string;
  hooks?: string[];
}
