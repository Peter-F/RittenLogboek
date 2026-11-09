import mariadb, { Pool, PoolConnection, Connection } from 'mariadb';
import fs from 'fs';
import path from 'path';

export interface DatabaseStatus {
  connected: boolean;
  mode: 'mariadb' | 'fallback';
  host: string;
  port: number;
  database: string;
  user: string;
  ssl?: boolean;
  usingFallback: boolean;
  serverVersion?: string;
  error?: string;
}

let pool: Pool | null = null;
let isConnected = false;
let connectionError: string | null = null;
let serverVersionString: string | undefined = undefined;

// Fallback in-memory state when MariaDB host is not configured or not yet reachable
const FALLBACK_FILE = path.resolve(process.cwd(), '.mariadb_local_store.json');

interface LocalStore {
  teams: any[];
  profiles: any[];
  vehicles: any[];
  trips: any[];
  daily_readings: any[];
  app_settings: any;
  ride_requests: any[];
}

const DEFAULT_LOCAL_STORE: LocalStore = {
  teams: [
    {
      id: 'team_bouw',
      name: 'Bouw & Montage',
      description: 'Ploegen voor werven, ruwbouw en montagewerken',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'team_service',
      name: 'Service & Onderhoud',
      description: 'Techniekers voor interventies, depannages en onderhoud',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'team_centraal',
      name: 'Centraal Wagenpark',
      description: 'Gedeelde poolwagens voor algemeen bedrijfsgebruik',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ],
  profiles: [
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
  ],
  vehicles: [
    {
      id: 'veh_1_abc_123',
      teamId: 'team_bouw',
      licensePlate: '1-ABC-123',
      brand: 'Volkswagen',
      model: 'Transporter T6',
      nickname: 'De Grote Witte',
      isActive: true,
      lastKnownKm: 142500,
      expectedDailyKm: 50,
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
      expectedDailyKm: 60,
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
      expectedDailyKm: 40,
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
      expectedDailyKm: 50,
      createdAt: new Date().toISOString(),
    },
  ],
  trips: [],
  daily_readings: [],
  app_settings: {
    id: 'global_settings',
    purposes: [
      'Klantbezoek',
      'Werf / Installatie',
      'Materiaal ophalen / Leverancier',
      'Interventie / Storing',
      'Onderhoud / Keuring',
      'Hoofdzetel / Magazijn',
      'Woon-werk / Verplaatsing',
    ],
    defaultExpectedDailyKm: 50,
    rideRequestModuleEnabled: true,
    updatedAt: new Date().toISOString(),
  },
  ride_requests: [],
};

let localStore: LocalStore = { ...DEFAULT_LOCAL_STORE };

// Load local store from disk if exists
try {
  if (fs.existsSync(FALLBACK_FILE)) {
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    localStore = { ...DEFAULT_LOCAL_STORE, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('Could not load local fallback store:', e);
}

function saveLocalStore() {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(localStore, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not save local store to disk:', e);
  }
}

/**
 * Initialize MariaDB Connection Pool
 */
export async function initMariaDB(): Promise<DatabaseStatus> {
  const rawHost = process.env.MARIADB_HOST || '';
  let cleanHost = rawHost.trim().replace(/^(tcp|ssl|https?):\/\//i, '');
  let port = parseInt(process.env.MARIADB_PORT || '3306', 10);

  // Extract host and port if passed together like "0.tcp.eu.ngrok.io:24206"
  if (cleanHost.includes(':')) {
    const parts = cleanHost.split(':');
    cleanHost = parts[0];
    if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
      port = parseInt(parts[1], 10);
    }
  }

  const user = process.env.MARIADB_USER || 'root';
  const password = process.env.MARIADB_PASSWORD || '';
  const database = process.env.MARIADB_DATABASE || 'wagenrit';

  if (!cleanHost) {
    connectionError = 'Geen MARIADB_HOST opgegeven in omgevingsvariabelen (.env)';
    isConnected = false;
    console.log('ℹ️ MariaDB: Geen MARIADB_HOST geconfigureerd. Lokale fallback data-opslag actief.');
    return getDbStatus();
  }

  // Close previous pool if open
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
  }

  console.log(`🔌 Verbinding testen met MariaDB op ${cleanHost}:${port}/${database}...`);

  // Step 1: Perform a quick single connection handshake first.
  // This completely avoids unhandled pool retry errors if the server/tunnel is unreachable or closed!
  let testConn: Connection | null = null;
  try {
    testConn = await mariadb.createConnection({
      host: cleanHost,
      port,
      user,
      password,
      database,
      connectTimeout: 4000,
      ssl: process.env.MARIADB_SSL === 'true' ? true : undefined,
    });

    const versionRes = await testConn.query('SELECT VERSION() as version');
    serverVersionString = versionRes[0]?.version || 'MariaDB';
    console.log(`✅ Succesvol verbonden met MariaDB! Versie: ${serverVersionString}`);
    await testConn.end();
    testConn = null;
  } catch (err: any) {
    if (testConn) {
      try {
        await testConn.end();
      } catch (_) {}
      testConn = null;
    }

    isConnected = false;
    let friendlyMessage = err?.message || 'Verbinding mislukt';
    if (err?.code === 'ER_SOCKET_UNEXPECTED_CLOSE') {
      friendlyMessage = 'De externe server verbrak de verbinding direct (mogelijk is de ngrok-tunnel of MariaDB-service lokaal gestopt).';
    } else if (err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND') {
      friendlyMessage = `Kon host '${cleanHost}:${port}' niet bereiken (time-out of onbereikbaar adres).`;
    } else if (err?.code === 'ER_ACCESS_DENIED_ERROR') {
      friendlyMessage = `Toegang geweigerd voor gebruiker '${user}' op database '${database}'.`;
    }
    connectionError = friendlyMessage;
    console.log(`ℹ️ MariaDB tijdelijk niet bereikbaar (${friendlyMessage}). Lokale fallback modus actief.`);
    return getDbStatus();
  }

  // Step 2: Now that single connection succeeded, create pool and verify tables
  try {
    pool = mariadb.createPool({
      host: cleanHost,
      port,
      user,
      password,
      database,
      connectionLimit: 10,
      acquireTimeout: 4000,
      connectTimeout: 4000,
      ssl: process.env.MARIADB_SSL === 'true' ? true : undefined,
    });

    const conn = await pool.getConnection();
    await createTablesIfNotExist(conn);
    await seedMariaDBIfEmpty(conn);
    conn.release();

    isConnected = true;
    connectionError = null;
  } catch (err: any) {
    if (pool) {
      try {
        await pool.end();
      } catch (_) {}
      pool = null;
    }
    isConnected = false;
    connectionError = err?.message || 'Fout bij initialiseren van tabellen';
    console.warn(`⚠️ MariaDB tabel initialisatie waarschuwing:`, err?.message);
  }

  return getDbStatus();
}

export function getDbStatus(): DatabaseStatus {
  const rawHost = process.env.MARIADB_HOST || '';
  let cleanHost = rawHost.trim().replace(/^(tcp|ssl|https?):\/\//i, '');
  let port = parseInt(process.env.MARIADB_PORT || '3306', 10);
  if (cleanHost.includes(':')) {
    const parts = cleanHost.split(':');
    cleanHost = parts[0];
    if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
      port = parseInt(parts[1], 10);
    }
  }

  return {
    connected: isConnected,
    mode: isConnected ? 'mariadb' : 'fallback',
    host: cleanHost || 'Niet geconfigureerd (lokaal actief)',
    port,
    database: process.env.MARIADB_DATABASE || 'wagenrit',
    user: process.env.MARIADB_USER || 'root',
    ssl: process.env.MARIADB_SSL === 'true',
    usingFallback: !isConnected,
    serverVersion: serverVersionString,
    error: connectionError || undefined,
  };
}

/**
 * Execute DDL table creation queries
 */
async function createTablesIfNotExist(conn: PoolConnection) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(64) PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      team_ids JSON NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id VARCHAR(64) PRIMARY KEY,
      team_id VARCHAR(64) NOT NULL,
      license_plate VARCHAR(32) NOT NULL UNIQUE,
      brand VARCHAR(64) NOT NULL,
      model VARCHAR(64) NOT NULL,
      nickname VARCHAR(128) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_known_km INT NOT NULL DEFAULT 0,
      expected_daily_km INT NULL,
      created_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id VARCHAR(64) PRIMARY KEY,
      team_id VARCHAR(64) NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NULL,
      license_plate VARCHAR(32) NOT NULL,
      vehicle_name VARCHAR(128) NOT NULL,
      start_time VARCHAR(64) NOT NULL,
      start_km INT NOT NULL,
      end_time VARCHAR(64) NULL,
      end_km INT NULL,
      purpose VARCHAR(255) NOT NULL,
      notes TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      closed_automatically TINYINT(1) NOT NULL DEFAULT 0,
      closed_reason TEXT NULL,
      closed_by_user_id VARCHAR(64) NULL,
      closed_by_user_name VARCHAR(255) NULL,
      km_discrepancy INT NULL,
      has_km_discrepancy TINYINT(1) NOT NULL DEFAULT 0,
      is_unusual_distance TINYINT(1) NOT NULL DEFAULT 0,
      expected_trip_km INT NULL,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS daily_readings (
      id VARCHAR(64) PRIMARY KEY,
      team_id VARCHAR(64) NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      reading_date VARCHAR(32) NOT NULL,
      reading_type VARCHAR(16) NOT NULL,
      km INT NOT NULL,
      recorded_at VARCHAR(64) NOT NULL,
      created_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id VARCHAR(64) PRIMARY KEY,
      purposes JSON NOT NULL,
      default_expected_daily_km INT NOT NULL DEFAULT 50,
      ride_request_module_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS ride_requests (
      id VARCHAR(64) PRIMARY KEY,
      requester_id VARCHAR(64) NOT NULL,
      requester_name VARCHAR(255) NOT NULL,
      requester_phone VARCHAR(64) NULL,
      team_id VARCHAR(64) NULL,
      from_location VARCHAR(255) NOT NULL,
      to_location VARCHAR(255) NOT NULL,
      has_materials TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at VARCHAR(64) NOT NULL,
      last_notified_at VARCHAR(64) NOT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      driver_id VARCHAR(64) NULL,
      driver_name VARCHAR(255) NULL,
      driver_vehicle_id VARCHAR(64) NULL,
      driver_license_plate VARCHAR(32) NULL,
      driver_vehicle_name VARCHAR(128) NULL,
      eta_minutes INT NULL,
      accepted_at VARCHAR(64) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/**
 * Seed initial records in MariaDB if empty
 */
async function seedMariaDBIfEmpty(conn: PoolConnection) {
  const teamCount = await conn.query('SELECT COUNT(*) as count FROM teams');
  if (teamCount[0]?.count === 0n || teamCount[0]?.count === 0) {
    for (const t of DEFAULT_LOCAL_STORE.teams) {
      await conn.query(
        'INSERT INTO teams (id, name, description, is_active, created_at) VALUES (?, ?, ?, ?, ?)',
        [t.id, t.name, t.description, t.isActive ? 1 : 0, t.createdAt]
      );
    }

    for (const p of DEFAULT_LOCAL_STORE.profiles) {
      await conn.query(
        'INSERT INTO profiles (id, full_name, email, role, team_ids, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.fullName, p.email, p.role, JSON.stringify(p.teamIds), p.isActive ? 1 : 0, p.createdAt]
      );
    }

    for (const v of DEFAULT_LOCAL_STORE.vehicles) {
      await conn.query(
        'INSERT INTO vehicles (id, team_id, license_plate, brand, model, nickname, is_active, last_known_km, expected_daily_km, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [v.id, v.teamId, v.licensePlate, v.brand, v.model, v.nickname, v.isActive ? 1 : 0, v.lastKnownKm, v.expectedDailyKm, v.createdAt]
      );
    }

    const s = DEFAULT_LOCAL_STORE.app_settings;
    await conn.query(
      'INSERT INTO app_settings (id, purposes, default_expected_daily_km, ride_request_module_enabled, updated_at) VALUES (?, ?, ?, ?, ?)',
      [s.id, JSON.stringify(s.purposes), s.defaultExpectedDailyKm, s.rideRequestModuleEnabled ? 1 : 0, s.updatedAt]
    );
  }
}

// -------------------------------------------------------------
// CRUD Operations (with dual-mode: MariaDB SQL + Local Fallback)
// -------------------------------------------------------------

export async function dbGetTeams() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM teams WHERE is_active = 1 ORDER BY name ASC');
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
    }));
  }
  return localStore.teams;
}

