import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface QuizAnswers {
  state: string;
  gpa: number;
  testTypes: ("SAT" | "ACT")[];
  satScore: number | null;
  actScore: number | null;
  major: string;
  majorImportance: number;
  preferenceResearch: "Research-focused" | "Teaching-focused";
  budget: string;
  fafsa: boolean;
  loans: "Yes" | "No" | "Prefer to minimize";
  setting: "Urban" | "Suburban" | "Rural";
  sizes: ("Small" | "Medium" | "Large")[];
  schoolType: "Public" | "Private" | "No preference";
  coopImportance: number;
  careerCultureImportance: number;
  careerCultureDescription: string;
  gradSchool: "Yes" | "Maybe" | "No";
  gradSchoolTypes: string[];
  careers: string;
  alumniNetworkImportance: number;
  campusDiversityImportance: number;
  campusLifeImportance: number;
  otherPriorities: string;
}

interface GeneratedCollege {
  college_id: string;
  name: string;
  tier: "Reach" | "High Match" | "Match" | "Safety";
  reason: string;
}

const SYSTEM_PROMPT = `You are an expert college admissions advisor. Your job is to select 18-20 colleges from the provided list that best fit the student.

TIERING RULES — assign tiers based ONLY on acceptance rate vs student academic profile:
- Reach: Student is below or at the very low end of the typical admitted range
- High Match: Student is at the low-to-mid end of the typical admitted range
- Match: Student is solidly within the typical admitted range
- Safety: Student is comfortably above the typical admitted range

Use these academic benchmarks as a guide:
- Sub 10% acceptance rate = almost always Reach regardless of student stats
- 10-25% = Reach for most students, High Match for exceptional stats (3.9+ GPA, 1500+ SAT)
- 25-40% = High Match to Match depending on student stats
- 40-60% = Match to Safety depending on student stats
- 60%+ = Safety for strong students

PREFERENCE WEIGHTING — use this hierarchy strictly:

HARD CONSTRAINTS (eliminate any school that fails these):
- Must offer the student's intended major or a closely related field
- Must be a US institution

STRONG PREFERENCES (weight heavily in selection but never eliminate a strong academic fit):
- Campus setting (urban/suburban/rural)
- Research vs teaching focus
- School type (public/private)
- Career services and co-op support
- Field-specific culture and opportunities

SOFT PREFERENCES (use only to choose between schools of similar quality, never to eliminate or downrank a strong fit):
- Budget and tuition cost
- School size
- Financial aid preferences
- Campus diversity
- Campus life and social scene

CRITICAL RULES:
- A student with strong academic stats (3.8+ GPA, 1400+ SAT) must have genuinely elite and well-known programs in their Reach and High Match tiers — do not fill these tiers with obscure schools to satisfy soft preferences like budget or size
- Never recommend a lesser-known or lower-ranked school over a stronger program just because it better fits budget or size preferences
- Soft preferences should only differentiate between schools of equivalent academic standing
- The list must reflect what a knowledgeable human admissions counselor would actually recommend — prioritize program quality and reputation in the student's intended field above all soft preferences
- Return ONLY a raw JSON array with no markdown, no code fences, no commentary
- Each object must have: college_id (exact id from provided data), name, tier, reason
- reason: One to two sentences that connect this school to something SPECIFIC the student told us.
  Always reference at least one of: their intended major/field, career goals, grad school plans, a setting or culture preference they rated 4–5/5, or a stated priority.
  NEVER describe the school in general terms ("known for strong research" or "vibrant campus life") without tying it directly to what this student values.
  For Reach schools: acknowledge the competitive odds while still making the case for why it's worth applying.
  Vary sentence structure across the list — avoid starting every reason the same way.`;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("api_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("endpoint", "generate-list")
    .gte("created_at", oneDayAgo);

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "You've reached the daily limit for list generation. Try again tomorrow." },
      { status: 429 }
    );
  }

  try {
    const { answers } = await req.json() as { answers: QuizAnswers };
    const { data: colleges, error: collegesError } = await supabase
      .from("colleges")
      .select("*");

    if (collegesError) {
      console.error("Supabase error fetching colleges:", collegesError);
      return NextResponse.json(
        { error: `Failed to fetch colleges: ${collegesError.message}` },
        { status: 500 }
      );
    }

    if (!colleges || colleges.length === 0) {
      console.error("No colleges found in database");
      return NextResponse.json(
        { error: "No colleges found in database" },
        { status: 500 }
      );
    }

    // Pre-filter: school type (hard constraint handled in code, not by AI)
    let filtered = colleges as any[];
    if (answers.schoolType === "Public")  filtered = filtered.filter(c => c.college_type === "public");
    if (answers.schoolType === "Private") filtered = filtered.filter(c => c.college_type === "private");

    // Drop colleges without acceptance_rate — AI cannot tier them accurately
    filtered = filtered.filter(c => c.acceptance_rate !== null);

    // Sort most-selective first so the top-200 slice never omits elite schools
    filtered.sort((a, b) => a.acceptance_rate - b.acceptance_rate);

    // Build slim college list with all fields useful to the AI
    const collegesSlim = filtered.slice(0, 200).map(c => ({
      id: c.id,
      name: c.name,
      state: c.state,
      location: c.location,
      college_type: c.college_type,
      acceptance_rate: c.acceptance_rate,
      website_url: c.website_url,
    }));

    // Build test score string
    const testInfo = answers.testTypes.length === 0
      ? "Not taken"
      : answers.testTypes.map((t) =>
          t === "SAT" ? `SAT: ${answers.satScore ?? "score not provided"}`
                      : `ACT: ${answers.actScore ?? "score not provided"}`
        ).join(", ");

    // Determine academic profile strength
    const isStrong =
      answers.gpa >= 3.8 &&
      ((answers.satScore != null && answers.satScore >= 1400) ||
       (answers.actScore != null && answers.actScore >= 31));
    const isCompetitive =
      answers.gpa >= 3.5 &&
      ((answers.satScore != null && answers.satScore >= 1200) ||
       (answers.actScore != null && answers.actScore >= 26));
    const profileStrength = isStrong ? "strong" : isCompetitive ? "competitive" : "average";

    // Tier distribution targets based on academic strength
    const tierDistribution = {
      strong:      { reach: "5–7", highMatch: "5–6", match: "4–5", safety: "2–3" },
      competitive: { reach: "3–4", highMatch: "4–5", match: "5–6", safety: "3–4" },
      average:     { reach: "1–2", highMatch: "2–3", match: "6–8", safety: "4–5" },
    }[profileStrength];

    // Extract top priorities to surface prominently for personalized reasoning
    const topPriorities: string[] = [];
    topPriorities.push(`Intended major: ${answers.major}`);
    if (answers.careers) topPriorities.push(`Target careers/industries: ${answers.careers}`);
    topPriorities.push(`Grad school intention: ${answers.gradSchool}${answers.gradSchoolTypes.length > 0 ? ` (${answers.gradSchoolTypes.join(", ")})` : ""}`);
    if (answers.careerCultureDescription) topPriorities.push(`Career culture they want: ${answers.careerCultureDescription}`);
    if (answers.otherPriorities) topPriorities.push(`Other priorities: ${answers.otherPriorities}`);
    if (answers.majorImportance >= 4)           topPriorities.push(`Major-specific ranking matters to them (${answers.majorImportance}/5)`);
    if (answers.coopImportance >= 4)            topPriorities.push(`Career services / co-op programs matter (${answers.coopImportance}/5)`);
    if (answers.careerCultureImportance >= 4)   topPriorities.push(`Career culture fit matters (${answers.careerCultureImportance}/5)`);
    if (answers.alumniNetworkImportance >= 4)   topPriorities.push(`Alumni network matters (${answers.alumniNetworkImportance}/5)`);
    if (answers.campusDiversityImportance >= 4) topPriorities.push(`Campus diversity matters (${answers.campusDiversityImportance}/5)`);
    if (answers.campusLifeImportance >= 4)      topPriorities.push(`Campus life matters (${answers.campusLifeImportance}/5)`);

    // Build structured student profile
    const studentProfile = {
      state: answers.state,
      gpa: answers.gpa,
      standardizedTests: testInfo,
      intendedMajor: answers.major,
      majorSpecificRankingImportance: `${answers.majorImportance}/5`,
      preferredTeachingStyle: answers.preferenceResearch,
      budgetRange: answers.budget,
      applyingForFinancialAid: answers.fafsa ? "Yes" : "No",
      willingToTakeLoan: answers.loans,
      preferredSetting: answers.setting,
      preferredStudentBodySizes: answers.sizes.join(", "),
      schoolTypePreference: answers.schoolType,
      careerServicesImportance: `${answers.coopImportance}/5`,
      careerCultureImportance: `${answers.careerCultureImportance}/5`,
      careerCultureDescription: answers.careerCultureDescription || "Not specified",
      consideringGraduateSchool: answers.gradSchool,
      intendedGradSchoolTypes: answers.gradSchoolTypes.length > 0 ? answers.gradSchoolTypes.join(", ") : "N/A",
      interestedIndustries: answers.careers,
      alumniNetworkImportance: `${answers.alumniNetworkImportance}/5`,
      campusDiversityImportance: `${answers.campusDiversityImportance}/5`,
      campusLifeImportance: `${answers.campusLifeImportance}/5`,
      otherPriorities: answers.otherPriorities || "None",
    };

    const userContent = `RECOMMENDED TIER DISTRIBUTION FOR THIS STUDENT (profile: ${profileStrength}):
- Reach: ${tierDistribution.reach} schools
- High Match: ${tierDistribution.highMatch} schools
- Match: ${tierDistribution.match} schools
- Safety: ${tierDistribution.safety} schools
Total target: 16–20 schools. These are targets, not hard requirements — never pad a tier with low-quality or poor-fit schools just to hit the number. If fewer genuine fits exist for a tier, use fewer.

STUDENT TOP PRIORITIES (use these when writing the reason for each school):
${topPriorities.map(p => `- ${p}`).join("\n")}

STUDENT ACADEMIC PROFILE SUMMARY:
GPA: ${answers.gpa}/4.0
Test Scores: ${testInfo}
Intended Major: ${answers.major}
This student has ${profileStrength} academic credentials. Tier assignments must reflect this accurately.

Student Profile:
${JSON.stringify(studentProfile, null, 2)}

Colleges to choose from:
${JSON.stringify(collegesSlim, null, 2)}`;

    // Call OpenAI
    const message = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userContent },
      ],
    });

    // Extract and parse the response
    const responseText = message.choices[0]?.message?.content || "";

    if (!responseText) {
      return NextResponse.json(
        { error: "No response from OpenAI" },
        { status: 500 }
      );
    }

    // Strip markdown code fences before extracting JSON array
    const cleaned = responseText
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not find JSON in response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    const generatedList: GeneratedCollege[] = JSON.parse(jsonMatch[0]);

    // Validate the list
    if (!Array.isArray(generatedList) || generatedList.length === 0) {
      return NextResponse.json(
        { error: "Invalid college list format" },
        { status: 500 }
      );
    }

    // Reject hallucinated IDs — only keep colleges that were actually sent to the AI
    const validIds = new Set(collegesSlim.map(c => c.id));
    const validatedList = generatedList.filter(c => validIds.has(c.college_id));

    if (validatedList.length < 10) {
      console.error("AI returned too many invalid college references:", validatedList.length, "valid out of", generatedList.length);
      return NextResponse.json(
        { error: "AI returned too many invalid college references" },
        { status: 500 }
      );
    }

    await supabase.from("api_rate_limits").insert({ user_id: user.id, endpoint: "generate-list" });

    return NextResponse.json({ colleges: validatedList });
  } catch (error) {
    console.error("Error generating list:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate college list: ${errorMessage}` },
      { status: 500 }
    );
  }
}
