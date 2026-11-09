import {
  Trip,
  Vehicle,
  Team,
  DailyReading,
  WeekdayReminder,
  UserProfile,
  AppSettings,
  RideRequest,
} from '../types';

// Default teams
export const INITIAL_TEAMS: Team[] = [
  {
    id: 'team_bouw',
    name: 'Team Bouw & Montage',
    description: 'Buitendienst voor bouwwerken en montages',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'team_service',
    name: 'Team Service & Onderhoud',
    description: 'Interventies, herstellingen en onderhoud',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'team_projecten',
    name: 'Team Projectleiding',
    description: 'Werfleiders, opmeters en projectverantwoordelijken',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Initial vehicles matching Vehicle type
export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh_1_abc_123',
    teamId: 'team_bouw',
    licensePlate: '1-ABC-123',
    brand: 'Volkswagen',
    model: 'Transporter T6.1',
    nickname: 'Bus 1 (Bouw)',
    isActive: true,
    lastKnownKm: 142350,
    expectedDailyKm: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_2_def_456',
    teamId: 'team_bouw',
    licensePlate: '2-DEF-456',
    brand: 'Renault',
    model: 'Master L2H2',
    nickname: 'Grote Camionette',
    isActive: true,
    lastKnownKm: 89400,
    expectedDailyKm: 50,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_1_xyz_789',
    teamId: 'team_service',
    licensePlate: '1-XYZ-789',
    brand: 'Mercedes-Benz',
    model: 'Citan 110 CDI',
    nickname: 'Service Citan',
    isActive: true,
    lastKnownKm: 45210,
    expectedDailyKm: 40,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_2_ghj_012',
    teamId: 'team_projecten',
    licensePlate: '2-GHJ-012',
    brand: 'Toyota',
    model: 'Proace Electric',
    nickname: 'Project EV',
    isActive: true,
    lastKnownKm: 31050,
    expectedDailyKm: 50,
    createdAt: new Date().toISOString(),
  },
];

