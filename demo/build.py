"""Builds film/index.html from the voiceover timings, word transcripts and real product screenshots."""
import html
import json
import pathlib

import soundfile as sf

ROOT = pathlib.Path(__file__).parent
FILM = ROOT
W, H = 1920, 1080
INTRO = 0.15          # dark hook holds before the first word
LEAD = 0.3           # silence before each scene's voice
TAIL = 0.45          # breath after each scene's voice
OUTRO = 3.0           # end card hold after the last line

SCENES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]
# extra hold per scene, beyond voice + tail, so real on-screen UI text is
# actually readable rather than flashed (QA rule: "held long enough to read")
HOLD = {"s1": 0.3, "s2": 0.4, "s3": 1.3, "s4": 1.2, "s5": 2.3, "s6": 3.8,
        "s7": 2.2, "s8": 2.3, "s9": 2.8, "s10": 0.8, "s11": 0.0}

# ---------------------------------------------------------------- timing
timing = []
t = 0.0
for i, sid in enumerate(SCENES):
    info = sf.info(str(FILM / "assets" / f"vo_{sid}.wav"))
    vo = info.frames / info.samplerate
    start = t
    vo_start = start + (INTRO if i == 0 else 0) + LEAD
    dur = (vo_start - start) + vo + TAIL + HOLD[sid] + (OUTRO if sid == "s11" else 0)
    timing.append({"id": sid, "start": round(start, 3), "dur": round(dur, 3), "vo_start": round(vo_start, 3), "vo": round(vo, 3)})
    t = start + dur
TOTAL = round(t, 3)
(ROOT / "timing.json").write_text(json.dumps(timing, indent=1))
T = {s["id"]: s for s in timing}

# ---------------------------------------------------------------- captions
def words_for(sid):
    raw = json.loads((ROOT / "words" / f"{sid}.json").read_text())
    words = raw if isinstance(raw, list) else raw.get("words", [])
    out = []
    i = 0
    while i < len(words):
        w = dict(words[i])
        txt = w["text"].strip()
        nxt = words[i + 1]["text"].strip() if i + 1 < len(words) else ""
        # Whisper mis-hears this one brand name as two lowercase words, and
        # splits a synthesized "6:02 AM" into stray-period digit tokens.
        if txt.lower() == "already" and nxt.lower().startswith("covered"):
            w["text"] = "AlreadyCovered" + nxt[len("covered"):]
            w["end"] = words[i + 1]["end"]
            i += 1
        elif txt == "6" and nxt == ".02":
            w["text"] = "6:02"
            w["end"] = words[i + 1]["end"]
            i += 1
        elif txt == "a" and nxt.lower() == ".m.":
            w["text"] = "AM"
            w["end"] = words[i + 1]["end"]
            i += 1
        else:
            w["text"] = txt
        if w["text"]:
            out.append(w)
        i += 1
    return out


def groups_for(words, max_words=6):
    groups, cur = [], []
    for j, w in enumerate(words):
        cur.append(w)
        gap = (words[j + 1]["start"] - w["end"]) if j + 1 < len(words) else 9
        punct = w["text"][-1:] in ".,?!:;"
        if len(cur) >= max_words or gap >= 0.15 or (punct and len(cur) >= 3) or w["text"][-1:] in ".?!":
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return groups


caption_html = []
caption_js = []
gid = 0
for sid in SCENES:
    base = T[sid]["vo_start"]
    gs = groups_for(words_for(sid))
    for k, g in enumerate(gs):
        start = base + g[0]["start"] - 0.06
        end = base + g[-1]["end"] + 0.12
        if k + 1 < len(gs):
            end = min(end, base + gs[k + 1][0]["start"] - 0.06)
        start, end = round(start, 3), round(end, 3)
        spans = []
        for wi, w in enumerate(g):
            wid = f"c{gid}w{wi}"
            spans.append(f'<span id="{wid}" class="w">{html.escape(w["text"])}</span>')
            caption_js.append(f'tl.to("#{wid}", {{ color: "#0F6E63", duration: 0.12, ease: "none" }}, {round(base + w["start"], 3)});')
        caption_html.append(
            f'<div id="cap{gid}" class="clip cap" data-start="{start}" data-duration="{round(end - start, 3)}" data-track-index="20"><span class="cap-inner">{" ".join(spans)}</span></div>'
        )
        caption_js.append(f'tl.fromTo("#cap{gid} .cap-inner", {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }}, {start});')
        gid += 1

