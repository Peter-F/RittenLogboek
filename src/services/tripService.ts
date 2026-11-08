import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Trip,
  Vehicle,
  Team,
  DailyReading,
  NotificationSettings,
  WeekdayReminder,
  UserProfile,
  AppSettings,
  RideRequest,
  RideRequestStatus,
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
    id: 'team_centraal',
    name: 'Centraal Wagenpark',
    description: 'Gedeelde poolwagens voor alle medewerkers',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Default vehicles
export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh_1_abc_123',
    teamId: 'team_bouw',
    licensePlate: '1-ABC-123',
    brand: 'Volkswagen',
    model: 'Transporter T6.1',
    nickname: 'De Grote Witte',
    isActive: true,
    lastKnownKm: 142500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_1_xyz_456',
    teamId: 'team_service',
    licensePlate: '1-XYZ-456',
    brand: 'Ford',
    model: 'Transit Custom',
    nickname: 'Servicebus 2',
    isActive: true,
    lastKnownKm: 89300,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_2_def_789',
    teamId: 'team_bouw',
    licensePlate: '2-DEF-789',
    brand: 'Renault',
    model: 'Trafic L2H1',
    nickname: 'Materiaalbus',
    isActive: true,
    lastKnownKm: 112100,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'veh_1_ghi_321',
    teamId: 'team_centraal',
    licensePlate: '1-GHI-321',
    brand: 'Mercedes-Benz',
    model: 'Vito 114 CDI',
    nickname: 'Poolwagen',
    isActive: true,
    lastKnownKm: 65400,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_PROFILES: UserProfile[] = [
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
    id: 'user_piet_peeters',
    fullName: 'Piet Peeters',
    email: 'piet.peeters@bedrijf.be',
    role: 'fleet_admin',
    teamIds: ['team_bouw', 'team_service'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_sofie_maes',
    fullName: 'Sofie Maes (Systeembeheerder)',
    email: 'pfArts@gmail.com',
    role: 'admin',
    teamIds: ['team_bouw', 'team_service', 'team_centraal'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_WEEKDAY_SCHEDULES: WeekdayReminder[] = [
  { dayOfWeek: 1, dayName: 'Maandag', isActive: true, startTime: '07:30', stopTime: '17:30' },
  { dayOfWeek: 2, dayName: 'Dinsdag', isActive: true, startTime: '07:30', stopTime: '17:30' },
  { dayOfWeek: 3, dayName: 'Woensdag', isActive: true, startTime: '07:30', stopTime: '17:30' },
  { dayOfWeek: 4, dayName: 'Donderdag', isActive: true, startTime: '07:30', stopTime: '17:30' },
  { dayOfWeek: 5, dayName: 'Vrijdag', isActive: true, startTime: '07:30', stopTime: '17:00' },
  { dayOfWeek: 6, dayName: 'Zaterdag', isActive: false, startTime: '08:00', stopTime: '13:00' },
  { dayOfWeek: 0, dayName: 'Zondag', isActive: false, startTime: '08:00', stopTime: '13:00' },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global_settings',
  purposes: [
    'Klantbezoek',
    'Werf / Installatie',
    'Materiaal ophalen / Leverancier',
    'Interventie / Storing',
    'Onderhoud / Keuring',
    'Woon-werk / Verplaatsing',
    'Intern transport',
  ],
  defaultExpectedDailyKm: 50,
  rideRequestModuleEnabled: true,
  updatedAt: new Date().toISOString(),
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'global_settings'));
    if (snap.exists()) {
      return snap.data() as AppSettings;
    }
    await setDoc(doc(db, 'app_settings', 'global_settings'), DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
  } catch (err) {
    console.warn('Error fetching app settings, using defaults:', err);
    return DEFAULT_APP_SETTINGS;
  }
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const updated: AppSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'app_settings', 'global_settings'), updated);
  return updated;
}


/**
 * Seeds initial collections if database is empty so the app is instantly usable
 */