export async function dbSaveTeam(team: any) {
  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO teams (id, name, description, is_active, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = VALUES(is_active)`,
      [team.id, team.name, team.description, team.isActive ? 1 : 0, team.createdAt]
    );
  }
  const idx = localStore.teams.findIndex((t) => t.id === team.id);
  if (idx >= 0) {
    localStore.teams[idx] = { ...localStore.teams[idx], ...team };
  } else {
    localStore.teams.push(team);
  }
  saveLocalStore();
  return team;
}

export async function dbGetProfiles() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM profiles ORDER BY full_name ASC');
    return rows.map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      role: r.role,
      teamIds: typeof r.team_ids === 'string' ? JSON.parse(r.team_ids) : r.team_ids || [],
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
    }));
  }
  return localStore.profiles;
}

export async function dbUpdateProfile(id: string, updates: any) {
  if (isConnected && pool) {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.teamIds !== undefined) {
      fields.push('team_ids = ?');
      values.push(JSON.stringify(updates.teamIds));
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  }
  const idx = localStore.profiles.findIndex((p) => p.id === id);
  if (idx >= 0) {
    localStore.profiles[idx] = { ...localStore.profiles[idx], ...updates };
    saveLocalStore();
    return localStore.profiles[idx];
  }
  return null;
}

export async function dbGetVehicles() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM vehicles ORDER BY license_plate ASC');
    return rows.map((r: any) => ({
      id: r.id,
      teamId: r.team_id,
      licensePlate: r.license_plate,
      brand: r.brand,
      model: r.model,
      nickname: r.nickname,
      isActive: Boolean(r.is_active),
      lastKnownKm: Number(r.last_known_km),
      expectedDailyKm: r.expected_daily_km ? Number(r.expected_daily_km) : undefined,
      createdAt: r.created_at,
    }));
  }
  return localStore.vehicles;
}

export async function dbSaveVehicle(veh: any) {
  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO vehicles (id, team_id, license_plate, brand, model, nickname, is_active, last_known_km, expected_daily_km, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         team_id = VALUES(team_id),
         license_plate = VALUES(license_plate),
         brand = VALUES(brand),
         model = VALUES(model),
         nickname = VALUES(nickname),
         is_active = VALUES(is_active),
         last_known_km = VALUES(last_known_km),
         expected_daily_km = VALUES(expected_daily_km)`,
      [
        veh.id,
        veh.teamId,
        veh.licensePlate,
        veh.brand,
        veh.model,
        veh.nickname || null,
        veh.isActive ? 1 : 0,
        veh.lastKnownKm || 0,
        veh.expectedDailyKm || null,
        veh.createdAt,
      ]
    );
  }
  const idx = localStore.vehicles.findIndex((v) => v.id === veh.id);
  if (idx >= 0) {
    localStore.vehicles[idx] = { ...localStore.vehicles[idx], ...veh };
  } else {
    localStore.vehicles.push(veh);
  }
  saveLocalStore();
  return veh;
}

