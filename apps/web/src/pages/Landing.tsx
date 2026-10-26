import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { FaqItem } from "../components/marketing/FaqItem";
import { FeatureCard } from "../components/marketing/FeatureCard";
import { HeroMockupCard } from "../components/marketing/HeroMockupCard";
import { SectionHeading } from "../components/marketing/SectionHeading";
import { StepCard } from "../components/marketing/StepCard";

/**
 * Scrolls to an in-page section by id. Plain anchor hrefs (#features) are
 * avoided deliberately: this app uses HashRouter, so a literal `href="#features"`
 * would be read as a route change (to "/features") rather than an in-page scroll.
 */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const FEATURES = [
  {
    title: "Upload and index your lesson files",
    description: "PDF, DOCX, TXT, and Markdown files are indexed with page- and section-level provenance, so every citation points to a real place in a real document.",
    icon: "☰",
  },
  {
    title: "AI-drafted substitute instructions",
    description: "Gemma inference turns your lesson notes into clear, substitute-facing steps, grounded only in the material you provided - never invented.",
    icon: "✎",
  },
  {
    title: "Review and correct in one place",
    description: "Every AI-authored line is distinguishable from your own edits. Reject a match, link a different file, or rewrite a step - your corrections are preserved.",
    icon: "✓",
  },
  {
    title: "Real PDF + ZIP export",
    description: "A printable, ink-friendly PDF and a ZIP of the approved worksheets with a checksummed manifest - nothing sent anywhere, a file you control.",
    icon: "⬇",
  },
  {
    title: "Change tracking",
    description: "Edit a worksheet after you've reviewed a packet and the affected lesson is marked outdated automatically, instead of silently going stale.",
    icon: "↻",
  },
  {
    title: "Honest gaps, not guesses",
    description: "Missing or ambiguous material is flagged clearly with an action to resolve it - the app never fabricates a worksheet, a date, or a safety procedure.",
    icon: "⚠",
  },
];

const STEPS = [
  { title: "Upload your lesson files", description: "Add the worksheets and lesson notes you already have for your class." },
  { title: "Set your weekly schedule", description: "Tell AlreadyCovered your class periods once; it reuses them every week." },
  { title: "Review the draft packet", description: "See what's ready, what's missing, and exactly which file backs each instruction." },
  { title: "Export when you need it", description: "One click produces a real, printable PDF and a ZIP of the approved materials." },
];

const FAQS = [
  {
    q: "Who can see my files?",
    a: "Only you. Your uploads and generated packets are private to your account, stored separately from every other teacher's. Nothing is sold to advertisers, used to train external models, or shared with your school automatically - and the app never collects student-roster or grade-book data.",
  },
  {
    q: "What file types are supported?",
    a: "PDF (with a real text layer), DOCX, TXT, and Markdown. A scanned or image-only PDF is flagged as “no readable text” rather than guessed at.",
  },
  {
    q: "What happens if a worksheet is missing?",
    a: "The lesson is marked “needs attention” with a plain-language reason. The app never invents a substitute worksheet or a page number - you link the right file or leave it clearly noted as missing in the export.",
  },
  {
    q: "Can I edit what the AI drafted?",
    a: "Yes. Every instruction is editable, and your edit is preserved - re-generating a stale lesson after a file change never silently overwrites your correction.",
  },
  {
    q: "Is this free?",
    a: "You can start for free. See the app for current plan details.",
  },
];

