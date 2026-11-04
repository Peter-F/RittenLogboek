export type UserRole = 'user' | 'fleet_admin' | 'admin';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  teamIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  teamId: string;
  licensePlate: string;
  brand: string;
  model: string;
  nickname?: string;
  isActive: boolean;
  lastKnownKm: number;
  createdAt: string;
}

export type TripStatus = 'open' | 'closed' | 'auto_closed';

export interface Trip {
  id: string;
  teamId?: string;
  vehicleId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  licensePlate: string;
  vehicleName: string;
  startTime: string; // ISO string
  startKm: number;
  endTime?: string; // ISO string
  endKm?: number;
  purpose: string;
  notes?: string;
  status: TripStatus;
  closedAutomatically?: boolean;
  closedReason?: string;
  closedByUserId?: string;
  closedByUserName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReadingType = 'start' | 'stop';

export interface DailyReading {
  id: string;
  teamId?: string;
  vehicleId: string;
  userId: string;
  userName: string;
  readingDate: string; // YYYY-MM-DD
  readingType: ReadingType;
  km: number;
  recordedAt: string; // ISO string
  createdAt: string;
}

export interface WeekdayReminder {
  dayOfWeek: number; // 0 = Zondag, 1 = Maandag, ..., 6 = Zaterdag
  dayName: string;
  isActive: boolean;
  startTime: string; // HH:mm
  stopTime: string;  // HH:mm
}

export interface NotificationSettings {
  id: string;
  userId: string;
  schedules: WeekdayReminder[];
  updatedAt: string;
}
