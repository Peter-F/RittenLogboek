import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';
import type { PushSubscription } from 'web-push';
import {
  initMariaDB,
  getDbStatus,
  dbGetVehicles,
  dbSaveVehicle,
  dbDeleteVehicle,
  dbGetTrips,
  dbCreateTrip,
  dbCloseTrip,
  dbGetTeams,
  dbSaveTeam,
  dbGetProfiles,
  dbUpdateProfile,
  dbGetAppSettings,
  dbUpdateAppSettings,
  dbGetDailyReadings,
  dbSaveDailyReading,
  dbGetRideRequests,
  dbSaveRideRequest,
  dbUpdateRideRequest,
} from './server/mariadb.ts';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

app.use(express.json());

// VAPID keys for Web Push notification protocol
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BErVxq_ME9ZNFGz4daFnH8bv8hvoYX_KtFAtXoa55IA0zkw3oS7iQ1MFgQ3o-5s9fSbeplcnEmzv3NKMdonKKbA';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'R4YE-PtcCXijhhIMaC3AbZJdeKBf6SZTMg_kpCQHDTE';
const VAPID_SUBJECT = 'mailto:info@wagenrit.be';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubRecord {
  id: string;
  userId: string;
  subscription: PushSubscription;
  createdAt: string;
  userAgent?: string;
}

// In-memory subscription storage (persisted to a local file for fast background access)
const SUBS_FILE = path.resolve(__dirname, '.push_subscriptions.json');
let subscriptions: PushSubRecord[] = [];

function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const data = fs.readFileSync(SUBS_FILE, 'utf-8');
      subscriptions = JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read subscriptions cache:', err);
  }
}

function saveSubscriptions() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.warn('Could not persist subscriptions cache:', err);
  }
}

loadSubscriptions();

// In-memory schedules cache (updated when client saves schedules)
interface CachedSchedule {
  userId: string;
  schedules: Array<{
    dayOfWeek: number;
    dayName: string;
    isActive: boolean;
    startTime: string;
    stopTime: string;
  }>;
}

const userSchedulesCache = new Map<string, CachedSchedule>();

// Active Ride Requests (Vervoer Zoeken) & 5-minute recurrence worker
interface ServerRideRequest {
  requestId: string;
  requesterId: string;
  requesterName: string;
  fromLocation: string;
  toLocation: string;
  hasMaterials: boolean;
  notes?: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: number;
  lastNotifiedAt: number;
  retryCount: number;
}

const activeRideRequests = new Map<string, ServerRideRequest>();
let activeDriversUserIds: string[] = [];

// Track sent notifications per day to avoid spamming
// key: `${userId}_${dateStr}_start_${timeStr}` or `${userId}_${dateStr}_stop_${timeStr}`
const firedReminders = new Set<string>();

/**
 * API Routes
 */

// 1. Get VAPID Public Key for client subscription
app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 2. Register/Update Push Subscription from smartphone / browser
app.post('/api/push/subscribe', (req: Request, res: Response) => {
  const { userId, subscription, schedules, userAgent } = req.body;

  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: 'Valid push subscription required' });
    return;
  }

  const subId = Buffer.from(subscription.endpoint).toString('base64').slice(0, 32);

  // Remove existing subscription with same endpoint if present
  subscriptions = subscriptions.filter((s) => s.subscription.endpoint !== subscription.endpoint);

  const newSub: PushSubRecord = {
    id: subId,
    userId: userId || 'anonymous',
    subscription,
    createdAt: new Date().toISOString(),
    userAgent: userAgent || 'Mobile Browser',
  };

  subscriptions.push(newSub);
  saveSubscriptions();

  // If user passed current schedules, update cache
  if (userId && Array.isArray(schedules)) {
    userSchedulesCache.set(userId, { userId, schedules });
  }

  res.json({
    success: true,
    message: 'Push subscription registered on server background service',
    subscriptionId: subId,
    totalActiveDevices: subscriptions.length,
  });
});

