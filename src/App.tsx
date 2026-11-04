import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation, NavTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { NewTripView } from './components/NewTripView';
import { CloseTripView } from './components/CloseTripView';
import { DailyRegistration } from './components/DailyRegistration';
import { SearchTrips } from './components/SearchTrips';
import { AdminPanel } from './components/AdminPanel';
import { SettingsView } from './components/SettingsView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Trip, Vehicle, Team, DailyReading, UserProfile } from './types';
import {
  seedInitialDataIfEmpty,
  INITIAL_VEHICLES,
  INITIAL_TEAMS,
  INITIAL_PROFILES,
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

  // In-page close trip target (no popups)
  const [tripToClose, setTripToClose] = useState<Trip | null>(null);

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

    return () => {
      unsubTrips();
      unsubVehicles();
      unsubTeams();
      unsubReadings();
      unsubProfiles();
    };
  }, []);

  // Active open trip for current user
  const myOpenTrip = trips.find(
    (t) => t.userId === profile?.id && t.status === 'open'
  );

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
  };

  const handleOpenCloseTripView = (trip: Trip) => {
    setTripToClose(trip);
    setActiveTab('close_trip');
  };

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

  const currentUser = profile || INITIAL_PROFILES[0];

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased selection:bg-stone-900 selection:text-white">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Navigation (Desktop Header + Mobile Bottom Bar) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        openTripCount={myOpenTrip ? 1 : 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={currentUser}
            trips={trips}
            vehicles={vehicles}
            teams={teams}
            onOpenNewTrip={() => setActiveTab('new_trip')}
            onOpenCloseTrip={handleOpenCloseTripView}
            onViewAllTrips={() => setActiveTab('search')}
          />
        )}

        {/* IN-PAGE: Nieuwe rit starten (NO POPUP) */}
        {activeTab === 'new_trip' && (
          <NewTripView
            vehicles={vehicles}
            openTrips={trips}
            teams={teams}
            currentUser={currentUser}
            onSuccess={(msg) => {
              addToast(msg, 'success');
              setActiveTab('dashboard');
            }}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {/* IN-PAGE: Rit afsluiten (NO POPUP) */}
        {activeTab === 'close_trip' && (
          <CloseTripView
            trip={tripToClose || myOpenTrip || trips[0]}
            onSuccess={(msg) => {
              addToast(msg, 'success');
              setTripToClose(null);
              setActiveTab('dashboard');
            }}
            onCancel={() => {
              setTripToClose(null);
              setActiveTab('dashboard');
            }}
          />
        )}

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