export async function seedInitialDataIfEmpty() {
  try {
    const teamsSnap = await getDocs(collection(db, 'teams'));
    if (teamsSnap.empty) {
      for (const t of INITIAL_TEAMS) {
        await setDoc(doc(db, 'teams', t.id), t);
      }
    }

    const vehSnap = await getDocs(collection(db, 'vehicles'));
    if (vehSnap.empty) {
      for (const v of INITIAL_VEHICLES) {
        await setDoc(doc(db, 'vehicles', v.id), v);
      }
    }

    const profilesSnap = await getDocs(collection(db, 'profiles'));
    if (profilesSnap.empty) {
      for (const p of INITIAL_PROFILES) {
        await setDoc(doc(db, 'profiles', p.id), p);
      }
    }

    // Add some sample trips to illustrate open, closed, and auto-closed trips
    const tripsSnap = await getDocs(collection(db, 'trips'));
    if (tripsSnap.empty) {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);

      const sampleTrips: Trip[] = [
        {
          id: 'trip_sample_1',
          teamId: 'team_bouw',
          vehicleId: 'veh_1_abc_123',
          userId: 'user_jan_janssens',
          userName: 'Jan Janssens',
          userEmail: 'jan.janssens@bedrijf.be',
          licensePlate: '1-ABC-123',
          vehicleName: 'Volkswagen Transporter T6.1',
          startTime: new Date(twoDaysAgo.setHours(8, 0, 0, 0)).toISOString(),
          startKm: 142350,
          endTime: new Date(twoDaysAgo.setHours(12, 30, 0, 0)).toISOString(),
          endKm: 142420,
          purpose: 'Klantbezoek werf Gent',
          notes: 'Regulier traject via E17',
          status: 'closed',
          closedAutomatically: false,
          createdAt: new Date(twoDaysAgo.setHours(8, 0, 0, 0)).toISOString(),
          updatedAt: new Date(twoDaysAgo.setHours(12, 30, 0, 0)).toISOString(),
        },
        {
          id: 'trip_sample_2_autoclosed',
          teamId: 'team_bouw',
          vehicleId: 'veh_1_abc_123',
          userId: 'user_jan_janssens',
          userName: 'Jan Janssens',
          userEmail: 'jan.janssens@bedrijf.be',
          licensePlate: '1-ABC-123',
          vehicleName: 'Volkswagen Transporter T6.1',
          startTime: new Date(yesterday.setHours(8, 15, 0, 0)).toISOString(),
          startKm: 142420,
          endTime: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(),
          endKm: 142500,
          purpose: 'Materiaal ophalen leverancier',
          notes: 'Vergeten af te sluiten bij terugkomst',
          status: 'auto_closed',
          closedAutomatically: true,
          closedReason: 'Automatisch afgesloten door nieuwe rit van Piet Peeters',
          createdAt: new Date(yesterday.setHours(8, 15, 0, 0)).toISOString(),
          updatedAt: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(),
        },
        {
          id: 'trip_sample_3_open',
          teamId: 'team_bouw',
          vehicleId: 'veh_1_abc_123',
          userId: 'user_piet_peeters',
          userName: 'Piet Peeters',
          userEmail: 'piet.peeters@bedrijf.be',
          licensePlate: '1-ABC-123',
          vehicleName: 'Volkswagen Transporter T6.1',
          startTime: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(),
          startKm: 142500,
          purpose: 'Interventie dringende storing',
          notes: 'Wagen momenteel nog onderweg',
          status: 'open',
          closedAutomatically: false,
          createdAt: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(),
          updatedAt: new Date(yesterday.setHours(13, 0, 0, 0)).toISOString(),
        },
      ];

      for (const trip of sampleTrips) {
        await setDoc(doc(db, 'trips', trip.id), trip);
      }
    }
  } catch (error) {
    console.warn('Initial data seeding note (using defaults):', error);
  }
}

