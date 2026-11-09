import React, { useState, useEffect } from 'react';
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
  Download,
  Smartphone,
  Laptop,
  Share2,
  Copy,
  ExternalLink,
  Database,
  Server,
  RefreshCw,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import { getDbStatus, reconnectDb } from '../services/tripService';

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

  // PWA installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // MariaDB database status
  const [dbInfo, setDbInfo] = useState<{
    connected: boolean;
    mode: string;
    host: string;
    port: number;
    database: string;
    user: string;
    ssl: boolean;
    error?: string;
  } | null>(null);
  const [checkingDb, setCheckingDb] = useState<boolean>(false);

  const checkConnection = async (isManual = false) => {
    setCheckingDb(true);
    try {
      const status = isManual ? await reconnectDb() : await getDbStatus();
      setDbInfo(status);
      if (isManual) {
        if (status.connected) {
          onSuccess(`Verbonden met MariaDB (${status.host}:${status.port})!`);
        } else {
          onSuccess(`Status bijgewerkt: Lokale fallback actief (${status.error || 'Server offline'})`);
        }
      }
    } catch (e) {
      console.warn('DB check error:', e);
    } finally {
      setCheckingDb(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      ) {
        setIsInstalled(true);
      }

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      onSuccess('WagenRit app succesvol geïnstalleerd op je apparaat!');
    }
    setDeferredPrompt(null);
  };

  const handleCopyAppUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      onSuccess('App-link gekopieerd naar klembord!');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

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

      {/* MariaDB Database Status Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
              <Database className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">
                  MariaDB Database
                </h2>
                {dbInfo?.connected ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Verbonden
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Lokale Fallback Modus
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Relationele SQL-opslag voor alle ritten, wagens, teams en instellingen
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => checkConnection(true)}
            disabled={checkingDb}
            className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingDb ? 'animate-spin' : ''}`} />
            <span>{checkingDb ? 'Testen...' : 'Verbinding testen'}</span>
          </button>
        </div>

        {/* Diagnostic alert if not connected */}
        {!dbInfo?.connected && dbInfo?.error && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Diagnose van databaseverbinding:</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {dbInfo.error}
              </p>
              <p className="text-[11px] text-stone-500">
                Tip: Als je gebruikmaakt van een tunnel zoals <em>ngrok tcp 3306</em>, controleer of ngrok en je lokale MariaDB service actief zijn. Zodra je tunnel online is, klik je op &ldquo;Verbinding testen&rdquo;.
              </p>
            </div>
          </div>
        )}

        {/* Status Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500 block">Status & Modus</span>
            <span className="font-bold text-stone-900 capitalize flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-stone-600" />
              {dbInfo?.mode === 'mariadb' ? 'MariaDB SQL Server' : 'Lokale Fallback'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500 block">Host & Poort</span>
            <span className="font-bold text-stone-900 truncate block">
              {dbInfo?.host ? `${dbInfo.host}:${dbInfo.port || 3306}` : 'Nog niet ingesteld'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500 block">Database Naam</span>
            <span className="font-bold text-stone-900 truncate block">
              {dbInfo?.database || 'wagenrit'}
            </span>
          </div>
        </div>

        {/* Informative notice */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2 text-stone-600 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-stone-900 text-xs">
            <Code2 className="w-4 h-4 text-blue-600" />
            <span>Hoe verbind je jouw externe MariaDB database?</span>
          </div>
          <p className="text-[11px]">
            In de root van de app staat het SQL-schema <strong>src/db/schema.sql</strong>. Voeg je servergegevens toe aan je <strong>.env</strong> bestand:
          </p>
          <div className="p-2.5 rounded-lg bg-stone-900 text-emerald-400 font-mono text-[11px] overflow-x-auto space-y-0.5">
            <div>MARIADB_HOST=jouw-server-ip-of-domein</div>
            <div>MARIADB_PORT=3306</div>
            <div>MARIADB_USER=wagenrit_user</div>
            <div>MARIADB_PASSWORD=jouw_geheim_wachtwoord</div>
            <div>MARIADB_DATABASE=wagenrit</div>
            <div>MARIADB_SSL=false</div>
          </div>
          <p className="text-[11px] text-stone-500">
            Dankzij de ingebouwde veerkracht werkt de applicatie altijd: als er geen MariaDB server bereikbaar is,
            schakelt het systeem automatisch over naar de veilige lokale opslag zonder crashes.
          </p>
        </div>
      </div>

      {/* PWA INSTALLATION GUIDE & ACTION */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-xs">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                WagenRit installeren als app
              </h2>
              <p className="text-xs text-stone-500">
                PWA: Werkt als een volwaardige native app op je smartphone, tablet en computer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Installeer Nu</span>
              </button>
            )}

            {isInstalled && (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Geïnstalleerd
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyAppUrl}
              className="px-3 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'Gekopieerd!' : 'Link kopiëren'}</span>
            </button>
          </div>
        </div>

        {/* 3 Platform instruction cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          {/* 1. Android */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Android (Google Chrome)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-600 leading-relaxed text-[11px]">
              <li>Open de app-link in <strong>Chrome</strong>.</li>
              <li>Tik op de <strong>3 puntjes (⋮)</strong> rechtsboven in de browser.</li>
              <li>Kies <strong>&ldquo;App installeren&rdquo;</strong> of <strong>&ldquo;Toevoegen aan startscherm&rdquo;</strong>.</li>
              <li>Het WagenRit-icoontje staat nu direct op je startscherm en opent schermvullend zonder adresbalk.</li>
            </ol>
          </div>

          {/* 2. iPhone / iPad */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span>iPhone / iPad (Safari)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-600 leading-relaxed text-[11px]">
              <li>Open de app-link in <strong>Safari</strong>.</li>
              <li>Tik onderaan op het <strong>Deel-icoon</strong> (vierkantje met pijl omhoog).</li>
              <li>Scrol naar beneden en tik op <strong>&ldquo;Zet op beginscherm&rdquo;</strong> (met het <strong>+</strong> teken).</li>
              <li>Tik rechtsboven op <strong>&ldquo;Voeg toe&rdquo;</strong>. De app verschijnt tussen je smartphone-apps.</li>
            </ol>
          </div>

          {/* 3. Computer / Desktop */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-stone-900">
              <Laptop className="w-4 h-4 text-indigo-600" />
              <span>PC / Mac (Chrome of Edge)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-stone-600 leading-relaxed text-[11px]">
              <li>Open de link in <strong>Chrome</strong> of <strong>Edge</strong>.</li>
              <li>Klik in de adresbalk rechts op het <strong>Installatie-icoon</strong> (computerscherm met pijl).</li>
              <li>Klik op <strong>&ldquo;Installeren&rdquo;</strong>.</li>
              <li>WagenRit opent als een zelfstandig programma met eigen venster en taakbalk-icoon.</li>
            </ol>
          </div>
        </div>

        {/* Benefits banner */}
        <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Geen download via de Google Play Store of Apple App Store nodig. Geïnstalleerde updates zijn altijd direct automatisch actief!
            </span>
          </div>
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
