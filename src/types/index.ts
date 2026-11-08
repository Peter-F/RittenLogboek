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
  expectedDailyKm?: number; // Richtgetal km per rit / dag (bv. 50 km)
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
  // Discrepancy checks for administrator visibility
  kmDiscrepancy?: number; // startKm - previousTripEndKm (verschil met vorige stand)
  hasKmDiscrepancy?: boolean;
  // Richtgetal waarschuwing
  isUnusualDistance?: boolean; // afstand > richtgetal
  expectedTripKm?: number;
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

export interface AppSettings {
  id: string;
  purposes: string[];
  defaultExpectedDailyKm: number;
  rideRequestModuleEnabled: boolean; // Administrator toggle voor Vervoer Zoeken
  updatedAt: string;
}

export type RideRequestStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface RideRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterPhone?: string;
  teamId?: string;
  fromLocation: string; // Waar je nu bent
  toLocation: string;   // Naar waar je moet
  hasMaterials: boolean;// Vinkje voor materiaal mee te vervoeren
  notes?: string;
  status: RideRequestStatus;
  createdAt: string;
  lastNotifiedAt: string;
  retryCount: number;
  // Gevuld wanneer chauffeur accepteert:
  driverId?: string;
  driverName?: string;
  driverVehicleId?: string;
  driverLicensePlate?: string;
  driverVehicleName?: string;
  etaMinutes?: number;  // 5, 10, 15 of eigen waarde
  acceptedAt?: string;
}

