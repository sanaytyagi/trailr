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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { answers } = await req.json() as { answers: QuizAnswers };

    // Fetch all colleges from Supabase
    const supabase = await createClient();
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

    // Reduce to essential fields and cap at 150 to stay within token limits
    const collegesSlim = colleges
      .slice(0, 150)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        college_type: c.college_type,
        acceptance_rate: c.acceptance_rate,
      }));

    // Build student profile string for AI
    const testInfo = answers.testTypes.length === 0
      ? "Not taken"
      : answers.testTypes.map((t) =>
          t === "SAT" ? `SAT: ${answers.satScore ?? "score not provided"}`
                      : `ACT: ${answers.actScore ?? "score not provided"}`
        ).join(", ");

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

    // Call OpenAI
    const message = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a college admissions advisor. Select 18-20 colleges that best fit this student. Return ONLY a JSON array with no other text. Each college must have: college_id, name, tier (Reach/High Match/Match/Safety), and reason (1 sentence).

Student Profile:
${JSON.stringify(studentProfile, null, 2)}

Colleges to choose from:
${JSON.stringify(collegesSlim, null, 2)}

Return only the JSON array.`,
        },
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

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
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

    return NextResponse.json({ colleges: generatedList });
  } catch (error) {
    console.error("Error generating list:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate college list: ${errorMessage}` },
      { status: 500 }
    );
  }
}
