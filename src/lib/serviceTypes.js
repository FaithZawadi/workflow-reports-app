// The service types a customer can leave feedback / an enquiry against.
export const SERVICE_TYPES = [
  { key: "MONTHLY_SERVICE", label: "Monthly service" },
  { key: "QUARTERLY_SERVICE", label: "Quarterly service" },
  { key: "ANNUAL_CALIBRATION", label: "Annual calibration" },
  { key: "BREAKDOWN_SERVICE", label: "Breakdown service" },
];

export const SERVICE_TYPE_KEYS = SERVICE_TYPES.map((s) => s.key);
export const SERVICE_TYPE_LABEL = Object.fromEntries(SERVICE_TYPES.map((s) => [s.key, s.label]));
