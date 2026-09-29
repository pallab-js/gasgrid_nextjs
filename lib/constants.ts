import type {
  AlarmStatus,
  AlarmType,
  ConsumerCategory,
  ConsumerStatus,
  InvoiceStatus,
  Material,
  NodeKind,
  NodeStatus,
  Priority,
  Severity,
  WoStatus,
  WoType,
  Zone,
} from "./schema";

export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  CGS: "City gate station",
  DPRS: "District regulating station",
  IPRS: "Individual regulating station",
  CNG: "CNG station",
  MRS: "Metering station",
  VALVE: "Valve chamber",
  JUNCTION: "Junction",
  ODORISER: "Odorisation skid",
};

export const NODE_KIND_SHORT: Record<NodeKind, string> = {
  CGS: "CGS",
  DPRS: "DPRS",
  IPRS: "IPRS",
  CNG: "CNG",
  MRS: "MRS",
  VALVE: "VALVE",
  JUNCTION: "JCT",
  ODORISER: "ODR",
};

export const ZONE_LABELS: Record<Zone, string> = {
  primary: "Primary (MP)",
  secondary: "Secondary (LP)",
  tertiary: "Tertiary",
};

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  operational: "Operational",
  maintenance: "Maintenance",
  isolated: "Isolated",
  faulty: "Faulty",
  planned: "Planned",
};

/** Tailwind tone classes bound to GasNext semantic tokens. */
export const STATUS_TONE: Record<NodeStatus, string> = {
  operational: "text-success bg-success/10 border-success/30",
  maintenance: "text-warning bg-warning/10 border-warning/30",
  isolated: "text-muted-foreground bg-muted border-border",
  faulty: "text-destructive bg-destructive/10 border-destructive/30",
  planned: "text-info bg-info/10 border-info/30",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export const SEVERITY_TONE: Record<Severity, string> = {
  info: "text-info bg-info/10 border-info/30",
  warning: "text-warning bg-warning/10 border-warning/30",
  critical: "text-destructive bg-destructive/10 border-destructive/30",
};

export const ALARM_TYPE_LABELS: Record<AlarmType, string> = {
  OVER_PRESSURE: "Over pressure",
  UNDER_PRESSURE: "Under pressure",
  LEAK_SUSPECTED: "Leak suspected",
  COMM_LOSS: "Communication loss",
  VALVE_ANOMALY: "Valve anomaly",
  HIGH_FLOW: "High flow",
  LOW_FLOW: "Low flow",
};

export const ALARM_STATUS_LABELS: Record<AlarmStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

export const CATEGORY_LABELS: Record<ConsumerCategory, string> = {
  DOMESTIC: "Domestic",
  COMMERCIAL: "Commercial",
  INDUSTRIAL: "Industrial",
  CNG: "CNG",
  INSTITUTIONAL: "Institutional",
};

export const CONSUMER_STATUS_LABELS: Record<ConsumerStatus, string> = {
  active: "Active",
  pending: "Pending",
  disconnected: "Disconnected",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  overdue: "Overdue",
};

export const INVOICE_TONE: Record<InvoiceStatus, string> = {
  paid: "text-success bg-success/10 border-success/30",
  unpaid: "text-info bg-info/10 border-info/30",
  overdue: "text-destructive bg-destructive/10 border-destructive/30",
};

export const WO_TYPE_LABELS: Record<WoType, string> = {
  preventive: "Preventive",
  corrective: "Corrective",
  inspection: "Inspection",
  leak_repair: "Leak repair",
  construction: "Construction",
};

export const WO_STATUS_LABELS: Record<WoStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_TONE: Record<Priority, string> = {
  low: "text-muted-foreground bg-muted border-border",
  medium: "text-info bg-info/10 border-info/30",
  high: "text-warning bg-warning/10 border-warning/30",
  urgent: "text-destructive bg-destructive/10 border-destructive/30",
};

export const MATERIAL_LABELS: Record<Material, string> = {
  steel: "Steel",
  PE: "PE",
  MDPE: "MDPE",
  GI: "GI",
  copper: "Copper",
};

export const ZONE_STROKE: Record<Zone, string> = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-4)",
  tertiary: "var(--chart-2)",
};
