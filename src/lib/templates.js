// The QSL weighbridge maintenance form catalogue.
// Codes and content mirror the printed QSL/F/WB-01..06 sheets.

export const TECH_TEMPLATES = ["WB01", "WB02", "WB03"];
export const ENGINEER_TEMPLATES = ["WB04", "WB05", "WB06"];

export const TEMPLATES = [
  {
    code: "WB01",
    name: "Daily Site Check",
    who: "Site Technician",
    desc: "Quick morning walk-around. Mark each line OK or report a problem.",
    sections: [
      {
        type: "checklist",
        title: "Walk around and check",
        items: [
          "Deck top is clean - no mud, stones or rubbish",
          "Gaps around the deck are clear - nothing stuck inside",
          "Under the deck: no rubbish, no water",
          "Rubber seals (T-seals) in place; nothing trapped behind",
          "Nothing touching or blocking the load cells",
          "Rain water drains away - no standing water",
          "No broken parts: deck, ramps, rails, bumpers",
          "Cables look OK - not cut, not chewed by rats",
          "Screen shows 0 when the deck is empty",
          "Printer works and has paper",
          "Traffic light / barrier / camera works (if fitted)",
          "No truck left parked on the deck",
        ],
      },
      { type: "textarea", k: "notes", label: "Anything else you saw today" },
    ],
  },
  {
    code: "WB02",
    name: "Weekly Accuracy Check",
    who: "Site Technician",
    desc: "End-Middle-End test with the same loaded truck.",
    sections: [
      {
        type: "fields",
        fields: [
          { k: "truck", label: "Truck used (reg. no.)" },
          { k: "truckWeight", label: "Truck weight (about, kg)", inputType: "number" },
          { k: "limit", label: "Limit for this weighbridge (kg) - ask supervisor", inputType: "number" },
        ],
      },
      { type: "weekly" },
      {
        type: "checklist",
        title: "Zero check",
        yes: "YES",
        no: "NO",
        items: [
          "Screen shows 0 every time the truck drives off",
          "Screen stays at 0 with the deck empty (5 minutes)",
        ],
      },
    ],
  },
  {
    code: "WB03",
    name: "Monthly Maintenance",
    who: "Site Technician",
    desc: "Cleaning and inspection. Never spray water at load cells or the junction box.",
    sections: [
      {
        type: "checklist",
        title: "Cleaning",
        yes: "DONE",
        no: "NEEDS ATTENTION",
        items: [
          "Washed the deck top - removed mud, stones, spillage",
          "Cleared under the deck (water kept away from load cells / junction box)",
          "Cleared gaps, rubber seals and drains",
        ],
      },
      {
        type: "checklist",
        title: "Look and check",
        items: [
          "Deck has not moved or shifted",
          "Bolts tight - none loose or missing",
          "No cracks, bends or heavy rust",
          "Cables OK all along - no cuts, no rat damage",
          "Junction box closed, dry, not damaged",
          "Earth wire (lightning wire) connected",
        ],
      },
      {
        type: "checklist",
        title: "Do",
        yes: "DONE",
        no: "NEEDS ATTENTION",
        items: [
          "Pressed ZERO with deck empty and clean",
          "Did the weekly accuracy test (submit WB02 too)",
          "Compared with last month - told supervisor of changes",
        ],
      },
      { type: "textarea", k: "notes", label: "Anything else you saw this month" },
    ],
  },
  {
    code: "WB04",
    name: "Engineer Service Checklist",
    who: "QSL Engineer",
    desc: "Quarterly / bi-annual service inspection.",
    sections: [
      {
        type: "fields",
        fields: [
          { k: "make", label: "Make / model" },
          { k: "serialNo", label: "Serial no." },
          { k: "capacity", label: "Capacity / division" },
          { k: "jobRef", label: "Job / contract ref." },
        ],
      },
      {
        type: "checklist",
        title: "As-found condition",
        yes: "OK",
        no: "ATTN",
        items: [
          "Deck, foundation and approaches inspected; defects recorded",
          "Deck free-moving; expansion gaps and clearances correct",
          "Load cell mountings, links and bases seated and secure",
          "Junction box dry, terminations tight; insulation resistance OK",
          "Indicator diagnostics reviewed; error log recorded",
          "Surge / lightning protection intact; earthing secure",
        ],
      },
      { type: "loadcells" },
      {
        type: "checklist",
        title: "Performance tests",
        yes: "PASS",
        no: "FAIL",
        items: [
          "Eccentricity / corner test with certified test weights",
          "Increasing-load (linearity) test to service capacity",
          "Repeatability and return-to-zero within tolerance",
          "W&M stamp valid; indicator sealing intact",
        ],
      },
      { type: "textarea", k: "remarks", label: "Engineer remarks / recommendations" },
    ],
  },
  {
    code: "WB05",
    name: "Service / Breakdown Report",
    who: "QSL Engineer",
    desc: "Corrective visit: fault, diagnosis, work done, parts.",
    sections: [
      {
        type: "fields",
        fields: [
          { k: "make", label: "Make / model" },
          { k: "serialNo", label: "Serial no." },
          { k: "callLogged", label: "Call logged (date/time)" },
          { k: "arrival", label: "Arrival (date/time)" },
        ],
      },
      { type: "textarea", k: "fault", label: "Fault reported by site" },
      { type: "textarea", k: "diagnosis", label: "Diagnosis / findings" },
      { type: "textarea", k: "work", label: "Work carried out" },
      { type: "textarea", k: "parts", label: "Parts supplied / replaced (qty, description, part no.)" },
      {
        type: "choices",
        k: "outcome",
        title: "Status when leaving site",
        options: [
          "Back in service - accuracy checked",
          "Back in service - calibration recommended",
          "Out of service - parts on order",
          "Out of service - repair quoted",
        ],
      },
      { type: "textarea", k: "recs", label: "Recommendations to the client" },
    ],
  },
  {
    code: "WB06",
    name: "Calibration & Verification Record",
    who: "QSL Engineer",
    desc: "ISO/IEC 17025 calibration with traceable test weights.",
    sections: [
      {
        type: "fields",
        fields: [
          { k: "certNo", label: "Certificate no." },
          { k: "serialNo", label: "Weighbridge serial no." },
          { k: "weights", label: "Test weight IDs" },
          { k: "trace", label: "Traceability cert. no." },
        ],
      },
      {
        type: "rows",
        key: "incr",
        title: "Increasing load test",
        cols: ["Applied (kg)", "As-found (kg)", "As-left (kg)", "Error (kg)"],
        rows: 5,
      },
      {
        type: "rows",
        key: "ecc",
        title: "Eccentricity (corner) test",
        cols: ["Position", "Applied (kg)", "Reading (kg)", "Error (kg)"],
        rows: 4,
        prefill: [["End A"], ["Centre"], ["End B"], ["Sides (L/R)"]],
      },
      {
        type: "fields",
        fields: [
          { k: "maxSpread", label: "Repeatability - max spread (kg)", inputType: "number" },
          { k: "returnZero", label: "Return to zero (kg)", inputType: "number" },
          { k: "nextDue", label: "Next calibration due", inputType: "date" },
        ],
      },
      {
        type: "choices",
        k: "outcome",
        title: "Outcome",
        options: [
          "Calibrated within tolerance - certificate issued",
          "Submitted to Weights & Measures for stamping",
        ],
      },
    ],
  },
];

export function templateByCode(code) {
  return TEMPLATES.find((t) => t.code === code) || null;
}
