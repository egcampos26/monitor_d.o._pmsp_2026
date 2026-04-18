
export interface ServerMonitor {
  id: string;
  name: string;
  rf: string;
  role: string;
  notes?: string;
  active: boolean;
  createdAt: number;
}

export type DospFormat = 'JSON' | 'CSV' | 'HTML' | 'PDF';

export type Frequency = 'once' | 'daily' | 'every_2_days' | 'weekly';

export interface ScheduledAnalysis {
  id: string;
  name: string;
  frequency: Frequency;
  nextRun: string; // ISO string
  time: string; // HH:mm
  active: boolean;
  format: DospFormat;
  monitor_ids?: string[];
  createdAt: number;
}

export interface DospOccurrence {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorRf: string;
  title: string;
  content: string;
  page?: string;
  section?: string;
  url: string;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'exact' | 'flexible' | 'proximity';
  status?: 'verified' | 'dismissed' | 'pending';
}

export interface AnalysisHistory {
  id: string;
  date: string;
  format: DospFormat;
  totalOccurrences: number;
  monitorsFound: number;
  timestamp: number;
  results: DospOccurrence[];
}

export interface User {
  email: string;
  name: string;
}
