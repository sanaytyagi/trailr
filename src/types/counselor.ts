export interface Message {
  role: "user" | "assistant";
  content: string;
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
}