// Seed profiles
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user_admin_pfarts',
    fullName: 'Peter F. Arts (Systeem Admin)',
    email: 'pfarts@gmail.com',
    role: 'admin',
    teamIds: ['team_bouw', 'team_service', 'team_projecten'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_jan_janssens',
    fullName: 'Jan Janssens',
    email: 'jan.janssens@bedrijf.be',
    role: 'user',
    teamIds: ['team_bouw'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_sophie_peeters',
    fullName: 'Sophie Peeters',
    email: 'sophie.peeters@bedrijf.be',
    role: 'user',
    teamIds: ['team_service'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_WEEKDAY_SCHEDULES: WeekdayReminder[] = [
  { dayOfWeek: 1, dayName: 'Maandag', isActive: true, startTime: '07:30', stopTime: '16:30' },
  { dayOfWeek: 2, dayName: 'Dinsdag', isActive: true, startTime: '07:30', stopTime: '16:30' },
  { dayOfWeek: 3, dayName: 'Woensdag', isActive: true, startTime: '07:30', stopTime: '16:30' },
  { dayOfWeek: 4, dayName: 'Donderdag', isActive: true, startTime: '07:30', stopTime: '16:30' },
  { dayOfWeek: 5, dayName: 'Vrijdag', isActive: true, startTime: '07:30', stopTime: '15:30' },
  { dayOfWeek: 6, dayName: 'Zaterdag', isActive: false, startTime: '08:00', stopTime: '12:00' },
  { dayOfWeek: 0, dayName: 'Zondag', isActive: false, startTime: '08:00', stopTime: '12:00' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global_settings',
  purposes: [
    'Klantbezoek / Werf',
    'Materiaal ophalen / Levering',
    'Interventie / Herstelling',
    'Onderhoud / Keuring',
    'Verplaatsing tussen werven',
    'Overig',
  ],
  defaultExpectedDailyKm: 50,
  rideRequestModuleEnabled: true,
  updatedAt: new Date().toISOString(),
};

/**
 * Helper to calculate latest vehicle mileage from trips or vehicle records
 */
export function getLatestVehicleMileage(vehicle?: Vehicle | null, allTrips: Trip[] = []): number {
  if (!vehicle) return 0;
  const vehicleTrips = allTrips
    .filter((t) => t.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  if (vehicleTrips.length > 0) {
    const latest = vehicleTrips[0];
    if (latest.endKm && latest.endKm > 0) return latest.endKm;
    if (latest.startKm && latest.startKm > 0) return latest.startKm;
  }
  return vehicle.lastKnownKm || 0;
}

/**
 * Format expected arrival time: "rond 18u20"
 */
export function formatExpectedArrivalTime(baseDate?: string, minutes: number = 10): string {
  const base = baseDate ? new Date(baseDate) : new Date();
  const arrival = new Date(base.getTime() + minutes * 60 * 1000);
  const hours = arrival.getHours();
  const mins = arrival.getMinutes().toString().padStart(2, '0');
  return `rond ${hours}u${mins}`;
}

/**
 * Fetch database connection status from MariaDB backend
 */
export async function getDbStatus(): Promise<{
  connected: boolean;
  mode: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/db/status');
    if (res.ok) {
      return await res.json();
    }
    return {
      connected: false,
      mode: 'fallback',
      host: '',
      port: 3306,
      database: '',
      user: '',
      ssl: false,
      error: `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      connected: false,
      mode: 'fallback',
      host: '',
      port: 3306,
      database: '',
      user: '',
      ssl: false,
      error: err?.message,
    };
  }
}

/**
 * Re-trigger connection attempt to MariaDB
 */
export async function reconnectDb(): Promise<{
  connected: boolean;
  mode: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/db/reconnect', { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Reconnect error:', err);
  }
  return getDbStatus();
}

/**
 * Realtime Server-Sent Events subscriber
 */
export function subscribeToRealtimeEvents(
  onEvent: (event: { type: string; data: any }) => void
): () => void {
  let eventSource: EventSource | null = null;
  let active = true;

  try {
    eventSource = new EventSource('/api/events');

    eventSource.onmessage = (e) => {
      if (!active) return;
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.type) {
          onEvent(payload);
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      // Browser EventSource automatically attempts reconnection
    };
  } catch (err) {
    console.warn('Could not establish EventSource connection:', err);
  }

  return () => {
    active = false;
    if (eventSource) {
      eventSource.close();
    }
  };
}

/**
 * GET App Settings
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const res = await fetch('/api/app-settings');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error fetching app settings:', err);
  }
  return DEFAULT_APP_SETTINGS;
}

/**
 * UPDATE App Settings
 */
export async function updateAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  try {
    const res = await fetch('/api/app-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error updating app settings:', err);
  }
  return { ...DEFAULT_APP_SETTINGS, ...settings, updatedAt: new Date().toISOString() };
}

/**
 * Seed initial data (handled by backend on startup)
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  // Handled automatically by MariaDB pool on backend startup
}

/**
 * FETCH CORE COLLECTIONS FROM MARIADB API
 */
export async function fetchAllTrips(): Promise<Trip[]> {
  try {
    const res = await fetch('/api/trips');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching trips:', err);
  }
  return [];
}

export async function fetchAllVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch('/api/vehicles');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching vehicles:', err);
  }
  return INITIAL_VEHICLES;
}

export async function fetchAllTeams(): Promise<Team[]> {
  try {
    const res = await fetch('/api/teams');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching teams:', err);
  }
  return INITIAL_TEAMS;
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  try {
    const res = await fetch('/api/profiles');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching profiles:', err);
  }
  return INITIAL_PROFILES;
}

export async function fetchAllDailyReadings(): Promise<DailyReading[]> {
  try {
    const res = await fetch('/api/daily-readings');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching daily readings:', err);
  }
  return [];
}

export async function fetchAllRideRequests(): Promise<RideRequest[]> {
  try {
    const res = await fetch('/api/ride-requests');
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Error fetching ride requests:', err);
  }
  return [];
}

/**
 * START TRIP WITH ATOMIC HANDOVER (Saved into MariaDB)
 */
export async function startNewTrip(params: {
  vehicle: Vehicle;
  user: UserProfile;
  startKm: number;
  purpose: string;
  notes?: string;
  startTime?: string;
}): Promise<{ newTripId: string; autoClosedTrip?: Trip }> {
  const { vehicle, user, startKm, purpose, notes } = params;
  const startTime = params.startTime || new Date().toISOString();
  const newTripId = 'trip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const prevKm = vehicle.lastKnownKm || 0;
  const kmDiscrepancy = prevKm > 0 ? startKm - prevKm : 0;
  const hasKmDiscrepancy = Math.abs(kmDiscrepancy) > 0;

  const tripData: Trip = {
    id: newTripId,
    teamId: vehicle.teamId,
    vehicleId: vehicle.id,
    userId: user.id,
    userName: user.fullName,
    userEmail: user.email,
    licensePlate: vehicle.licensePlate,
    vehicleName: `${vehicle.brand} ${vehicle.model}${vehicle.nickname ? ` (${vehicle.nickname})` : ''}`,
    startTime,
    startKm,
    purpose,
    notes: notes || '',
    status: 'open',
    closedAutomatically: false,
    kmDiscrepancy,
    hasKmDiscrepancy,
    createdAt: startTime,
    updatedAt: startTime,
  };

  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripData),
  });

  if (!res.ok) {
    throw new Error(`Rit kon niet worden opgeslagen in MariaDB: HTTP ${res.status}`);
  }

  const result = await res.json();
  return { newTripId, autoClosedTrip: result.autoClosedTrip };
}

/**
 * CLOSE TRIP (Saved into MariaDB)
 * Flexible signature accepting either { trip, endKm, ... } or { tripId, endKm, ... }
 */
export async function closeTrip(params: {
  trip?: Trip;
  tripId?: string;
  vehicleId?: string;
  startKm?: number;
  endKm: number;
  endTime?: string;
  notes?: string;
  expectedDailyKm?: number;
  unusualKmThreshold?: number;
}): Promise<Trip> {
  const tripId = params.tripId || params.trip?.id;
  if (!tripId) throw new Error('Geen rit ID opgegeven voor afsluiten');

  const endKm = params.endKm;
  const endTime = params.endTime || new Date().toISOString();
  const notes = params.notes || '';
  const threshold = params.expectedDailyKm || params.unusualKmThreshold || 150;
  const startKm = params.startKm || params.trip?.startKm || 0;
  const tripKm = endKm - startKm;
  const isUnusualDistance = tripKm > threshold || tripKm < 0;

  const res = await fetch(`/api/trips/${tripId}/close`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endKm,
      endTime,
      notes,
      isUnusualDistance,
      expectedTripKm: threshold,
      status: 'closed',
    }),
  });

  if (!res.ok) {
    throw new Error(`Rit afsluiten mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * ADMIN MANUAL CLOSE TRIP
 */
export async function adminManualCloseTrip(params: {
  trip?: Trip;
  tripId?: string;
  vehicleId?: string;
  endKm: number;
  endTime?: string;
  adminUser: UserProfile;
  reason?: string;
}): Promise<Trip> {
  const tripId = params.tripId || params.trip?.id;
  if (!tripId) throw new Error('Geen rit ID opgegeven voor admin afsluiten');
  const endTime = params.endTime || new Date().toISOString();

  const res = await fetch(`/api/trips/${tripId}/admin-close`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endKm: params.endKm,
      endTime,
      closedReason: params.reason || `Handmatig afgesloten door admin ${params.adminUser.fullName}`,
      closedByUserId: params.adminUser.id,
      closedByUserName: params.adminUser.fullName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Admin afsluiten mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * SAVE DAILY READING
 */
export async function saveDailyReading(reading: Omit<DailyReading, 'id' | 'createdAt'>): Promise<DailyReading> {
  const readingId = 'reading_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const data: DailyReading = {
    ...reading,
    id: readingId,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch('/api/daily-readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Dagelijkse registratie opslaan mislukt: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * SAVE NOTIFICATION SETTINGS (Stored in localStorage and user profile)
 */
export async function saveNotificationSettings(userId: string, schedules: WeekdayReminder[]): Promise<void> {
  try {
    localStorage.setItem(`wagenrit_reminder_schedules_${userId}`, JSON.stringify(schedules));
  } catch (e) {
    console.warn('Could not save schedules to local storage:', e);
  }
}

/**
 * GET NOTIFICATION SETTINGS
 */
export async function getNotificationSettings(userId: string): Promise<WeekdayReminder[]> {
  try {
    const raw = localStorage.getItem(`wagenrit_reminder_schedules_${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading schedules from local storage:', e);
  }
  return DEFAULT_WEEKDAY_SCHEDULES;
}

/**
 * EXPORT TRIPS TO CSV
 */
export function exportTripsToCSV(trips: Trip[], filename = 'ritten_export.csv') {
  const headers = [
    'Rit ID',
    'Voertuig',
    'Nummerplaat',
    'Bestuurder',
    'Starttijd',
    'Start KM',
    'Eindtijd',
    'Eind KM',
    'Afgelegde KM',
    'Doel / Bestemming',
    'Opmerkingen',
    'Status',
    'Afsluiting',
    'KM Afwijking',
  ];

  const rows = trips.map((t) => {
    const dist = t.endKm ? t.endKm - t.startKm : '';
    const statusLabel =
      t.status === 'open'
        ? 'Open'
        : t.status === 'auto_closed'
        ? 'Automatisch afgesloten'
        : 'Afgesloten';
    const closeReason = t.closedReason || (t.closedAutomatically ? 'Overdracht' : 'Regulier');

    return [
      `"${t.id}"`,
      `"${t.vehicleName.replace(/"/g, '""')}"`,
      `"${t.licensePlate}"`,
      `"${t.userName.replace(/"/g, '""')}"`,
      `"${t.startTime}"`,
      t.startKm,
      t.endTime ? `"${t.endTime}"` : '""',
      t.endKm || '',
      dist,
      `"${(t.purpose || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${statusLabel}"`,
      `"${closeReason.replace(/"/g, '""')}"`,
      t.hasKmDiscrepancy ? t.kmDiscrepancy : 0,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * VEHICLE CRUD (MariaDB)
 */
export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt'>): Promise<Vehicle> {
  const id = 'veh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newVehicle: Vehicle = {
    ...vehicle,
    id,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newVehicle),
  });

  if (!res.ok) {
    throw new Error(`Voertuig toevoegen mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  const res = await fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!res.ok) {
    throw new Error(`Voertuig bijwerken mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function deleteVehicle(id: string): Promise<void> {
  const res = await fetch(`/api/vehicles/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error(`Voertuig verwijderen mislukt in MariaDB: HTTP ${res.status}`);
  }
}

/**
 * TEAM CRUD (MariaDB)
 */
export async function addTeam(team: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
  const id = 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newTeam: Team = {
    ...team,
    id,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newTeam),
  });

  if (!res.ok) {
    throw new Error(`Team toevoegen mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
  const res = await fetch('/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!res.ok) {
    throw new Error(`Team bijwerken mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * USER PROFILE CRUD (MariaDB)
 */
export async function updateUserProfile(
  id: string,
  updates: Partial<UserProfile>,
  _adminUser?: UserProfile
): Promise<UserProfile> {
  const res = await fetch(`/api/profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(`Profiel bijwerken mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * RIDE REQUEST MODULE (MariaDB)
 */
export async function createRideRequest(params: {
  requesterId: string;
  requesterName: string;
  fromLocation: string;
  toLocation: string;
  hasMaterials: boolean;
  requesterPhone?: string;
  notes?: string;
  teamId?: string;
}): Promise<RideRequest> {
  const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();
  const newReq: RideRequest = {
    id,
    requesterId: params.requesterId,
    requesterName: params.requesterName,
    requesterPhone: params.requesterPhone || '',
    teamId: params.teamId,
    fromLocation: params.fromLocation,
    toLocation: params.toLocation,
    hasMaterials: params.hasMaterials,
    notes: params.notes || '',
    status: 'pending',
    createdAt: now,
    lastNotifiedAt: now,
    retryCount: 0,
  };

  const res = await fetch('/api/ride-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReq),
  });

  if (!res.ok) {
    throw new Error(`Vervoeraanvraag aanmaken mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function acceptRideRequest(
  requestId: string,
  driver: { id: string; name?: string; fullName?: string },
  vehicle?: { id: string; licensePlate: string; name: string },
  etaMinutes: number = 10
): Promise<RideRequest> {
  const res = await fetch(`/api/ride-requests/${requestId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driverId: driver.id,
      driverName: driver.fullName || driver.name || 'Chauffeur',
      driverVehicleId: vehicle?.id,
      driverLicensePlate: vehicle?.licensePlate,
      driverVehicleName: vehicle?.name,
      etaMinutes,
    }),
  });

  if (!res.ok) {
    throw new Error(`Vervoeraanvraag accepteren mislukt in MariaDB: HTTP ${res.status}`);
  }

  return await res.json();
}

export async function cancelRideRequest(requestId: string): Promise<void> {
  const res = await fetch(`/api/ride-requests/${requestId}/cancel`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Vervoeraanvraag annuleren mislukt in MariaDB: HTTP ${res.status}`);
  }
}

export async function completeRideRequest(requestId: string): Promise<void> {
  const res = await fetch(`/api/ride-requests/${requestId}/complete`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Vervoeraanvraag afronden mislukt in MariaDB: HTTP ${res.status}`);
  }
}