// 3. Update active user schedules in server cache
app.post('/api/push/sync-schedules', (req: Request, res: Response) => {
  const { userId, schedules } = req.body;
  if (!userId || !Array.isArray(schedules)) {
    res.status(400).json({ error: 'userId and schedules array required' });
    return;
  }
  userSchedulesCache.set(userId, { userId, schedules });
  res.json({ success: true });
});

// 4. Send Immediate Test Push Notification to the user's devices
app.post('/api/push/send-test', async (req: Request, res: Response) => {
  const { userId, subscription } = req.body;

  const targetSubs: PushSubscription[] = [];

  if (subscription && subscription.endpoint) {
    targetSubs.push(subscription);
  } else if (userId) {
    const userSubs = subscriptions.filter((s) => s.userId === userId).map((s) => s.subscription);
    targetSubs.push(...userSubs);
  } else if (subscriptions.length > 0) {
    targetSubs.push(subscriptions[subscriptions.length - 1].subscription);
  }

  if (targetSubs.length === 0) {
    res.status(404).json({ error: 'No active push subscriptions found on server' });
    return;
  }

  const payload = JSON.stringify({
    title: 'WagenRit • Tijd voor vertrek!',
    body: 'Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren.',
    tag: 'departure-reminder-test',
    url: '/?action=new_trip',
    timestamp: Date.now(),
  });

  const results: any[] = [];
  for (const sub of targetSubs) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, status: 'sent' });
    } catch (err: any) {
      console.warn('Web push delivery error:', err?.message || err);
      // Clean up dead subscriptions (e.g. 410 Gone)
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        subscriptions = subscriptions.filter((s) => s.subscription.endpoint !== sub.endpoint);
        saveSubscriptions();
      }
      results.push({ endpoint: sub.endpoint, status: 'failed', error: err?.message });
    }
  }

  res.json({
    success: true,
    results,
    message: 'Test push notification sent via background service',
  });
});

// 5. Sync list of users who currently possess an active vehicle (have open trips)
app.post('/api/push/sync-active-drivers', (req: Request, res: Response) => {
  const { driverUserIds } = req.body;
  if (Array.isArray(driverUserIds)) {
    activeDriversUserIds = driverUserIds;
  }
  res.json({ success: true, count: activeDriversUserIds.length });
});

// 6. Notify active drivers of a new ride request
app.post('/api/push/ride-request/notify-drivers', async (req: Request, res: Response) => {
  const {
    requestId,
    requesterId,
    requesterName,
    fromLocation,
    toLocation,
    hasMaterials,
    notes,
    driverUserIds,
  } = req.body;

  if (Array.isArray(driverUserIds) && driverUserIds.length > 0) {
    activeDriversUserIds = driverUserIds;
  }

  const rideReq: ServerRideRequest = {
    requestId,
    requesterId,
    requesterName: requesterName || 'Collega',
    fromLocation: fromLocation || 'Huidige locatie',
    toLocation: toLocation || 'Bestemming',
    hasMaterials: Boolean(hasMaterials),
    notes,
    status: 'pending',
    createdAt: Date.now(),
    lastNotifiedAt: Date.now(),
    retryCount: 0,
  };
  activeRideRequests.set(requestId, rideReq);

  // Target all drivers who currently have a vehicle (except requester),
  // or all other registered devices if no specific drivers were filtered
  let targetSubs = subscriptions.filter((s) => s.userId !== requesterId);
  if (activeDriversUserIds.length > 0) {
    const driverSet = new Set(activeDriversUserIds);
    const filtered = targetSubs.filter((s) => driverSet.has(s.userId));
    if (filtered.length > 0) {
      targetSubs = filtered;
    }
  }

  const payload = JSON.stringify({
    title: 'WagenRit • Vervoer gevraagd!',
    body: `${rideReq.requesterName} zoekt vervoer van ${rideReq.fromLocation} naar ${rideReq.toLocation}${
      rideReq.hasMaterials ? ' (heeft materiaal mee)' : ''
    }. Kun jij oppikken?`,
    tag: 'ride-request-' + requestId,
    url: `/?action=pickup&requestId=${requestId}`,
    data: {
      action: 'pickup',
      requestId,
    },
  });

  const sentResults: any[] = [];
  for (const sub of targetSubs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sentResults.push({ endpoint: sub.subscription.endpoint, status: 'sent' });
    } catch (err: any) {
      console.warn('Ride request push error:', err?.message);
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        subscriptions = subscriptions.filter((s) => s.subscription.endpoint !== sub.subscription.endpoint);
        saveSubscriptions();
      }
    }
  }

  res.json({ success: true, notifiedCount: sentResults.length });
});

