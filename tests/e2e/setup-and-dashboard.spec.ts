import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const FIXTURE_ROOT = resolve(process.cwd(), "fixtures", "permitted-sample-files");

test("first-run setup through dashboard with real fixture files", async ({ page }) => {
  // #given a fresh install with no profile configured yet
  await page.goto("/");

  // #when the teacher completes first-run setup with a real, permitted folder
  await expect(page.getByText("Set up AlreadyCovered")).toBeVisible();
  await page.getByPlaceholder("/Users/you/Documents/Teaching").fill(FIXTURE_ROOT);
  await page.getByRole("button", { name: "Validate folder" }).click();

  await expect(page.getByText("2. Your class")).toBeVisible();
  await page.getByPlaceholder("Grade 4A").fill("Grade 4A");
  await page.getByPlaceholder("4", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("3. Weekly schedule")).toBeVisible();
  await page.getByPlaceholder("Subject").fill("Mathematics");
  await page.getByRole("button", { name: "Finish setup" }).click();

  // #then the dashboard loads, showing the configured class is prepared locally
  await page.waitForURL("**/#/");
  await expect(page.getByText("Substitute preparation")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Prepared locally")).toBeVisible();
});

test("sources page lists indexed fixture files after a scan", async ({ page }) => {
  // #given setup has already run (re-uses the previous test's server-side state within this spec file)
  await page.goto("/#/sources");

  // #when the sources page loads
  // #then the real fixture files that were scanned are listed (not placeholders)
  await expect(page.getByText("fractions-worksheet.pdf")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("reading-chapter6-notes.docx")).toBeVisible();
});