export async function dbDeleteVehicle(id: string) {
  if (isConnected && pool) {
    await pool.query('DELETE FROM vehicles WHERE id = ?', [id]);
  }
  localStore.vehicles = localStore.vehicles.filter((v) => v.id !== id);
  saveLocalStore();
}

export async function dbGetTrips() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM trips ORDER BY start_time DESC LIMIT 500');
    return rows.map((r: any) => ({
      id: r.id,
      teamId: r.team_id,
      vehicleId: r.vehicle_id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      licensePlate: r.license_plate,
      vehicleName: r.vehicle_name,
      startTime: r.start_time,
      startKm: Number(r.start_km),
      endTime: r.end_time || undefined,
      endKm: r.end_km !== null ? Number(r.end_km) : undefined,
      purpose: r.purpose,
      notes: r.notes || undefined,
      status: r.status,
      closedAutomatically: Boolean(r.closed_automatically),
      closedReason: r.closed_reason || undefined,
      closedByUserId: r.closed_by_user_id || undefined,
      closedByUserName: r.closed_by_user_name || undefined,
      kmDiscrepancy: r.km_discrepancy !== null ? Number(r.km_discrepancy) : undefined,
      hasKmDiscrepancy: Boolean(r.has_km_discrepancy),
      isUnusualDistance: Boolean(r.is_unusual_distance),
      expectedTripKm: r.expected_trip_km ? Number(r.expected_trip_km) : undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
  return localStore.trips;
}

export async function dbCreateTrip(trip: any) {
  // Business rule 1: If there is an open trip on this vehicle, auto-close it atomically!
  const now = new Date().toISOString();
  if (isConnected && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Find any existing open trip for this vehicle
      const openRows = await conn.query(
        'SELECT * FROM trips WHERE vehicle_id = ? AND status = "open"',
        [trip.vehicleId]
      );

      for (const openTrip of openRows) {
        await conn.query(
          `UPDATE trips SET
             end_time = ?,
             end_km = ?,
             status = 'auto_closed',
             closed_automatically = 1,
             closed_reason = ?,
             closed_by_user_id = ?,
             closed_by_user_name = ?,
             updated_at = ?
           WHERE id = ?`,
          [
            trip.startTime,
            trip.startKm,
            `Automatisch overgedragen naar ${trip.userName}`,
            trip.userId,
            trip.userName,
            now,
            openTrip.id,
          ]
        );
      }

      // Insert new trip
      await conn.query(
        `INSERT INTO trips (
           id, team_id, vehicle_id, user_id, user_name, user_email,
           license_plate, vehicle_name, start_time, start_km, end_time, end_km,
           purpose, notes, status, closed_automatically, closed_reason,
           km_discrepancy, has_km_discrepancy, is_unusual_distance, expected_trip_km,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trip.id,
          trip.teamId || null,
          trip.vehicleId,
          trip.userId,
          trip.userName,
          trip.userEmail || null,
          trip.licensePlate,
          trip.vehicleName,
          trip.startTime,
          trip.startKm,
          trip.endTime || null,
          trip.endKm !== undefined ? trip.endKm : null,
          trip.purpose,
          trip.notes || null,
          trip.status,
          trip.closedAutomatically ? 1 : 0,
          trip.closedReason || null,
          trip.kmDiscrepancy !== undefined ? trip.kmDiscrepancy : null,
          trip.hasKmDiscrepancy ? 1 : 0,
          trip.isUnusualDistance ? 1 : 0,
          trip.expectedTripKm || null,
          trip.createdAt,
          trip.updatedAt,
        ]
      );

      // Update vehicle last known km
      await conn.query('UPDATE vehicles SET last_known_km = ? WHERE id = ?', [
        trip.endKm || trip.startKm,
        trip.vehicleId,
      ]);

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // Update in local store
  for (const t of localStore.trips) {
    if (t.vehicleId === trip.vehicleId && t.status === 'open') {
      t.status = 'auto_closed';
      t.closedAutomatically = true;
      t.endTime = trip.startTime;
      t.endKm = trip.startKm;
      t.closedReason = `Automatisch overgedragen naar ${trip.userName}`;
      t.closedByUserId = trip.userId;
      t.closedByUserName = trip.userName;
      t.updatedAt = now;
    }
  }
  localStore.trips.unshift(trip);

  const veh = localStore.vehicles.find((v) => v.id === trip.vehicleId);
  if (veh) {
    veh.lastKnownKm = trip.endKm || trip.startKm;
  }
  saveLocalStore();
  return trip;
}

export async function dbCloseTrip(tripId: string, updates: any) {
  if (isConnected && pool) {
    await pool.query(
      `UPDATE trips SET
         end_time = ?,
         end_km = ?,
         status = ?,
         closed_automatically = ?,
         closed_reason = ?,
         closed_by_user_id = ?,
         closed_by_user_name = ?,
         is_unusual_distance = ?,
         expected_trip_km = ?,
         updated_at = ?
       WHERE id = ?`,
      [
        updates.endTime,
        updates.endKm,
        updates.status,
        updates.closedAutomatically ? 1 : 0,
        updates.closedReason || null,
        updates.closedByUserId || null,
        updates.closedByUserName || null,
        updates.isUnusualDistance ? 1 : 0,
        updates.expectedTripKm || null,
        updates.updatedAt,
        tripId,
      ]
    );

    if (updates.vehicleId && updates.endKm) {
      await pool.query('UPDATE vehicles SET last_known_km = ? WHERE id = ?', [
        updates.endKm,
        updates.vehicleId,
      ]);
    }
  }

  const t = localStore.trips.find((x) => x.id === tripId);
  if (t) {
    Object.assign(t, updates);
  }
  if (updates.vehicleId && updates.endKm) {
    const v = localStore.vehicles.find((x) => x.id === updates.vehicleId);
    if (v) v.lastKnownKm = updates.endKm;
  }
  saveLocalStore();
  return t;
}

export async function dbGetAppSettings() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM app_settings WHERE id = "global_settings"');
    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        purposes: typeof r.purposes === 'string' ? JSON.parse(r.purposes) : r.purposes,
        defaultExpectedDailyKm: Number(r.default_expected_daily_km),
        rideRequestModuleEnabled: Boolean(r.ride_request_module_enabled),
        updatedAt: r.updated_at,
      };
    }
  }
  return localStore.app_settings;
}

export async function dbUpdateAppSettings(updates: any) {
  const current = await dbGetAppSettings();
  const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };

  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO app_settings (id, purposes, default_expected_daily_km, ride_request_module_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         purposes = VALUES(purposes),
         default_expected_daily_km = VALUES(default_expected_daily_km),
         ride_request_module_enabled = VALUES(ride_request_module_enabled),
         updated_at = VALUES(updated_at)`,
      [
        'global_settings',
        JSON.stringify(merged.purposes),
        merged.defaultExpectedDailyKm,
        merged.rideRequestModuleEnabled ? 1 : 0,
        merged.updatedAt,
      ]
    );
  }

  localStore.app_settings = merged;
  saveLocalStore();
  return merged;
}

export async function dbGetDailyReadings() {
  if (isConnected && pool) {
    const rows = await pool.query('SELECT * FROM daily_readings ORDER BY recorded_at DESC LIMIT 500');
    return rows.map((r: any) => ({
      id: r.id,
      teamId: r.team_id,
      vehicleId: r.vehicle_id,
      userId: r.user_id,
      userName: r.user_name,
      readingDate: r.reading_date,
      readingType: r.reading_type,
      km: Number(r.km),
      recordedAt: r.recorded_at,
      createdAt: r.created_at,
    }));
  }
  return localStore.daily_readings;
}

export async function dbSaveDailyReading(reading: any) {
  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO daily_readings (id, team_id, vehicle_id, user_id, user_name, reading_date, reading_type, km, recorded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reading.id,
        reading.teamId || null,
        reading.vehicleId,
        reading.userId,
        reading.userName,
        reading.readingDate,
        reading.readingType,
        reading.km,
        reading.recordedAt,
        reading.createdAt,
      ]
    );

    // Update vehicle km if higher
    await pool.query(
      'UPDATE vehicles SET last_known_km = GREATEST(last_known_km, ?) WHERE id = ?',
      [reading.km, reading.vehicleId]
    );
  }

  localStore.daily_readings.unshift(reading);
  const veh = localStore.vehicles.find((v) => v.id === reading.vehicleId);
  if (veh && reading.km > veh.lastKnownKm) {
    veh.lastKnownKm = reading.km;
  }
  saveLocalStore();
  return reading;
}

