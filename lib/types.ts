export type LiveStatus = {
  openAlarms: number;
  openCritical: number;
  ackAlarms: number;
  simulator: boolean;
  nodesDown: number;
  ts: number;
};

export type NodeLive = {
  nodeId: number;
  code: string;
  name: string;
  pressureBar: number | null;
  flowSm3h: number | null;
  tempC: number | null;
  ts: number | null;
  setpoint: number | null;
  zone: string;
  series: { t: number; p: number; f: number }[];
};