# ---------------------------------------------------------------- visuals
def device(img, cls="card", ident=""):
    return f'<div class="device {cls}" id="{ident}"><img src="assets/shots/{img}.png" alt=""></div>'


def phoneshell(ident, cls=""):
    return f'<div class="phoneshell {cls}" id="{ident}"><div class="notch"></div><div class="statusbar" data-layout-ignore><span>6:02</span></div><div class="msg" id="{ident}-msg"><span class="msg-from">Jordan (sub coordinator)</span><span class="msg-body">Can&rsquo;t come in today &ndash; not feeling well.</span></div></div>'


def scene(sid, label, title, body, visual, dark=False, hold_stage=False):
    s = T[sid]
    extra = " dark" if dark else ""
    hold_attr = " data-hold" if hold_stage else ""
    return f'''
      <section id="{sid}" class="clip scene{extra}" data-start="{s["start"]}" data-duration="{s["dur"]}" data-track-index="2">
        <div class="copy" id="{sid}-copy">
          <p class="label" data-layout-ignore>{label}</p>
          <h2>{title}</h2>
          {f'<p class="body">{body}</p>' if body else ""}
        </div>
        <div class="stage" id="{sid}-stage"{hold_attr}>{visual}</div>
      </section>'''


scenes_html = []
anim = []
presets = []


def at(sid, frac):
    s = T[sid]
    return round(s["vo_start"] + s["vo"] * frac - s["start"], 3)


def enter(selector, local_t, sid, dy=28):
    presets.append(f'gsap.set("{selector}", {{ opacity: 0 }});')
    anim.append(f'tl.fromTo("{selector}", {{ opacity: 0, y: {dy} }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }}, {round(T[sid]["start"] + local_t, 3)});')


def swap(out_sel, in_sel, local_t, sid):
    g = round(T[sid]["start"] + local_t, 3)
    anim.append(f'tl.to("{out_sel}", {{ opacity: 0, duration: 0.4, ease: "power2.inOut" }}, {g});')
    anim.append(f'tl.fromTo("{in_sel}", {{ opacity: 0, scale: 0.99 }}, {{ opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }}, {g});')


def copy_in(sid):
    enter(f"#{sid}-copy", 0.12 + (INTRO if sid == "s1" else 0), sid, 20)


# s1: hook - dark bedroom, phone, real-style text notification.
# The message is the thumbnail: it must read immediately at frame 0, not
# fade in from nothing (see SPEC QA: "never black/logo-only").
scenes_html.append(scene("s1", "", "", "", phoneshell("s1-phone"), dark=True))

# s2: tension - still dark, one honest line, no illustrated chaos
scenes_html.append(scene("s2", "", 'Normally: find the worksheet, write it out by hand, hope it’s enough.', "", "", dark=True))
copy_in("s2")

# s3: reveal - real landing hero, real H1 verbatim
scenes_html.append(scene("s3", "AlreadyCovered", "A substitute-teaching pack that’s ready before a teacher needs a sick day.", "",
    device("01-landing-hero", "card wide", "s3-a")))
copy_in("s3")
enter("#s3-a", 0.5, "s3")

# s4: context - she set it up once (real setup screens)
scenes_html.append(scene("s4", "Set up once", "Her class, her weekly schedule — nothing more to maintain.", "",
    device("03-setup-class", "card", "s4-a") + device("04-schedule", "card stacked", "s4-b")))
copy_in("s4")
enter("#s4-a", 0.4, "s4")
swap("#s4-a", "#s4-b", at("s4", 0.55), "s4")

