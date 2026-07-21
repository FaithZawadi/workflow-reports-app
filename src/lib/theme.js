// QSL brand tokens — the calibration-lab identity from the original design.
export const GOLD = "#F5A800";
export const COAL = "#161310";
export const PAPER = "#F7F5F0";
export const INK = "#26221C";
export const PASS = "#2E7D46";
export const FAIL = "#B03A2E";
export const WAIT = "#946B00";
export const LINE = "#DDD6C8";
export const MUTE = "#6B6355";

export const STRIPE = {
  backgroundImage: `repeating-linear-gradient(45deg, ${GOLD} 0 12px, ${COAL} 12px 24px)`,
};

export const STATUS = {
  PENDING_SUPERVISOR: { label: "SUPERVISOR REVIEW", color: WAIT },
  PENDING_MANAGER: { label: "MANAGER APPROVAL", color: WAIT },
  APPROVED: { label: "APPROVED", color: PASS },
  REJECTED: { label: "REJECTED", color: FAIL },
};

export const ROLE_LABEL = {
  TECHNICIAN: "Site Technician",
  ENGINEER: "QSL Engineer",
  SUPERVISOR: "Equipment User",
  MANAGER: "Client/Manager",
  PROJECT_MANAGER: "Project Manager",
  TECHNICAL_MANAGER: "Technical Manager",
  ADMIN: "Administrator",
  CLIENT: "Client",
  HR: "HR / Training",
};
