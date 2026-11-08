import Dexie, { Table } from 'dexie';

export interface OfflineCheckItem {
  item: string;
  equipment: string;
  look_for: string;
  status: string; // "OK", "DEFECT", "STANDBY"
  defectNote?: string;
}

export interface OfflineInspection {
  id: string; // e.g. "INS-ext-1-2026-11-08"
  stationId: string;
  stationName: string;
  plant: string;
  date: string; // YYYY-MM-DD
  day: number;
  month: string; // YYYY-MM
  epf: string;
  submittedAt: number; // epoch ms
  lastModifiedAt: number;
  records: OfflineCheckItem[];
  isSynced: boolean; // false when saved offline, true after syncing to server
}

export class PlantOfflineDB extends Dexie {
  inspections!: Table<OfflineInspection, string>;

  constructor() {
    super('AlumexPlantMaintenanceOfflineDB_v2');
    this.version(1).stores({
      inspections: 'id, stationId, date, month, epf, isSynced, submittedAt'
    });
  }
}

// Client-safe singleton
export const offlineDb = typeof window !== 'undefined' ? new PlantOfflineDB() : null;
