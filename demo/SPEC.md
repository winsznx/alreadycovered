GOAL: a viewer who has felt a last-minute sick-day scramble believes
AlreadyCovered removes it, and wants to try it — "I set this up once and it
stays ready" lands as the one thing to remember.

OUTPUT: HyperFrames, 1920x1080, 30fps
TIME: 180s x 30fps = 5400 frames. No music BPM lock (instrumental bed, not
beat-cut); shots are timed to the real UI actions they show, not a beat grid.

LOOK:
- Ground: #faf8f4 (warm off-white, the product's own --canvas) for every
  "world" shot; #201e1a (the product's own --ink) for the hook's dark
  bedroom-phone shot and the end card.
- Ink: #201e1a on #faf8f4; #faf8f4 on #201e1a. Secondary text #5c5950.
- Accent: #0f6e63 (verified teal) — one highlighted word or state per shot,
  rationed. #a3690f (review amber) and #a8341f (blocking red) appear only
  inside real product UI (status tags), never as a film graphic choice.
- Display face: Inter 600, title sizes 64-96px at 1920x1080 (3.3-5% of
  frame height), tracking -1%. Body/UI text: Inter 400/500, as captured
  (the product's own real sizes, never shrunk below 26px equivalent).
- Medium: real product screenshots (captured live from
  alreadycovered.vercel.app and the deployed app, see demo/landing-capture/
  and demo/landing-capture/app-screens/) composited into a browser-chrome-
  free "device" frame — a flat rounded-rect card with the product's own
  --shadow-floating (0 16px 32px rgba(32,30,26,.1)), never a literal OS
  window chrome. No 3D tilt on any screen.
- Grain 0%, vignette 0% (the product's look is flat and paper-like, a film
  grain or vignette would fight it). Phone shot: soft practical light only,
  no lens flare.

OBJECTS:
- The phone: a flat rounded-rect phone silhouette (not a literal stock
  photo), dark glass #0a0a0a bezel 6px, screen fills 86% of its face,
  status bar reads 6:02 with a real-style notification banner sliding from
  the top.
- The "device card": the real screenshots placed in a 1600x1000-equivalent
  rounded-rect (28px radius) card with --shadow-floating; this is the one
  recurring carrier the eye follows between worlds (phone screen -> laptop
  screen -> full-bleed app).
- The cursor: a single dark arrow cursor, 5% of frame width, used only in
  UI-interaction shots (upload, click include, click export); never shown
  during full-bleed screenshot pans.

MOTION:
- Enter: power2.out, 0.4-0.5s. Camera moves (push/pull on the device card):
  power2.inOut, 0.5-0.6s, with the card scaling 1.0->1.15 for a punch-in,
  never a CSS 3D tilt.
- Title text: no slide-up-and-fade; titles cut/scale in from 96% to 100%
  opacity+scale together over 0.25s, hold, then cut out (no drift after
  landing).
- Cursor moves: 0.3-0.4s power2.inOut per move, click = a 0.12s scale-down
  "press" on the cursor plus a 0.15s ring-pulse at the click point, then the
  UI's own real state changes on that same frame (per contract rule 1 — the
  cause and its effect land together).
- Springs: none (this is a calm, paper-flat product, not a playful one).

SHOTS (summary; exact frame ranges built in compositions/, each ~170 frames
average at 30fps for a 3-6s beat):

0:00-0:08 HOOK - dark bedroom, phone screen only. A text banner slides in:
  "Can't come in today - not feeling well." 6:02 AM. One soft chime.
0:08-0:18 TENSION - one line of real-world text over the still-dark phone
  world: "Normally: find the worksheet, write it all out, hope it's enough."
  No illustrated chaos scene — the line alone carries it (story.md: state,
  don't stage, what the source doesn't show).
0:18-0:26 REVEAL - cut to the warm #faf8f4 world. The AlreadyCovered
  wordmark + tagline types in (the product's own real H1 copy, verbatim
  from the captured site). "A substitute-teaching pack that's ready before
  a teacher needs a sick day."
0:26-0:34 CONTEXT - real landing-page screenshot, camera pushes past the
  hero mockup card into the live app.
0:34-0:58 PROOF 1: upload - real Sources screen, drag-drop, two real
  fixture files land, status flips to "Indexed" with the product's own
  teal check tag (grounded in the actual pipeline, not implied).
0:58-1:18 PROOF 2: auto-match + AI draft - real Dashboard, the two real
  lesson blocks, "generating..." live, then the real Packet page with the
  model's actual grounded step text visible and readable on screen
  (held long enough to read, not flashed).
1:18-1:36 PROOF 3: review - click "Include in handover", click "Mark
  reviewed" - the real status tag flips to "Reviewed" (teal), landing on
  the same frame as the click.
1:36-1:56 PAYOFF - click "Export PDF + resources"; cut to the real exported
  PDF, scrolled: schedule, grounded objective, cited source line, the
  substitute's end-of-day notes page. This is the biggest visual beat, once.
1:56-2:08 CLAIM - the one line, large, on #faf8f4: "Ready before you need
  it." (the one thing to remember, in the viewer's words, not the slogan).
2:08-2:20 PRIVACY LINE - one real, true sentence from the product's own
  copy: "Private to your account." No overclaim beyond what's shipped.
2:20-3:00 END CARD - #201e1a ground, the AlreadyCovered wordmark performed
  (a teal fill rises through it), then "Start free" as a real button shape
  matching the product's own pill CTA, held 2.5s.

BANNED: dark void with floating UI (every "world" shot has a real ground and
real light); glow/bloom/particles; purple-blue gradients/mesh/glass cards;
cream-serif-italic-"01/02"-monospace-pill look beyond what the product
itself already uses (the product's pills are real UI, not a film affectation
layered on top); everything centred/fading in at once; corner-docked logo
before the end card; three-card feature rows; a title over a dimmed
screenshot (every screenshot shown is sharp, full-opacity, read as itself).

QA: frame 0 (never black/logo-only — must read as a real phone+text, the
thumbnail test); the reveal frame (tagline fully legible, correct product
copy verbatim); the PROOF-2 frame where generated step text is on screen
(must be actual captured real text, not placeholder lorem); the payoff PDF
frame (real page content, legible); the end-card hold frame (CTA legible,
2.5s+).
