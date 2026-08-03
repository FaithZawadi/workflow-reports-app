import { templateByCode } from "./templates";

// Turn a report's stored payload ({ values, checks, grids, runs, weekly }) plus
// its template definition into a normalised, fully-itemised list of blocks — one
// per template section — so EVERYTHING captured on the form can be re-displayed:
// every field, every checklist row with its result & remark, calibration grids,
// load-cell readings and the weekly accuracy test. Shared by the on-screen
// dashboard, the management-report appendix, the client statement and any PDF so
// they all expand a report identically.

// The states for a checklist section: an explicit list, or the yes/no pair.
// The FIRST state is the "good" one; anything else is a flagged finding.
function statesOf(sec) {
  if (Array.isArray(sec?.states) && sec.states.length) return sec.states;
  return [
    { key: "ok", label: sec?.yes || "OK" },
    { key: "problem", label: sec?.no || "NO" },
  ];
}

const humanize = (k) => String(k || "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
const clean = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const isNumericCol = (c) => /kg|mv|ohm|%|error|reading|load|division|no\.?$|qty|mass|weight|output|impedance/i.test(String(c || ""));

// One report → { blocks, photoCount, filledCount }.
export function itemizeReport(report) {
  const tpl = templateByCode(report.template);
  const data = report.data || {};
  const values = data.values || {};
  const checks = data.checks || {};
  const grids = data.grids || {};
  const runs = data.runs || {};
  const sections = tpl?.sections || [];

  const blocks = [];
  let filledCount = 0;
  const seenKeys = new Set(["weighbridgeId"]);

  sections.forEach((sec, si) => {
    if (sec.type === "fields") {
      const entries = (sec.fields || [])
        .map((f) => {
          seenKeys.add(f.k);
          const v = clean(values[f.k]);
          if (v) filledCount += 1;
          return { label: f.label || humanize(f.k), value: v };
        })
        .filter((e) => e.value !== "");
      if (entries.length) blocks.push({ kind: "fields", title: sec.title || "Details", entries });
    } else if (sec.type === "textarea") {
      seenKeys.add(sec.k);
      const v = clean(values[sec.k]);
      if (v) {
        filledCount += 1;
        blocks.push({ kind: "note", title: sec.label || humanize(sec.k), value: v });
      }
    } else if (sec.type === "choices") {
      seenKeys.add(sec.k);
      const v = clean(values[sec.k]);
      if (v) {
        filledCount += 1;
        blocks.push({ kind: "choice", title: sec.title || humanize(sec.k), value: v });
      }
    } else if (sec.type === "checklist") {
      const states = statesOf(sec);
      const goodKey = states[0]?.key;
      const items = (sec.items || []).map((item, ii) => {
        const v = checks[`${si}:${ii}`];
        const state = v?.state || null;
        const label = state ? states.find((s) => s.key === state)?.label || state : null;
        if (state) filledCount += 1;
        return {
          item,
          answered: !!state,
          ok: state ? state === goodKey : null,
          result: label,
          remark: clean(v?.remark),
        };
      });
      if (items.some((i) => i.answered || i.remark)) {
        const flagged = items.filter((i) => i.answered && !i.ok).length;
        blocks.push({ kind: "checklist", title: sec.title || "Checklist", states: states.map((s) => s.label), items, flagged });
      }
    } else if (sec.type === "weekly") {
      const w = data.weekly;
      const rows = ["1", "2"].map((r, idx) => ({
        run: `Run ${r}`,
        a: clean(runs[`${r}a`]),
        m: clean(runs[`${r}m`]),
        b: clean(runs[`${r}b`]),
        diff: w?.diffs?.[idx] == null ? "" : String(w.diffs[idx]),
      }));
      if (rows.some((r) => r.a || r.m || r.b)) {
        rows.forEach((r) => { if (r.a || r.m || r.b) filledCount += 1; });
        blocks.push({
          kind: "weekly",
          title: "Weekly End–Middle–End accuracy test",
          limit: w?.limit ?? clean(values.limit),
          worst: w?.worst ?? null,
          pass: w?.pass ?? null,
          rows,
        });
      }
    } else if (sec.type === "loadcells") {
      const unit = grids.lcUnit === "ohm" ? "Impedance (Ohm)" : "Output (mV)";
      const lc = Array.from({ length: 8 }, (_, i) => clean(grids[`lc:${i}`]));
      const corner = Array.from({ length: 8 }, (_, i) => clean(grids[`corner:${i}`]));
      if (lc.some(Boolean) || corner.some(Boolean)) {
        filledCount += 1;
        blocks.push({
          kind: "loadcells",
          title: "Load-cell readings",
          cols: Array.from({ length: 8 }, (_, i) => `Cell ${i + 1}`),
          rows: [
            { label: unit, cells: lc },
            { label: "Corner (kg)", cells: corner },
          ],
        });
      }
    } else if (sec.type === "rows") {
      const cols = sec.cols || [];
      const body = [];
      for (let ri = 0; ri < (sec.rows || 0); ri++) {
        const row = cols.map((c, ci) => clean(grids[`${sec.key}:${ri}:${ci}`] ?? (sec.prefill?.[ri]?.[ci] || "")));
        if (row.some((cell) => cell !== "")) body.push(row);
      }
      if (body.length) {
        filledCount += body.length;
        blocks.push({
          kind: "grid",
          title: sec.title || "Measurements",
          cols,
          numericCols: cols.map(isNumericCol),
          rows: body,
        });
      }
    }
  });

  // Any stored values not tied to a known section (defensive — never drop data).
  const extras = Object.entries(values)
    .filter(([k, v]) => !seenKeys.has(k) && clean(v) !== "")
    .map(([k, v]) => ({ label: humanize(k), value: clean(v) }));
  if (extras.length) {
    filledCount += extras.length;
    blocks.push({ kind: "fields", title: "Other entries", entries: extras });
  }

  const photoCount = report._count?.photos ?? (Array.isArray(report.photos) ? report.photos.length : 0);
  return { blocks, photoCount, filledCount };
}

// A compact one-line summary of what a checklist/measurement report captured —
// handy for register subtitles. e.g. "18 checks · 2 flagged · 3 readings".
export function itemizeSummary(report) {
  const { blocks, photoCount } = itemizeReport(report);
  const parts = [];
  let checks = 0;
  let flagged = 0;
  let measures = 0;
  for (const b of blocks) {
    if (b.kind === "checklist") { checks += b.items.filter((i) => i.answered).length; flagged += b.flagged; }
    else if (b.kind === "grid") measures += b.rows.length;
    else if (b.kind === "loadcells") measures += 1;
  }
  if (checks) parts.push(`${checks} check${checks === 1 ? "" : "s"}`);
  if (flagged) parts.push(`${flagged} flagged`);
  if (measures) parts.push(`${measures} reading${measures === 1 ? "" : "s"}`);
  if (photoCount) parts.push(`${photoCount} photo${photoCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