// 7. Notify requester when a driver accepts with ETA (5/10/15m of eigen waarde)
app.post('/api/push/ride-request/notify-accepted', async (req: Request, res: Response) => {
  const { requestId, requesterId, driverName, licensePlate, etaMinutes } = req.body;

  const current = activeRideRequests.get(requestId);
  if (current) {
    current.status = 'accepted';
  }

  const now = new Date();
  const arrival = new Date(now.getTime() + (Number(etaMinutes) || 10) * 60000);
  const formatter = new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(arrival);
  const hour = parts.find((p) => p.type === 'hour')?.value || String(arrival.getHours());
  const minute = parts.find((p) => p.type === 'minute')?.value || String(arrival.getMinutes()).padStart(2, '0');
  const arrivalStr = `rond ${hour}u${minute}`;

  const requesterSubs = subscriptions.filter((s) => s.userId === requesterId);
  const payload = JSON.stringify({
    title: 'WagenRit • Vervoer gevonden!',
    body: `${driverName} (${licensePlate}) komt je oppikken! Verwachte aankomsttijd: ${arrivalStr}.`,
    tag: 'ride-accepted-' + requestId,
    url: `/?action=ride_request&requestId=${requestId}`,
    data: {
      action: 'ride_request',
      requestId,
    },
  });

  for (const sub of requesterSubs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
    } catch (err: any) {
      console.warn('Accept push error:', err?.message);
    }
  }

  res.json({ success: true, notifiedCount: requesterSubs.length });
});

// 8. Cancel a ride request
app.post('/api/push/ride-request/cancel', (req: Request, res: Response) => {
  const { requestId } = req.body;
  const current = activeRideRequests.get(requestId);
  if (current) {
    current.status = 'cancelled';
  }
  res.json({ success: true });
});

// 9. Status endpoint to check background service health
app.get('/api/push/status', (_req: Request, res: Response) => {
  res.json({
    status: 'running',
    service: 'WagenRit Background Push Worker (Step 2)',
    registeredDevices: subscriptions.length,
    cachedUserSchedules: userSchedulesCache.size,
    serverTime: new Date().toISOString(),
    belgiumTime: getBelgiumTimeString(),
  });
});

// ====================================================================
// MARIADB DATABASE & REALTIME REST API
// ====================================================================

// Realtime SSE clients
let sseClients: Response[] = [];

