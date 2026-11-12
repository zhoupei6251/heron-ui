export interface HeronHealth {
  generatedAt: string;
  sourceTotal: number;
  sourceEnabled: number;
  sourceFailing: number;
  lastSuccessSource?: string;
  lastSuccessAt?: string;
  lastErrorSource?: string;
  lastErrorReason?: string;
  todayCandidates: number;
  todayTasks: number;
  todayFailed: number;
  monthTasks: number;
  monthInputTokens: number;
  monthOutputTokens: number;
}
