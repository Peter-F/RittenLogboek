import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { VehicleQuickActionView } from './components/VehicleQuickActionView';
import { DailyRegistration } from './components/DailyRegistration';
import { SearchTrips } from './components/SearchTrips';
import { AdminPanel } from './components/AdminPanel';
import { SettingsView } from './components/SettingsView';
import { RideRequestView } from './components/RideRequestView';
import { DriverPickupModal } from './components/DriverPickupModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import {
  Trip,
  Vehicle,
  Team,
  DailyReading,
  UserProfile,
  AppSettings,
  WeekdayReminder,
  RideRequest,
} from './types';
import { Compass, Package } from 'lucide-react';
import {
  seedInitialDataIfEmpty,
  INITIAL_VEHICLES,
  INITIAL_TEAMS,
  INITIAL_PROFILES,
  DEFAULT_APP_SETTINGS,
  getLatestVehicleMileage,
  getNotificationSettings,
  subscribeToRealtimeEvents,
  fetchAllTrips,
  fetchAllVehicles,
  fetchAllTeams,
  fetchAllProfiles,
  fetchAllDailyReadings,
  fetchAllRideRequests,
  getAppSettings,
} from './services/tripService';
import {
  registerServiceWorker,
  startReminderWatcher,
  subscribeDeviceToPushServer,
} from './services/notificationService';

