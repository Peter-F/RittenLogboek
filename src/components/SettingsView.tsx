import React from 'react';
import { UserProfile, Team } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  Building,
  LogIn,
  LogOut,
  Info,
  CheckCircle2,
  Users,
  Car,
} from 'lucide-react';

interface SettingsViewProps {
  user: UserProfile;
  teams: Team[];
  onSuccess: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, teams, onSuccess }) => {
  const {
    currentUser,
    signInWithGoogle,
    logout,
    simulatedProfiles,
    switchProfile,
    isSimulated,
  } = useAuth();

  const userTeams = teams.filter((t) => (user.teamIds || []).includes(t.id));

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Instellingen & Account
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Beheer jouw profiel, bekijk teamlidmaatschappen en wissel van testaccount.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
            {user.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900">{user.fullName}</h2>
            <p className="text-xs text-stone-500">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-100 text-xs">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">Rol in systeem:</span>
            <span className="font-bold text-stone-900 text-sm">
              {user.role === 'admin'
                ? 'Systeem Administrator'
                : user.role === 'fleet_admin'
                ? 'Wagen Administrator'
                : 'Gebruiker / Medewerker'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">Toegewezen wagenpark(en):</span>
            <span className="font-bold text-stone-900 text-sm">
              {userTeams.length > 0
                ? userTeams.map((t) => t.name).join(', ')
                : 'Alle / Algemeen'}
            </span>
          </div>
        </div>

        {/* Google login / logout button */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {currentUser ? 'Aangemeld met Google' : 'Momenteel in test/gastmodus'}
          </span>
          {currentUser ? (
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Afmelden
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              Inloggen met Google
            </button>
          )}
        </div>
      </div>

      {/* Test / Simuleer Profiel Switcher */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-stone-900">
            Snel wisselen tussen testaccounts
          </h2>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          Om de automatische ritoverdracht te testen tussen <strong>Gebruiker A</strong> en{' '}
          <strong>Gebruiker B</strong> op dezelfde browser, kun je hier eenvoudig schakelen:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {simulatedProfiles.map((p) => {
            const isCurrent = user.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  switchProfile(p);
                  onSuccess(`Geschakeld naar account van ${p.fullName}`);
                }}
                className={`p-3.5 rounded-xl border text-left transition ${
                  isCurrent
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/10'
                    : 'border-stone-200 hover:border-stone-400 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-stone-900">{p.fullName}</span>
                  {isCurrent && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <span className="text-[11px] text-stone-500 block truncate">{p.email}</span>
                <span className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-stone-200 text-stone-700">
                  {p.role === 'admin'
                    ? 'Systeembeheer'
                    : p.role === 'fleet_admin'
                    ? 'Wagenbeheer'
                    : 'Bestuurder'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Information about business rule */}
      <div className="p-5 rounded-2xl bg-stone-100 border border-stone-200 text-xs text-stone-600 space-y-2">
        <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
          <Info className="w-4 h-4 text-stone-700" />
          Belangrijkste bedrijfsregel: Automatische ritoverdracht
        </div>
        <p className="leading-relaxed">
          Per wagen kan er te allen tijde slechts <strong>één openstaande rit</strong> bestaan. Als
          Gebruiker B een nieuwe rit start voor een wagen die nog openstaat op naam van Gebruiker A,
          sluit het systeem de rit van Gebruiker A direct af met de starttijd en startkilometerstand
          van Gebruiker B (status: <em>automatisch afgesloten</em>).
        </p>
      </div>
    </div>
  );
};
