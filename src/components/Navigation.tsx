import React from 'react';
import {
  Car,
  PlusCircle,
  CalendarCheck,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  LogOut,
  LogIn,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'dashboard' | 'new_trip' | 'close_trip' | 'daily' | 'search' | 'admin' | 'settings';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  openTripCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  openTripCount = 0,
}) => {
  const { profile, currentUser, signInWithGoogle, logout, simulatedProfiles, switchProfile, isSimulated } =
    useAuth();

  const isFleetAdminOrAbove = profile?.role === 'fleet_admin' || profile?.role === 'admin';

  const roleLabels = {
    user: 'Medewerker',
    fleet_admin: 'Wagen Administrator',
    admin: 'Systeem Administrator',
  };

  const roleBadges = {
    user: 'bg-stone-100 text-stone-700 border-stone-200',
    fleet_admin: 'bg-blue-50 text-blue-700 border-blue-200',
    admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm transition group-hover:bg-stone-800">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-stone-900 block leading-tight">
                  WagenRit
                </span>
                <span className="text-xs text-stone-500 font-medium tracking-wide">
                  Ritten Logboek
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'dashboard'
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <Car className="w-4 h-4" />
                Ritten
                {openTripCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => onSelectTab('new_trip')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'new_trip'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Nieuwe rit
              </button>

              <button
                onClick={() => onSelectTab('daily')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'daily'
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                Dagregistratie
              </button>

              <button
                onClick={() => onSelectTab('search')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'search'
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <Search className="w-4 h-4" />
                Zoeken
              </button>

              {isFleetAdminOrAbove && (
                <button
                  onClick={() => onSelectTab('admin')}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                    activeTab === 'admin'
                      ? 'bg-stone-100 text-stone-900 font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Beheer
                </button>
              )}
            </nav>

            {/* User Profile & Role Switcher */}
            <div className="flex items-center gap-2.5">
              {/* Profile test switcher for testing multiple users */}
              <div className="hidden lg:flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg p-1 text-xs">
                <Users className="w-3.5 h-3.5 text-stone-400 ml-1.5" />
                <span className="text-stone-500 font-medium">Test als:</span>
                {simulatedProfiles.map((p) => {
                  const isCurrent = profile?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => switchProfile(p)}
                      className={`px-2 py-1 rounded text-xs font-medium transition ${
                        isCurrent
                          ? 'bg-white shadow-xs text-stone-900 font-semibold border border-stone-200'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {p.fullName.split(' ')[0]} ({p.role === 'admin' ? 'Admin' : p.role === 'fleet_admin' ? 'WagenAdmin' : 'Gebruiker'})
                    </button>
                  );
                })}
              </div>

              {/* Active User pill */}
              <div className="flex items-center gap-2 pl-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-stone-900">
                    {profile?.fullName || 'Gast'}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {profile?.role ? roleLabels[profile.role] : 'Niet ingelogd'}
                  </div>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    profile?.role ? roleBadges[profile.role] : 'bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  {profile?.role === 'admin'
                    ? 'Systeem'
                    : profile?.role === 'fleet_admin'
                    ? 'Wagen'
                    : 'Bestuurder'}
                </div>

                {currentUser ? (
                  <button
                    onClick={logout}
                    title="Afmelden"
                    className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
                    aria-label="Afmelden"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Google Inloggen</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 pb-safe">
        <div className="grid grid-cols-5 h-16">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
              activeTab === 'dashboard' ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <div className="relative">
              <Car className="w-5 h-5" />
              {openTripCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </div>
            <span>Ritten</span>
          </button>

          <button
            onClick={() => onSelectTab('new_trip')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
              activeTab === 'new_trip' ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <PlusCircle className="w-5 h-5 text-stone-900" />
            <span>Nieuw</span>
          </button>

          <button
            onClick={() => onSelectTab('daily')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
              activeTab === 'daily' ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <CalendarCheck className="w-5 h-5" />
            <span>Dagstand</span>
          </button>

          <button
            onClick={() => onSelectTab('search')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
              activeTab === 'search' ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <Search className="w-5 h-5" />
            <span>Zoeken</span>
          </button>

          {isFleetAdminOrAbove ? (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                activeTab === 'admin' ? 'text-indigo-600 font-bold' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Beheer</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('settings')}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                activeTab === 'settings' ? 'text-stone-900 font-bold' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Instellingen</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
