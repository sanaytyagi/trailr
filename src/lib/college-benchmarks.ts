import { createClient } from "@/lib/supabase/server";

const TEST_POLICY: Record<number, string> = {
  1: "Required",
  2: "Recommended",
  3: "Test-Optional",
};

export async function getCollegeBenchmarks(collegeNames: string[]): Promise<string> {
  try {
    const supabase = await createClient();

    const strippedNames = collegeNames.map((n) => n.replace(/\s*\(.*?\)\s*$/, "").trim());
    const allNames = [...new Set([...collegeNames, ...strippedNames])];

    const { data, error } = await supabase
      .from("colleges")
      .select("name, acceptance_rate, sat_25, sat_75, act_25, act_75, test_requirements, college_type")
      .in("name", allNames);

    console.log("[college-benchmarks] Queried names:", collegeNames);
    console.log("[college-benchmarks] Supabase error:", error);
    console.log("[college-benchmarks] Raw results:", data?.map((r) => r.name));

    if (error) throw error;

    const rows = (data ?? []) as {
      name: string;
      acceptance_rate: number | null;
      sat_25: number | null;
      sat_75: number | null;
      act_25: number | null;
      act_75: number | null;
      test_requirements: number | null;
      college_type: string | null;
    }[];

    const chunks: string[] = [];

    for (let i = 0; i < collegeNames.length; i++) {
      const searchName = collegeNames[i];
      const lower = searchName.toLowerCase();
      const strippedLower = strippedNames[i].toLowerCase();

      // Try exact match first, then match against stripped name
      const match =
        rows.find((r) => r.name.toLowerCase() === lower) ??
        rows.find((r) => r.name.toLowerCase() === strippedLower);

      if (!match) {
        chunks.push(
          `${searchName}: No benchmark data available — do not reference statistics for this school`
        );
        continue;
      }

      const acceptanceRate =
        match.acceptance_rate != null
          ? `${match.acceptance_rate.toFixed(1)}%`
          : "Not reported";

      const satRange =
        match.sat_25 != null && match.sat_75 != null
          ? `${match.sat_25}–${match.sat_75}`
          : "Not reported";

      const actRange =
        match.act_25 != null && match.act_75 != null
          ? `${match.act_25}–${match.act_75}`
          : "Not reported";

      const testPolicy =
        match.test_requirements != null
          ? (TEST_POLICY[match.test_requirements] ?? "Not reported")
          : "Not reported";

      const institutionType =
        match.college_type === "public"
          ? "Public"
          : match.college_type === "private"
          ? "Private"
          : "Not reported";

      chunks.push(
        `${match.name} — Admissions Data\nAcceptance Rate: ${acceptanceRate}\nSAT Middle 50%: ${satRange}\nACT Middle 50%: ${actRange}\nTest Policy: ${testPolicy}\nInstitution Type: ${institutionType}`
      );
    }

    console.log("[college-benchmarks] Injecting data for", collegeNames.length, "college(s):");
    for (const chunk of chunks) {
      console.log("---\n" + chunk);
    }

    return chunks.join("\n\n---\n\n");
  } catch {
    return "Benchmark data unavailable — do not fabricate any admissions statistics.";
  }
}