# s5: proof 1 - upload + index
scenes_html.append(scene("s5", "Upload", "A worksheet, her chapter notes — indexed page by page.", "",
    device("05-sources-empty", "card", "s5-a") + device("06-sources-indexed", "card stacked", "s5-b")))
copy_in("s5")
enter("#s5-a", 0.4, "s5")
swap("#s5-a", "#s5-b", at("s5", 0.5), "s5")

# s6: proof 2 - generation, real grounded draft text
scenes_html.append(scene("s6", "AI-drafted, grounded", "Substitute-facing steps, written from that material alone.", "",
    device("07-dashboard-generating", "card", "s6-a") + device("09-packet-ready", "card stacked", "s6-b")))
copy_in("s6")
enter("#s6-a", 0.4, "s6")
swap("#s6-a", "#s6-b", at("s6", 0.45), "s6")

# s7: grounding - real honest-gap copy
scenes_html.append(scene("s7", "Grounded by construction", "Every citation points to a real page.", "What it can’t confirm stays flagged — never invented.", '''
  <div class="facts" id="s7-facts">
    <div class="fact" id="s7-1"><strong>Cited</strong><span>Only excerpts from the teacher’s own indexed files</span></div>
    <div class="fact" id="s7-2"><strong>Flagged</strong><span>Missing material shown as "needs attention," not filled in</span></div>
    <div class="fact" id="s7-3"><strong>Yours</strong><span>Corrections persist across every regeneration</span></div>
  </div>''', hold_stage=True))
copy_in("s7")
for n, frac in enumerate([0.15, 0.45, 0.75], start=1):
    enter(f"#s7-{n}", at("s7", frac), "s7", 24)

# s8: proof 3 - review and approve
scenes_html.append(scene("s8", "Review", "Approve the material. Mark it reviewed.", "",
    device("11-materials-approved", "card", "s8-a") + device("12-reviewed", "card stacked", "s8-b")))
copy_in("s8")
enter("#s8-a", 0.4, "s8")
swap("#s8-a", "#s8-b", at("s8", 0.55), "s8")

# s9: payoff - real export, real PDF + ZIP links
scenes_html.append(scene("s9", "Export", "A real PDF, a real ZIP — nothing sent anywhere.", "",
    device("13-exported", "card wide", "s9-a"), hold_stage=True))
copy_in("s9")
enter("#s9-a", 0.4, "s9")

# s10: claim
scenes_html.append(scene("s10", "", "Ready before she needs it.", "", ""))
copy_in("s10")

# s11: end card
scenes_html.append(scene("s11", "", "", "", '''
  <div class="endcard" id="s11-end">
    <span class="endcard-name">AlreadyCovered</span>
    <p class="endcard-line">Private to your account.</p>
    <span class="endcard-cta">Start free</span>
  </div>''', dark=True))
enter("#s11-end", 0.3, "s11")

audio_html = "\n".join(
    f'      <audio id="vo{i + 1}" src="assets/vo_{s["id"]}.wav" data-start="{s["vo_start"]}" data-duration="{s["vo"]}" data-track-index="11" data-volume="1"></audio>'
    for i, s in enumerate(timing)
)

page = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Inter"; src: url("assets/fonts/Inter-Variable.woff2") format("woff2"); font-weight: 400 700; }}
      :root {{
        --canvas: #faf8f4; --surface: #ffffff; --surface-muted: #f2efe7; --border: #e5e1d6;
        --ink: #201e1a; --ink-2: #5c5950; --ink-muted: #8c8878;
        --verified: #0f6e63; --verified-soft: #e4f3f0; --review: #a3690f; --review-soft: #faf0dd;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: var(--canvas); }}
      #root {{ position: relative; width: {W}px; height: {H}px; font-family: "Inter", sans-serif; color: var(--ink); background: var(--canvas); }}
      .scene {{ position: absolute; inset: 0; }}
      .scene.dark {{ background: var(--ink); color: var(--canvas); }}
      .copy {{ position: absolute; left: 110px; top: 160px; width: 480px; }}
      .label {{ font-size: 22px; font-weight: 600; color: var(--verified); margin-bottom: 18px; display: inline-flex; align-items: center; gap: 10px; letter-spacing: 0.01em; }}
      .label:not(:empty)::before {{ content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--verified); box-shadow: 0 0 0 5px var(--verified-soft); }}
      .dark .label::before {{ box-shadow: 0 0 0 5px rgba(15,110,99,.3); }}
      h2 {{ font-size: 54px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 600; }}
      .body {{ margin-top: 22px; font-size: 28px; line-height: 1.4; color: var(--ink-2); }}
      .dark .body {{ color: #c9c6bd; }}
      .stage {{ position: absolute; left: 640px; top: 90px; width: 1160px; height: 790px; }}
      .device {{ position: absolute; inset: 0; border-radius: 18px; overflow: hidden; background: var(--surface); box-shadow: 0 16px 32px rgba(32,30,26,.1); border: 1px solid var(--border); }}
      .device img {{ display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; }}
      .device.wide {{ top: 40px; height: 700px; }}
      .device.stacked {{ opacity: 0; }}
      /* s1: dark hook phone */
      .phoneshell {{ position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 440px; height: 900px; border-radius: 56px; background: #0a0a0a; border: 6px solid #0a0a0a; box-shadow: 0 40px 90px -30px rgba(0,0,0,.6); }}
      .phoneshell .notch {{ position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 160px; height: 28px; background: #0a0a0a; border-radius: 0 0 16px 16px; z-index: 2; }}
      .phoneshell .statusbar {{ position: absolute; left: 0; right: 0; top: 36px; text-align: center; font-size: 20px; font-weight: 600; color: #fff; letter-spacing: 0.02em; }}
      .phoneshell .msg {{ position: absolute; left: 24px; right: 24px; top: 110px; background: #1c1c1e; border-radius: 20px; padding: 24px 26px; display: grid; gap: 10px; }}
      .msg-from {{ font-size: 28px; color: #9b9b9f; font-weight: 500; }}
      .msg-body {{ font-size: 28px; color: #fff; line-height: 1.4; font-weight: 500; }}
      .facts {{ position: absolute; left: 0; top: 60px; width: 100%; display: grid; gap: 28px; }}
      .fact {{ background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 32px 36px; box-shadow: 0 16px 32px rgba(32,30,26,.08); }}
      .fact strong {{ display: block; font-size: 30px; font-weight: 600; color: var(--verified); margin-bottom: 10px; }}
      .fact span {{ font-size: 28px; line-height: 1.4; color: var(--ink-2); }}
      .endcard {{ position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 28px; text-align: center; }}
      .endcard-name {{ font-size: 86px; font-weight: 600; letter-spacing: -0.03em; }}
      .endcard-line {{ font-size: 28px; color: #c9c6bd; }}
      .endcard-cta {{ margin-top: 10px; font-size: 28px; font-weight: 600; color: var(--ink); background: var(--canvas); padding: 18px 44px; border-radius: 999px; }}
      #captions {{ position: absolute; left: 0; right: 0; bottom: 0; height: 160px; z-index: 40; }}
      .cap {{ position: absolute; left: 0; right: 0; bottom: 64px; text-align: center; }}
      .cap-inner {{ display: inline-block; font-size: 38px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; color: #3a382f; background: rgba(255,255,255,.94); padding: 10px 26px 13px; border-radius: 16px; box-shadow: 0 8px 22px -10px rgba(32,30,26,.3); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
{"".join(scenes_html)}
      <div id="captions" class="clip" data-start="0" data-duration="{TOTAL}" data-track-index="19" data-track-kind="captions" data-layout-allow-overlap>
        {"".join(caption_html)}
      </div>
{audio_html}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      {chr(10).join("      " + p for p in presets)}
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join("      " + a for a in anim)}
      {chr(10).join("      " + c for c in caption_js)}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
(FILM / "index.html").write_text(page)
print(f"total {TOTAL}s, {gid} caption groups, {len(anim)} scene tweens")
