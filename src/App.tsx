import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { VehicleQuickActionView } from './components/VehicleQuickActionView';
import { DailyRegistration } from './components/DailyRegistration';
import { SearchTrips } from './components/SearchTrips';
import { AdminPanel } from './components/AdminPanel';
import { SettingsView } from './components/SettingsView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Trip, Vehicle, Team, DailyReading, UserProfile, AppSettings } from './types';
import {
  seedInitialDataIfEmpty,
  INITIAL_VEHICLES,
  INITIAL_TEAMS,
  INITIAL_PROFILES,
  DEFAULT_APP_SETTINGS,
  getLatestVehicleMileage,
} from './services/tripService';

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

  // Seed default data if empty on start
  useEffect(() => {
    seedInitialDataIfEmpty();
  }, []);

  // Realtime listeners for Firestore
  useEffect(() => {
    const unsubTrips = onSnapshot(
      collection(db, 'trips'),
      (snap) => {
        const items = snap.docs.map((doc) => doc.data() as Trip);
        setTrips(items);
      },
      (error) => {
        console.warn('Trips listener error:', error);
      }
    );

    const unsubVehicles = onSnapshot(
      collection(db, 'vehicles'),
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((doc) => doc.data() as Vehicle);
          setVehicles(items);
        }
      },
      (error) => {
        console.warn('Vehicles listener error:', error);
      }
    );

    const unsubTeams = onSnapshot(
      collection(db, 'teams'),
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((doc) => doc.data() as Team);
          setTeams(items);
        }
      },
      (error) => {
        console.warn('Teams listener error:', error);
      }
    );

    const unsubReadings = onSnapshot(
      collection(db, 'daily_readings'),
      (snap) => {
        const items = snap.docs.map((doc) => doc.data() as DailyReading);
        setDailyReadings(items);
      },
      (error) => {
        console.warn('Readings listener error:', error);
      }
    );

    const unsubProfiles = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((doc) => doc.data() as UserProfile);
          setAllProfiles(items);
        }
      },
      (error) => {
        console.warn('Profiles listener error:', error);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'app_settings', 'global_settings'),
      (snap) => {
        if (snap.exists()) {
          setAppSettings(snap.data() as AppSettings);
        }
      },
      (error) => {
        console.warn('Settings listener error:', error);
      }
    );

    return () => {
      unsubTrips();
      unsubVehicles();
      unsubTeams();
      unsubReadings();
      unsubProfiles();
      unsubSettings();
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased selection:bg-stone-900 selection:text-white">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Navigation (Desktop Header + Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeActionVehicle ? 'new_trip' : activeTab}
        onSelectTab={handleSelectTab}
        openTripCount={myOpenTrip ? 1 : 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
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