export function broadcastRealtimeEvent(eventType: string, data: any) {
  const payload = `data: ${JSON.stringify({ type: eventType, data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      // client disconnected
    }
  }
}

app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// Database status & diagnostic info
app.get('/api/db/status', (_req: Request, res: Response) => {
  res.json(getDbStatus());
});

app.post('/api/db/reconnect', async (_req: Request, res: Response) => {
  try {
    const status = await initMariaDB();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message, ...getDbStatus() });
  }
});

// 1. Teams
app.get('/api/teams', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetTeams();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', async (req: Request, res: Response) => {
  try {
    const team = await dbSaveTeam(req.body);
    broadcastRealtimeEvent('teams_updated', team);
    res.json(team);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Profiles
app.get('/api/profiles', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetProfiles();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profiles/:id', async (req: Request, res: Response) => {
  try {
    const updated = await dbUpdateProfile(req.params.id, req.body);
    broadcastRealtimeEvent('profiles_updated', updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Vehicles
app.get('/api/vehicles', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetVehicles();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', async (req: Request, res: Response) => {
  try {
    const veh = await dbSaveVehicle(req.body);
    broadcastRealtimeEvent('vehicles_updated', veh);
    res.json(veh);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', async (req: Request, res: Response) => {
  try {
    await dbDeleteVehicle(req.params.id);
    broadcastRealtimeEvent('vehicles_updated', { id: req.params.id, deleted: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Trips
app.get('/api/trips', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetTrips();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', async (req: Request, res: Response) => {
  try {
    const trip = await dbCreateTrip(req.body);
    broadcastRealtimeEvent('trips_updated', trip);
    broadcastRealtimeEvent('vehicles_updated', { id: trip.vehicleId, lastKnownKm: trip.endKm || trip.startKm });
    res.json(trip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trips/:id/close', async (req: Request, res: Response) => {
  try {
    const trip = await dbCloseTrip(req.params.id, req.body);
    broadcastRealtimeEvent('trips_updated', trip);
    if (req.body.vehicleId) {
      broadcastRealtimeEvent('vehicles_updated', { id: req.body.vehicleId, lastKnownKm: req.body.endKm });
    }
    res.json(trip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. App Settings
app.get('/api/app-settings', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetAppSettings();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/app-settings', async (req: Request, res: Response) => {
  try {
    const settings = await dbUpdateAppSettings(req.body);
    broadcastRealtimeEvent('settings_updated', settings);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Daily Readings
app.get('/api/daily-readings', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetDailyReadings();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-readings', async (req: Request, res: Response) => {
  try {
    const reading = await dbSaveDailyReading(req.body);
    broadcastRealtimeEvent('readings_updated', reading);
    res.json(reading);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Ride Requests (Vervoer Zoeken)
app.get('/api/ride-requests', async (_req: Request, res: Response) => {
  try {
    const data = await dbGetRideRequests();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ride-requests', async (req: Request, res: Response) => {
  try {
    const reqData = await dbSaveRideRequest(req.body);
    broadcastRealtimeEvent('ride_requests_updated', reqData);
    res.json(reqData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ride-requests/:id', async (req: Request, res: Response) => {
  try {
    const updated = await dbUpdateRideRequest(req.params.id, req.body);
    broadcastRealtimeEvent('ride_requests_updated', updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to get Belgium / Western Europe time (Brussels)
 */
function getBelgiumTimeString(): { dayOfWeek: number; timeStr: string; dateStr: string } {
  // Use Intl to get correct local time in Europe/Brussels regardless of server UTC
  const brusselsDate = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
  );
  const dayOfWeek = brusselsDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hours = String(brusselsDate.getHours()).padStart(2, '0');
  const minutes = String(brusselsDate.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  const dateStr = brusselsDate.toISOString().split('T')[0];
  return { dayOfWeek, timeStr, dateStr };
}

/**
 * STEP 2: The Background Service / Cron Worker
 * Runs every 30 seconds on the server.
 * Checks all user schedules and sends push notifications to registered phones
 * even when the browser is completely closed and the phone is locked.
 */
function runBackgroundReminderCheck() {
  const { dayOfWeek, timeStr, dateStr } = getBelgiumTimeString();

  // For each user with cached schedules
  for (const [userId, cached] of userSchedulesCache.entries()) {
    const todaySchedule = cached.schedules.find(
      (s) => s.dayOfWeek === dayOfWeek && s.isActive
    );

    if (!todaySchedule) continue;

    // 1. Check Start Time (Tijd voor vertrek!)
    if (todaySchedule.startTime && todaySchedule.startTime === timeStr) {
      const fireKey = `${userId}_${dateStr}_start_${timeStr}`;
      if (!firedReminders.has(fireKey)) {
        firedReminders.add(fireKey);

        const userSubs = subscriptions
          .filter((s) => s.userId === userId)
          .map((s) => s.subscription);

        const payload = JSON.stringify({
          title: 'WagenRit • Tijd voor vertrek!',
          body: 'Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren.',
          tag: 'departure-reminder',
          url: '/?action=new_trip',
        });

        for (const sub of userSubs) {
          webpush.sendNotification(sub, payload).catch((err: any) => {
            console.warn('Background reminder send error:', err?.message);
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              subscriptions = subscriptions.filter((s) => s.subscription.endpoint !== sub.endpoint);
              saveSubscriptions();
            }
          });
        }
      }
    }

    // 2. Check Stop Time (Einde werkdag!)
    if (todaySchedule.stopTime && todaySchedule.stopTime === timeStr) {
      const fireKey = `${userId}_${dateStr}_stop_${timeStr}`;
      if (!firedReminders.has(fireKey)) {
        firedReminders.add(fireKey);

        const userSubs = subscriptions
          .filter((s) => s.userId === userId)
          .map((s) => s.subscription);

        const payload = JSON.stringify({
          title: 'WagenRit • Einde werkdag',
          body: 'Einde van de werkdag! Vergeet je stopkilometerstand voor je gebruikte wagen niet te noteren.',
          tag: 'stop-reminder',
          url: '/?action=stop_trip',
        });

        for (const sub of userSubs) {
          webpush.sendNotification(sub, payload).catch((err: any) => {
            console.warn('Background stop reminder send error:', err?.message);
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              subscriptions = subscriptions.filter((s) => s.subscription.endpoint !== sub.endpoint);
              saveSubscriptions();
            }
          });
        }
      }
    }
  }

  // 3. Check Pending Ride Requests (Recurring push every 5 minutes until accepted)
  const now = Date.now();
  for (const [reqId, rideReq] of activeRideRequests.entries()) {
    // Clean up old completed/cancelled requests older than 2 hours
    if (rideReq.status !== 'pending' && now - rideReq.createdAt > 2 * 3600 * 1000) {
      activeRideRequests.delete(reqId);
      continue;
    }

    if (rideReq.status === 'pending') {
      // If 5 minutes have elapsed since last push notification
      if (now - rideReq.lastNotifiedAt >= 5 * 60 * 1000) {
        rideReq.lastNotifiedAt = now;
        rideReq.retryCount++;

        let targetSubs = subscriptions.filter((s) => s.userId !== rideReq.requesterId);
        if (activeDriversUserIds.length > 0) {
          const driverSet = new Set(activeDriversUserIds);
          const filtered = targetSubs.filter((s) => driverSet.has(s.userId));
          if (filtered.length > 0) {
            targetSubs = filtered;
          }
        }

        const payload = JSON.stringify({
          title: 'WagenRit • Herinnering vervoer gevraagd',
          body: `${rideReq.requesterName} zoekt nog steeds vervoer van ${rideReq.fromLocation} naar ${rideReq.toLocation}${
            rideReq.hasMaterials ? ' (met materiaal)' : ''
          }. Wie kan oppikken?`,
          tag: 'ride-request-' + rideReq.requestId,
          url: `/?action=pickup&requestId=${rideReq.requestId}`,
          data: {
            action: 'pickup',
            requestId: rideReq.requestId,
          },
        });

        for (const sub of targetSubs) {
          webpush.sendNotification(sub.subscription, payload).catch((err: any) => {
            console.warn('Retry ride request push error:', err?.message);
          });
        }
      }
    }
  }

  // Cleanup old fired reminders older than 2 days
  if (firedReminders.size > 2000) {
    firedReminders.clear();
  }
}

// Start background cron ticker every 25 seconds
setInterval(runBackgroundReminderCheck, 25000);

/**
 * Initialize Vite Dev Server or Production Static Serving
 */
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Start HTTP listener immediately so port 3000 is open in < 500ms
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WagenRit full-stack server running on http://0.0.0.0:${PORT}`);
    console.log(`⏰ Background push notification service active (Step 2)`);

    // Initialize MariaDB in the background so port 3000 binds instantly
    initMariaDB()
      .then((status) => {
        console.log(`🗄️ Database mode: ${status.mode} (connected: ${status.connected})`);
      })
      .catch((err: any) => {
        console.warn('⚠️ MariaDB background initialization warning:', err?.message);
      });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