function MainApp() {
  const { profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Realtime Firestore collections state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [dailyReadings, setDailyReadings] = useState<DailyReading[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>(INITIAL_PROFILES);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([]);
  const [pickupModalRequest, setPickupModalRequest] = useState<RideRequest | null>(null);

  // Scanned vehicle from QR code URL query (?vehicleId=...)
  const [scannedVehicleId, setScannedVehicleId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('vehicleId');
      return p || null;
    }
    return null;
  });

  // In-page close trip target (no popups)
  const [tripToClose, setTripToClose] = useState<Trip | null>(null);

  // Currently selected vehicle for 1-screen quick action (Start or Stop rit)
  const [selectedActionVehicle, setSelectedActionVehicle] = useState<Vehicle | null>(null);

  const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Seed default data and register service worker + auto-sync push subscription if granted
  useEffect(() => {
    seedInitialDataIfEmpty();
    registerServiceWorker().then(() => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const currentUserId = profile?.id || INITIAL_PROFILES[0].id;
        getNotificationSettings(currentUserId).then((schedules) => {
          subscribeDeviceToPushServer(currentUserId, schedules);
        });
      }
    });
  }, [profile?.id]);

  // Background reminder watcher for scheduled weekday notifications
  useEffect(() => {
    const currentUserId = profile?.id || INITIAL_PROFILES[0].id;
    let cachedSchedules: WeekdayReminder[] = [];

    getNotificationSettings(currentUserId).then((s) => {
      cachedSchedules = s;
    });

    const stopWatcher = startReminderWatcher(
      () => cachedSchedules,
      (type) => {
        if (type === 'start') {
          addToast(
            'Pushmelding verzonden: "Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren."',
            'info'
          );
        } else {
          addToast(
            'Pushmelding verzonden: "Einde van de werkdag! Vergeet je stopkilometerstand voor je gebruikte wagen niet te noteren."',
            'info'
          );
        }
      }
    );

    return () => {
      stopWatcher();
    };
  }, [profile?.id]);


  // Load data and listen for realtime Server-Sent Events (SSE) from MariaDB backend
  useEffect(() => {
    let isMounted = true;

    const loadAllData = async () => {
      try {
        const [
          fetchedTrips,
          fetchedVehicles,
          fetchedTeams,
          fetchedReadings,
          fetchedProfiles,
          fetchedSettings,
          fetchedRideReqs,
        ] = await Promise.all([
          fetchAllTrips(),
          fetchAllVehicles(),
          fetchAllTeams(),
          fetchAllDailyReadings(),
          fetchAllProfiles(),
          getAppSettings(),
          fetchAllRideRequests(),
        ]);

        if (!isMounted) return;
        if (fetchedTrips) setTrips(fetchedTrips);
        if (fetchedVehicles && fetchedVehicles.length > 0) setVehicles(fetchedVehicles);
        if (fetchedTeams && fetchedTeams.length > 0) setTeams(fetchedTeams);
        if (fetchedReadings) setDailyReadings(fetchedReadings);
        if (fetchedProfiles && fetchedProfiles.length > 0) setAllProfiles(fetchedProfiles);
        if (fetchedSettings) setAppSettings(fetchedSettings);
        if (fetchedRideReqs) setRideRequests(fetchedRideReqs);
      } catch (err) {
        console.warn('Initial data load warning:', err);
      }
    };

    loadAllData();

    // Subscribe to realtime SSE stream from MariaDB server
    const unsubscribeSSE = subscribeToRealtimeEvents((event) => {
      if (!isMounted) return;
      switch (event.type) {
        case 'trips':
          if (Array.isArray(event.data)) setTrips(event.data);
          break;
        case 'vehicles':
          if (Array.isArray(event.data)) setVehicles(event.data);
          break;
        case 'teams':
          if (Array.isArray(event.data)) setTeams(event.data);
          break;
        case 'daily_readings':
          if (Array.isArray(event.data)) setDailyReadings(event.data);
          break;
        case 'profiles':
          if (Array.isArray(event.data)) setAllProfiles(event.data);
          break;
        case 'app_settings':
          if (event.data) setAppSettings(event.data);
          break;
        case 'ride_requests':
          if (Array.isArray(event.data)) setRideRequests(event.data);
          break;
      }
    });

    // Periodic sync every 20 seconds for high resilience
    const interval = setInterval(loadAllData, 20000);

    return () => {
      isMounted = false;
      unsubscribeSSE();
      clearInterval(interval);
    };
  }, []);

  // Sync active drivers who possess a vehicle to the server for push targeting
  useEffect(() => {
    const activeOpenTrips = trips.filter((t) => t.status === 'open');
    const activeUserIds = Array.from(new Set(activeOpenTrips.map((t) => t.userId)));
    fetch('/api/push/sync-active-drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeDriverUserIds: activeUserIds }),
    }).catch((err) => {
      console.debug('Active drivers sync failed:', err);
    });
  }, [trips]);

  // URL query parameter detection: ?action=pickup&requestId=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      const reqId = params.get('requestId');
      if (action === 'pickup' && reqId && rideRequests.length > 0) {
        const found = rideRequests.find((r) => r.id === reqId && r.status === 'pending');
        if (found) {
          setPickupModalRequest(found);
        }
      }
    }
  }, [rideRequests]);

  // Resolve QR scanned vehicle if URL has ?vehicleId=...
  const scannedVehicle = scannedVehicleId
    ? vehicles.find(
        (v) =>
          v.id === scannedVehicleId ||
          v.licensePlate.toLowerCase().replace(/[^a-z0-9]/g, '') ===
            scannedVehicleId.toLowerCase().replace(/[^a-z0-9]/g, '')
      ) || null
    : null;

  // Active vehicle for the compact 1-screen smartphone UI (always resolve with latest data from vehicles state)
  const currentSelectedVehicle = selectedActionVehicle
    ? vehicles.find((v) => v.id === selectedActionVehicle.id) || selectedActionVehicle
    : null;

  const activeActionVehicle =
    scannedVehicle ||
    currentSelectedVehicle ||
    (tripToClose
      ? vehicles.find((v) => v.id === tripToClose.vehicleId) || null
      : null);

  // Active open trip for current user
  const myOpenTrip = trips.find(
    (t) => t.userId === profile?.id && t.status === 'open'
  );

  const resetActionState = () => {
    setSelectedActionVehicle(null);
    setScannedVehicleId(null);
    setTripToClose(null);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    resetActionState();
    setActiveTab(tab);
  };

  const handleOpenCloseTripView = (trip: Trip) => {
    const veh = vehicles.find((v) => v.id === trip.vehicleId);
    if (veh) {
      setSelectedActionVehicle(veh);
    }
    setTripToClose(trip);
  };

  const handleStartTripForVehicle = (veh: Vehicle) => {
    setSelectedActionVehicle(veh);
  };

  const currentUser = profile || INITIAL_PROFILES[0];
  const userTeamIds = currentUser.teamIds || [];
  const isSuperAdmin = currentUser.role === 'admin';

  // Vehicles accessible by the current user
  const accessibleVehicles = isSuperAdmin
    ? vehicles.filter((v) => v.isActive)
    : vehicles.filter((v) => v.isActive && userTeamIds.includes(v.teamId));

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-stone-600">Ritten Logboek laden...</p>
        </div>
      </div>
    );
  }

  const pendingRideRequests = rideRequests.filter((r) => r.status === 'pending');
  const isDriverHoldingVehicle = Boolean(myOpenTrip);

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased selection:bg-stone-900 selection:text-white">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Navigation (Desktop Header + Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeActionVehicle ? 'new_trip' : activeTab}
        onSelectTab={handleSelectTab}
        openTripCount={myOpenTrip ? 1 : 0}
        rideRequestModuleEnabled={appSettings.rideRequestModuleEnabled ?? true}
        pendingRideRequestCount={pendingRideRequests.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {/* Driver quick alert banner if logged in user holds a car and colleagues need a ride */}
        {pendingRideRequests.length > 0 && isDriverHoldingVehicle && activeTab === 'dashboard' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-900 shrink-0">
                <Compass className="w-5 h-5 text-amber-700 animate-spin" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Oproep voor collega oppikken!
                </div>
                <div className="text-sm font-bold text-stone-900">
                  {pendingRideRequests[0].requesterName} zoekt vervoer van{' '}
                  <span className="text-emerald-700 font-semibold">{pendingRideRequests[0].fromLocation}</span> naar{' '}
                  <span className="text-indigo-700 font-semibold">{pendingRideRequests[0].toLocation}</span>
                </div>
                {pendingRideRequests[0].hasMaterials && (
                  <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1 mt-0.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>Collega heeft materiaal mee dat vervoerd moet worden</span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPickupModalRequest(pendingRideRequests[0])}
              className="py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] shrink-0"
            >
              Ik pik collega op
            </button>
          </div>
        )}
        {/* 1. SCENARIO: A vehicle is active (via QR code scan or direct selection)
            Strictly 1 visible smartphone screen: Top vehicle header, adjustable KM, purpose dropdown + editable, Start/Stop rit button or Cancel.
            NO OTHER VEHICLE IS PROPOSED! */}
        {activeActionVehicle ? (
          <VehicleQuickActionView
            vehicle={activeActionVehicle}
            currentUser={currentUser}
            openTrips={trips}
            availablePurposes={appSettings.purposes}
            expectedDailyKm={
              activeActionVehicle.expectedDailyKm ||
              appSettings.defaultExpectedDailyKm ||
              50
            }
            onSuccess={(msg) => {
              addToast(msg, 'success');
              resetActionState();
              setActiveTab('dashboard');
            }}
            onCancel={() => {
              resetActionState();
              setActiveTab('dashboard');
            }}
          />
        ) : scannedVehicleId && !scannedVehicle ? (
          /* Scanned ID in URL, but vehicle not found in database */
          <div className="max-w-md mx-auto bg-white p-6 rounded-2xl border border-stone-200 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              ⚠️
            </div>
            <h2 className="text-base font-bold text-stone-900">
              Wagen niet gevonden
            </h2>
            <p className="text-xs text-stone-500">
              De gescande QR-code verwijst naar wagen ID &ldquo;{scannedVehicleId}&rdquo;, maar deze bestaat niet meer of is inactief.
            </p>
            <button
              onClick={() => {
                resetActionState();
                setActiveTab('dashboard');
              }}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-semibold text-xs"
            >
              Naar Dashboard
            </button>
          </div>
        ) : activeTab === 'dashboard' ? (
          <Dashboard
            user={currentUser}
            trips={trips}
            vehicles={vehicles}
            teams={teams}
            onOpenNewTrip={() => {
              // If only 1 accessible vehicle, go directly to 1-screen action!
              if (accessibleVehicles.length === 1) {
                setSelectedActionVehicle(accessibleVehicles[0]);
              } else {
                setActiveTab('new_trip');
              }
            }}
            onOpenCloseTrip={handleOpenCloseTripView}
            onViewAllTrips={() => setActiveTab('search')}
          />
        ) : activeTab === 'new_trip' ? (
          /* If user clicked 'Nieuwe rit' tab manually and no vehicle was selected yet:
             Show quick 1-tap car choice, tapping ANY car opens the 1-screen smartphone UI immediately! */
          <div className="max-w-md mx-auto space-y-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <h1 className="text-base font-bold text-stone-900">
                In welke wagen stap je in?
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Tik op jouw wagen om direct de rit te starten of af te sluiten.
              </p>
            </div>

            {accessibleVehicles.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-stone-200 text-center text-xs text-stone-500">
                Geen actieve wagens beschikbaar voor jouw team(s).
              </div>
            ) : (
              <div className="space-y-2">
                {accessibleVehicles.map((veh) => {
                  const openTripForVeh = trips.find(
                    (t) => t.vehicleId === veh.id && t.status === 'open'
                  );
                  const isMyTrip = openTripForVeh?.userId === currentUser.id;

                  return (
                    <button
                      key={veh.id}
                      type="button"
                      onClick={() => handleStartTripForVehicle(veh)}
                      className="w-full text-left bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-900 p-3.5 rounded-2xl transition shadow-xs flex items-center justify-between group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-300 text-stone-900">
                          {veh.licensePlate}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-stone-900 group-hover:text-stone-950">
                            {veh.brand} {veh.model}
                          </div>
                          {veh.nickname && (
                            <div className="text-[11px] text-stone-400 italic">
                              &ldquo;{veh.nickname}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-semibold text-stone-600">
                          {getLatestVehicleMileage(veh, trips).toLocaleString('nl-BE')} km
                        </div>
                        {openTripForVeh && (
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                              isMyTrip
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {isMyTrip ? 'Jouw rit' : 'In gebruik'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'daily' && (
          <DailyRegistration
            user={currentUser}
            vehicles={vehicles}
            readings={dailyReadings}
            onSuccess={(msg) => addToast(msg, 'success')}
          />
        )}

        {activeTab === 'search' && (
          <SearchTrips
            trips={trips}
            vehicles={vehicles}
            teams={teams}
            currentUser={currentUser}
            profiles={allProfiles}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            currentUser={currentUser}
            trips={trips}
            vehicles={vehicles}
            teams={teams}
            profiles={allProfiles}
            appSettings={appSettings}
            onAppSettingsChange={(newS) => setAppSettings(newS)}
            onSuccess={(msg) => addToast(msg, 'success')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={currentUser}
            teams={teams}
            onSuccess={(msg) => addToast(msg, 'info')}
          />
        )}

        {/* Vervoer Zoeken & Collega Oppikken Module */}
        {activeTab === 'ride_request' && (
          <RideRequestView
            currentUser={currentUser}
            appSettings={appSettings}
            rideRequests={rideRequests}
            openTrips={trips}
            vehicles={vehicles}
            onSuccess={(msg) => addToast(msg, 'success')}
            onOpenDriverModal={(req) => setPickupModalRequest(req)}
          />
        )}

        {/* Modal for driver picking up colleague */}
        {pickupModalRequest && (
          <DriverPickupModal
            request={pickupModalRequest}
            currentUser={currentUser}
            openTrips={trips}
            vehicles={accessibleVehicles.length > 0 ? accessibleVehicles : vehicles}
            onClose={() => {
              setPickupModalRequest(null);
              if (
                typeof window !== 'undefined' &&
                window.location.search.includes('action=pickup')
              ) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            }}
            onSuccess={(msg) => {
              addToast(msg, 'success');
              setPickupModalRequest(null);
              if (
                typeof window !== 'undefined' &&
                window.location.search.includes('action=pickup')
              ) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