export async function dbGetRideRequests() {
  if (isConnected && pool) {
    const rows = await pool.query(
      'SELECT * FROM ride_requests WHERE status IN ("pending", "accepted") OR created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ORDER BY created_at DESC'
    );
    return rows.map((r: any) => ({
      id: r.id,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      requesterPhone: r.requester_phone || undefined,
      teamId: r.team_id || undefined,
      fromLocation: r.from_location,
      toLocation: r.to_location,
      hasMaterials: Boolean(r.has_materials),
      notes: r.notes || undefined,
      status: r.status,
      createdAt: r.created_at,
      lastNotifiedAt: r.last_notified_at,
      retryCount: Number(r.retry_count),
      driverId: r.driver_id || undefined,
      driverName: r.driver_name || undefined,
      driverVehicleId: r.driver_vehicle_id || undefined,
      driverLicensePlate: r.driver_license_plate || undefined,
      driverVehicleName: r.driver_vehicle_name || undefined,
      etaMinutes: r.eta_minutes !== null ? Number(r.eta_minutes) : undefined,
      acceptedAt: r.accepted_at || undefined,
    }));
  }
  return localStore.ride_requests;
}

export async function dbSaveRideRequest(req: any) {
  if (isConnected && pool) {
    await pool.query(
      `INSERT INTO ride_requests (
         id, requester_id, requester_name, requester_phone, team_id,
         from_location, to_location, has_materials, notes, status,
         created_at, last_notified_at, retry_count
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         last_notified_at = VALUES(last_notified_at),
         retry_count = VALUES(retry_count)`,
      [
        req.id,
        req.requesterId,
        req.requesterName,
        req.requesterPhone || null,
        req.teamId || null,
        req.fromLocation,
        req.toLocation,
        req.hasMaterials ? 1 : 0,
        req.notes || null,
        req.status,
        req.createdAt,
        req.lastNotifiedAt,
        req.retryCount || 0,
      ]
    );
  }

  const idx = localStore.ride_requests.findIndex((x) => x.id === req.id);
  if (idx >= 0) {
    localStore.ride_requests[idx] = { ...localStore.ride_requests[idx], ...req };
  } else {
    localStore.ride_requests.unshift(req);
  }
  saveLocalStore();
  return req;
}

export async function dbUpdateRideRequest(id: string, updates: any) {
  if (isConnected && pool) {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.driverId !== undefined) {
      fields.push('driver_id = ?');
      values.push(updates.driverId);
    }
    if (updates.driverName !== undefined) {
      fields.push('driver_name = ?');
      values.push(updates.driverName);
    }
    if (updates.driverVehicleId !== undefined) {
      fields.push('driver_vehicle_id = ?');
      values.push(updates.driverVehicleId);
    }
    if (updates.driverLicensePlate !== undefined) {
      fields.push('driver_license_plate = ?');
      values.push(updates.driverLicensePlate);
    }
    if (updates.driverVehicleName !== undefined) {
      fields.push('driver_vehicle_name = ?');
      values.push(updates.driverVehicleName);
    }
    if (updates.etaMinutes !== undefined) {
      fields.push('eta_minutes = ?');
      values.push(updates.etaMinutes);
    }
    if (updates.acceptedAt !== undefined) {
      fields.push('accepted_at = ?');
      values.push(updates.acceptedAt);
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE ride_requests SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  }

  const req = localStore.ride_requests.find((x) => x.id === id);
  if (req) {
    Object.assign(req, updates);
    saveLocalStore();
  }
  return req;
}
