import { describe, expect, it } from "vitest";
import { LessonDraftSchema } from "@alreadycovered/shared";

describe("LessonDraftSchema", () => {
  it("accepts a well-formed draft", () => {
    // #given a draft matching the contract exactly
    const draft = {
      lessonTitle: "Fractions",
      summary: "Students build fractions from unit fractions.",
      steps: ["Distribute worksheet.", "Review as a class."],
      citedChunkIds: ["chunk_1"],
      requiredMaterialIds: ["file_1"],
      unansweredQuestions: [],
    };
    // #when / #then parsing succeeds
    expect(LessonDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("rejects a draft with an unknown extra field (strict mode)", () => {
    // #given a draft the model wrapped in an extra "confidence" field
    const draft = {
      lessonTitle: "Fractions",
      summary: "Students build fractions from unit fractions.",
      steps: ["Distribute worksheet."],
      citedChunkIds: [],
      requiredMaterialIds: [],
      unansweredQuestions: [],
      confidence: 0.97,
    };
    // #when / #then parsing fails because confidence is not part of the contract
    expect(LessonDraftSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects a draft with zero steps", () => {
    // #given a draft with an empty steps array
    const draft = {
      lessonTitle: "Fractions",
      summary: "Summary.",
      steps: [],
      citedChunkIds: [],
      requiredMaterialIds: [],
      unansweredQuestions: [],
    };
    // #when / #then parsing fails (min 1 step required)
    expect(LessonDraftSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects a draft missing a required field", () => {
    // #given a draft with no lessonTitle
    const draft = {
      summary: "Summary.",
      steps: ["Step one."],
      citedChunkIds: [],
      requiredMaterialIds: [],
      unansweredQuestions: [],
    };
    // #when / #then parsing fails
    expect(LessonDraftSchema.safeParse(draft).success).toBe(false);
  });
});