/**
 * Calculates the true latest known kilometer stand of a vehicle:
 * 1. Checks all closed or auto-closed trips for this vehicle and finds the most recent endKm (stopkilometerstand van de vorige rit).
 * 2. Checks any open trip for this vehicle (its startKm).
 * 3. Checks vehicle.lastKnownKm recorded in the database document.
 * Returns the true latest confirmed mileage, preventing stale start values.
 */
export function getLatestVehicleMileage(vehicle?: Vehicle | null, allTrips: Trip[] = []): number {
  if (!vehicle) return 0;

  // 1. Find all trips for this vehicle
  const vehicleTrips = allTrips.filter(
    (t) =>
      t.vehicleId === vehicle.id ||
      (vehicle.licensePlate && t.licensePlate?.toLowerCase() === vehicle.licensePlate.toLowerCase())
  );

  // 2. Find the most recent closed/auto_closed trip with a valid endKm
  const closedTrips = vehicleTrips
    .filter(
      (t) =>
        (t.status === 'closed' || t.status === 'auto_closed') &&
        typeof t.endKm === 'number' &&
        t.endKm > 0
    )
    .sort((a, b) => {
      const timeA = new Date(a.endTime || a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.endTime || b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

  const latestClosedEndKm = closedTrips[0]?.endKm || 0;

  // 3. Check if there is an active open trip currently
  const openTrip = vehicleTrips.find((t) => t.status === 'open');
  const openTripStartKm = openTrip?.startKm || 0;

  // 4. Vehicle's recorded lastKnownKm
  const vehicleRecordedKm = vehicle.lastKnownKm || 0;

  // The true latest km is the most recent closed endKm, or the vehicle's recorded km, or open startKm
  return Math.max(vehicleRecordedKm, latestClosedEndKm, openTripStartKm);
}

/**
 * START TRIP WITH ATOMIC HANDOVER
 * Enforces business rule: Exactly one open trip per vehicle.
 * If user B starts a trip for a vehicle currently open by user A:
 * - User A's trip is automatically closed:
 *   stop_time = user B's start_time
 *   stop_km = user B's start_km
 *   status = 'auto_closed'
 *   closed_automatically = true
 * - User B's trip starts with that start_km and start_time
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

  let autoClosedTrip: Trip | undefined;

  try {
    // 1. Find any existing open trips for this vehicle
    const openTripsQuery = query(
      collection(db, 'trips'),
      where('vehicleId', '==', vehicle.id),
      where('status', '==', 'open')
    );
    const openSnap = await getDocs(openTripsQuery);

    await runTransaction(db, async (transaction) => {
      // Auto close any currently open trips for this vehicle
      for (const openDoc of openSnap.docs) {
        const openTripData = openDoc.data() as Trip;
        const autoClosedData: Partial<Trip> = {
          endTime: startTime,
          endKm: startKm,
          status: 'auto_closed',
          closedAutomatically: true,
          closedReason: `Automatisch afgesloten door ritstart van ${user.fullName}`,
          updatedAt: new Date().toISOString(),
        };

        transaction.update(doc(db, 'trips', openDoc.id), autoClosedData);
        autoClosedTrip = { ...openTripData, ...autoClosedData } as Trip;
      }

      // Update vehicle's last known km
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      transaction.update(vehicleRef, {
        lastKnownKm: startKm,
      });

      // Discrepancy calculation: check difference between startKm and previous known mileage
      const prevKm = vehicle.lastKnownKm || 0;
      const kmDiscrepancy = prevKm > 0 ? startKm - prevKm : 0;
      const hasKmDiscrepancy = Math.abs(kmDiscrepancy) > 0;

      // Create the new trip
      const newTrip: Trip = {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newTripRef = doc(db, 'trips', newTripId);
      transaction.set(newTripRef, newTrip);
    });

    return { newTripId, autoClosedTrip };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `trips/${newTripId}`);
  }
}

/**
 * CLOSE AN OPEN TRIP (Normal closure by the driver)
 */
export async function closeTrip(params: {
  tripId: string;
  vehicleId: string;
  startKm: number;
  endKm: number;
  notes?: string;
  endTime?: string;
  expectedDailyKm?: number;
}) {
  const { tripId, vehicleId, startKm, endKm, notes, expectedDailyKm } = params;
  if (endKm < startKm) {
    throw new Error('Stopkilometerstand kan niet lager zijn dan de startkilometerstand.');
  }

  const endTime = params.endTime || new Date().toISOString();
  const drivenDistance = endKm - startKm;
  const threshold = expectedDailyKm || 50;
  const isUnusualDistance = drivenDistance > threshold;

  try {
    await runTransaction(db, async (transaction) => {
      const tripRef = doc(db, 'trips', tripId);
      const vehicleRef = doc(db, 'vehicles', vehicleId);

      transaction.update(tripRef, {
        endTime,
        endKm,
        status: 'closed',
        closedAutomatically: false,
        notes: notes || '',
        isUnusualDistance,
        expectedTripKm: threshold,
        updatedAt: new Date().toISOString(),
      });

      transaction.update(vehicleRef, {
        lastKnownKm: endKm,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
}

/**
 * ADMIN MANUAL CLOSURE FOR FORGOTTEN TRIPS
 */
export async function adminManualCloseTrip(params: {
  tripId: string;
  vehicleId: string;
  endKm: number;
  endTime: string;
  reason: string;
  adminUser: UserProfile;
  expectedDailyKm?: number;
}) {
  const { tripId, vehicleId, endKm, endTime, reason, adminUser, expectedDailyKm } = params;

  try {
    await runTransaction(db, async (transaction) => {
      const tripRef = doc(db, 'trips', tripId);
      const vehicleRef = doc(db, 'vehicles', vehicleId);

      const tripSnap = await transaction.get(tripRef);
      if (!tripSnap.exists()) {
        throw new Error('Rit niet gevonden.');
      }
      const tripData = tripSnap.data() as Trip;

      if (endKm < tripData.startKm) {
        throw new Error('Stopkilometerstand kan niet lager zijn dan de startkilometerstand.');
      }

      const drivenDistance = endKm - tripData.startKm;
      const threshold = expectedDailyKm || 50;
      const isUnusualDistance = drivenDistance > threshold;

      transaction.update(tripRef, {
        endTime,
        endKm,
        status: 'closed',
        closedAutomatically: false,
        closedReason: `Handmatig afgesloten door beheerder (${adminUser.fullName}): ${reason}`,
        closedByUserId: adminUser.id,
        closedByUserName: adminUser.fullName,
        isUnusualDistance,
        expectedTripKm: threshold,
        updatedAt: new Date().toISOString(),
      });

      transaction.update(vehicleRef, {
        lastKnownKm: endKm,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
  }
}

/**
 * SAVE DAILY KM READING
 */
export async function saveDailyReading(reading: Omit<DailyReading, 'id' | 'createdAt'>) {
  const readingId = 'reading_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const data: DailyReading = {
    ...reading,
    id: readingId,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'daily_readings', readingId), data);

    // Optionally update vehicle's last known km if this is a stop reading or higher
    const vehRef = doc(db, 'vehicles', reading.vehicleId);
    const vehSnap = await getDoc(vehRef);
    if (vehSnap.exists()) {
      const currentKm = vehSnap.data().lastKnownKm || 0;
      if (reading.km > currentKm) {
        await updateDoc(vehRef, { lastKnownKm: reading.km });
      }
    }

    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `daily_readings/${readingId}`);
  }
}

/**
 * SAVE NOTIFICATION SETTINGS
 */
export async function saveNotificationSettings(userId: string, schedules: WeekdayReminder[]) {
  try {
    const settings: NotificationSettings = {
      id: userId,
      userId,
      schedules,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'notification_settings', userId), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `notification_settings/${userId}`);
  }
}

/**
 * GET NOTIFICATION SETTINGS
 */
export async function getNotificationSettings(userId: string): Promise<WeekdayReminder[]> {
  try {
    const snap = await getDoc(doc(db, 'notification_settings', userId));
    if (snap.exists()) {
      return snap.data().schedules as WeekdayReminder[];
    }
    return DEFAULT_WEEKDAY_SCHEDULES;
  } catch (error) {
    console.warn('Error fetching notification settings, returning default:', error);
    return DEFAULT_WEEKDAY_SCHEDULES;
  }
}

/**
 * EXPORT TRIPS TO CSV
 */
export function exportTripsToCSV(trips: Trip[], filename = 'ritten_export.csv') {
  const headers = [
    'Datum',
    'Starttijd',
    'Stoptijd',
    'Wagen',
    'Nummerplaat',
    'Bestuurder',
    'Start KM',
    'Stop KM',
    'Afstand (km)',
    'KM-Afwijking start',
    'Ongebruikelijk (> Richtgetal)',
    'Doel',
    'Status',
    'Automatisch afgesloten',
    'Afsluitreden/Opmerkingen',
  ];

  const rows = trips.map((trip) => {
    const startDate = new Date(trip.startTime);
    const formattedDate = startDate.toLocaleDateString('nl-BE');
    const startTimeStr = startDate.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = trip.endTime
      ? new Date(trip.endTime).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
      : '-';
    const distance = trip.endKm && trip.endKm >= trip.startKm ? (trip.endKm - trip.startKm).toString() : '-';

    const statusLabel =
      trip.status === 'open'
        ? 'Open'
        : trip.status === 'auto_closed'
        ? 'Automatisch afgesloten'
        : 'Afgesloten';

    const discrepancyLabel = trip.hasKmDiscrepancy
      ? `${(trip.kmDiscrepancy || 0) > 0 ? '+' : ''}${trip.kmDiscrepancy} km`
      : '0 km';

    const unusualLabel = trip.isUnusualDistance
      ? `Ja (richtgetal: ${trip.expectedTripKm || 50} km)`
      : 'Nee';

    const reasonOrNotes = [trip.closedReason, trip.notes].filter(Boolean).join(' | ');

    return [
      `"${formattedDate}"`,
      `"${startTimeStr}"`,
      `"${endTimeStr}"`,
      `"${trip.vehicleName.replace(/"/g, '""')}"`,
      `"${trip.licensePlate}"`,
      `"${trip.userName.replace(/"/g, '""')}"`,
      trip.startKm,
      trip.endKm !== undefined ? trip.endKm : '',
      distance,
      `"${discrepancyLabel}"`,
      `"${unusualLabel}"`,
      `"${trip.purpose.replace(/"/g, '""')}"`,
      `"${statusLabel}"`,
      trip.closedAutomatically ? 'Ja' : 'Nee',
      `"${reasonOrNotes.replace(/"/g, '""')}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * CRUD helpers for Vehicles, Teams, and Users
 */
export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'createdAt'>) {
  const id = 'veh_' + Date.now();
  const newVeh: Vehicle = {
    ...vehicle,
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'vehicles', id), newVeh);
  return newVeh;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>) {
  await updateDoc(doc(db, 'vehicles', id), updates);
}

export async function deleteVehicle(id: string) {
  // Prevent hard delete if trips exist
  const tripCheck = query(collection(db, 'trips'), where('vehicleId', '==', id));
  const tripSnap = await getDocs(tripCheck);
  if (!tripSnap.empty) {
    throw new Error('Deze wagen heeft gekoppelde ritten en kan niet verwijderd worden. Deactiveer de wagen in de plaats.');
  }
  await deleteDoc(doc(db, 'vehicles', id));
}

export async function addTeam(team: Omit<Team, 'id' | 'createdAt'>) {
  const id = 'team_' + Date.now();
  const newTeam: Team = {
    ...team,
    id,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'teams', id), newTeam);
  return newTeam;
}

export async function updateTeam(id: string, updates: Partial<Team>) {
  await updateDoc(doc(db, 'teams', id), updates);
}

export async function updateUserProfile(
  id: string,
  updates: Partial<UserProfile>,
  currentActor?: UserProfile
) {
  if (currentActor && currentActor.role !== 'admin') {
    // 1. A fleet_admin or regular user cannot assign 'admin' role
    if (updates.role === 'admin') {
      throw new Error(
        'Onbevoegd: alleen een Systeem Administrator (admin) mag de beheerdersrol "admin" toekennen.'
      );
    }

    // 2. A fleet_admin cannot modify an existing admin profile or revoke admin rights
    const targetSnap = await getDoc(doc(db, 'profiles', id));
    if (targetSnap.exists() && targetSnap.data().role === 'admin') {
      throw new Error(
        'Onbevoegd: een Wagen Administrator mag de rechten of gegevens van een Systeem Administrator niet wijzigen.'
      );
    }
  }

  await updateDoc(doc(db, 'profiles', id), updates);
}

/**
 * Clean undefined values from an object before sending to Firestore
 */
function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * RIDE REQUEST OPERATIONS (Vervoer Zoeken)
 */
export async function createRideRequest(
  data: Omit<RideRequest, 'id' | 'createdAt' | 'lastNotifiedAt' | 'retryCount' | 'status'>
): Promise<RideRequest> {
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const newRequest: RideRequest = {
    ...data,
    id: requestId,
    status: 'pending',
    createdAt: now,
    lastNotifiedAt: now,
    retryCount: 0,
  };

  try {
    const payload = cleanUndefined(newRequest);
    await setDoc(doc(db, 'ride_requests', requestId), payload);

    // Trigger server push notification to all users currently holding an active vehicle
    fetch('/api/push/ride-request/notify-drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: newRequest.id,
        requesterId: newRequest.requesterId,
        requesterName: newRequest.requesterName,
        fromLocation: newRequest.fromLocation,
        toLocation: newRequest.toLocation,
        hasMaterials: newRequest.hasMaterials,
        notes: newRequest.notes || '',
      }),
    }).catch((err) => {
      console.warn('Could not trigger server push to drivers:', err);
    });

    return newRequest;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `ride_requests/${requestId}`);
    throw error;
  }
}

export async function acceptRideRequest(
  requestId: string,
  driver: { id: string; name: string },
  vehicle: { id: string; licensePlate: string; name: string },
  etaMinutes: number
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const reqRef = doc(db, 'ride_requests', requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) {
      throw new Error('Aanvraag niet gevonden');
    }
    const current = snap.data() as RideRequest;
    if (current.status !== 'pending') {
      throw new Error('Deze aanvraag is reeds geaccepteerd of geannuleerd.');
    }

    const updates = cleanUndefined({
      status: 'accepted' as RideRequestStatus,
      driverId: driver.id,
      driverName: driver.name,
      driverVehicleId: vehicle.id,
      driverLicensePlate: vehicle.licensePlate,
      driverVehicleName: vehicle.name || '',
      etaMinutes,
      acceptedAt: now,
    });

    await updateDoc(reqRef, updates);

    // Trigger push notification to the requester: driver is coming!
    fetch('/api/push/ride-request/notify-accepted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        requesterId: current.requesterId,
        driverName: driver.name,
        licensePlate: vehicle.licensePlate,
        vehicleName: vehicle.name,
        etaMinutes,
      }),
    }).catch((err) => {
      console.warn('Could not trigger server push to requester:', err);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ride_requests/${requestId}`);
    throw error;
  }
}

export async function cancelRideRequest(requestId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'ride_requests', requestId), {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ride_requests/${requestId}`);
    throw error;
  }
}

export async function completeRideRequest(requestId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'ride_requests', requestId), {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ride_requests/${requestId}`);
    throw error;
  }
}

/**
 * Format expected arrival time as "rond 18u20"
 */
export function formatExpectedArrivalTime(baseDate?: string, minutes: number = 10): string {
  const base = baseDate ? new Date(baseDate) : new Date();
  const arrival = new Date(base.getTime() + minutes * 60 * 1000);
  const hours = arrival.getHours();
  const mins = String(arrival.getMinutes()).padStart(2, '0');
  return `rond ${hours}u${mins}`;
}