export function Landing() {
  return (
    <div className="bg-canvas">
      <header className="sticky top-0 z-50 border-b border-transparent bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-ink">AlreadyCovered</span>
          <nav className="hidden items-center gap-8 text-sm text-ink-secondary sm:flex">
            <button type="button" className="transition-colors duration-150 hover:text-ink" onClick={() => scrollToSection("features")}>
              Features
            </button>
            <button type="button" className="transition-colors duration-150 hover:text-ink" onClick={() => scrollToSection("how-it-works")}>
              How it works
            </button>
            <button type="button" className="transition-colors duration-150 hover:text-ink" onClick={() => scrollToSection("faq")}>
              FAQ
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink">
              Log in
            </Link>
            <Link to="/signup">
              <Button variant="primary" pill className="text-sm">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* 1. Hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-start gap-10 px-6 py-14 md:flex-row md:items-center md:py-20">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-secondary">
              For teachers who prep their own sub plans
            </span>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              A substitute-teaching pack that&rsquo;s ready before a teacher needs a sick day.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              AlreadyCovered keeps a source-linked substitute packet current from the lesson files you
              already have, so an unplanned absence doesn&rsquo;t mean rebuilding tomorrow&rsquo;s
              lessons from scratch while you&rsquo;re unwell.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button variant="primary" size="lg" pill>
                  Start free
                </Button>
              </Link>
              <Button variant="secondary" size="lg" pill onClick={() => scrollToSection("how-it-works")}>
                See how it works
              </Button>
            </div>
          </div>
          <div className="flex w-full justify-center md:justify-end">
            <HeroMockupCard />
          </div>
        </section>

        {/* 2. Solutions / problem */}
        <section className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeading
            eyebrow="The problem"
            title={
              <>
                Sub plans get assembled at the worst possible moment<span className="text-ink-muted">.</span>
              </>
            }
            description="Most sub-plan tools still need you to gather context and assemble resources once an absence is already happening. AlreadyCovered keeps the draft current in advance, so there's less to do when you're least able to do it."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-panel border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Before</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Hunt down the right worksheet, retype routines from memory, and hope the sub can follow notes written in a hurry.
              </p>
            </div>
            <div className="rounded-panel border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-ink">During</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                AlreadyCovered has already drafted instructions from your real files and flagged what it couldn't confirm.
              </p>
            </div>
            <div className="rounded-panel border border-verified bg-verified-soft p-5">
              <p className="text-sm font-semibold text-verified">Now</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Review what's flagged, approve the materials to include, and export a packet that's actually usable.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Why it matters */}
        <section className="bg-surface-muted py-14">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading eyebrow="Why it works this way" title="Grounded by construction, not by hope" centered />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="rounded-panel border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-ink">Every claim traces to a source</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  The model is only ever shown excerpts from your own indexed files and can only cite IDs it was actually
                  given. Anything it cites outside that set is stripped before you ever see it.
                </p>
              </article>
              <article className="rounded-panel border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-ink">Missing means flagged, not filled in</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  No worksheet, no safety procedure, and no lesson date is ever invented. If the material isn't there, you
                  see an honest "needs attention" instead of a confident-sounding guess.
                </p>
              </article>
              <article className="rounded-panel border border-border bg-surface p-6">
                <h3 className="text-base font-semibold text-ink">Your corrections stick</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Edit a step, reject a match, or confirm a routine - your changes are preserved across regeneration, and a
                  reviewed packet is only ever "reviewed" for the exact version you approved.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 4. Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeading eyebrow="What's included" title="Everything the handover actually needs" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} />
            ))}
          </div>
        </section>

        {/* 5. How it works */}
        <section id="how-it-works" className="bg-surface-muted py-14">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading eyebrow="How it works" title="From lesson files to a finished packet" centered />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <StepCard key={step.title} index={index + 1} title={step.title} description={step.description} />
              ))}
            </div>
          </div>
        </section>

        {/* 6. FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeading eyebrow="Questions" title="Good questions, honest answers" centered />
          <div className="mt-8 space-y-3">
            {FAQS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-ink px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Get tomorrow's sub plan ready today.</h2>
            <p className="max-w-md text-sm leading-relaxed text-white/70">
              Set up your class once. Keep a ready packet without thinking about it again.
            </p>
            <Link to="/signup">
              <Button variant="secondary" size="lg" pill className="bg-white text-ink hover:bg-white/90">
                Start free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-ink-muted sm:flex-row">
          <span>AlreadyCovered</span>
          <span>Built for teachers who already do this work by hand.</span>
        </div>
      </footer>
    </div>
  );
}
