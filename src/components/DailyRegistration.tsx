import React, { useState, useEffect } from 'react';
import { Vehicle, DailyReading, ReadingType, WeekdayReminder, UserProfile } from '../types';
import {
  Calendar,
  Car,
  Gauge,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Save,
  Plus,
  Smartphone,
  Send,
  Info,
  ShieldCheck,
  BellRing,
} from 'lucide-react';
import {
  saveDailyReading,
  saveNotificationSettings,
  getNotificationSettings,
} from '../services/tripService';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendDepartureReminder,
  sendServerTestPush,
  syncSchedulesWithServer,
  subscribeDeviceToPushServer,
  PushPermissionStatus,
} from '../services/notificationService';

interface DailyRegistrationProps {
  user: UserProfile;
  vehicles: Vehicle[];
  readings: DailyReading[];
  onSuccess: (msg: string) => void;
}

export const DailyRegistration: React.FC<DailyRegistrationProps> = ({
  user,
  vehicles,
  readings,
  onSuccess,
}) => {
  const isSuperAdmin = user.role === 'admin';
  const userTeamIds = user.teamIds || [];
  const activeVehicles = isSuperAdmin
    ? vehicles.filter((v) => v.isActive)
    : vehicles.filter((v) => v.isActive && userTeamIds.includes(v.teamId));

  // Form states
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    activeVehicles[0]?.id || ''
  );
  const [readingType, setReadingType] = useState<ReadingType>('start');
  const [km, setKm] = useState<number>(0);
  const [savingReading, setSavingReading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  // Notification schedules
  const [schedules, setSchedules] = useState<WeekdayReminder[]>([]);
  const [savingReminders, setSavingReminders] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>('default');
  const [testingPush, setTestingPush] = useState(false);

  // Load reminders & check push permission
  useEffect(() => {
    let mounted = true;
    getNotificationSettings(user.id).then((sched) => {
      if (mounted) setSchedules(sched);
    });
    setPushStatus(getNotificationPermissionStatus());
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const handleRequestPush = async () => {
    const status = await requestNotificationPermission(user.id, schedules);
    setPushStatus(status);
    if (status === 'granted') {
      await subscribeDeviceToPushServer(user.id, schedules);
      onSuccess('Pushmeldingen succesvol gekoppeld aan de 24/7 achtergrondservice!');
    } else if (status === 'denied') {
      setReadingError('Meldingen zijn geblokkeerd in de browser. Pas dit aan in je browserinstellingen.');
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      if (pushStatus !== 'granted') {
        const status = await requestNotificationPermission(user.id, schedules);
        setPushStatus(status);
        if (status !== 'granted') {
          onSuccess('Geef eerst toestemming om pushmeldingen te ontvangen.');
          return;
        }
      }
      const sent = await sendServerTestPush(user.id);
      if (sent) {
        onSuccess('Testmelding via achtergrondservice verstuurd: "Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren."');
      } else {
        onSuccess('Melding kon niet worden verzonden. Controleer je notificatie-instellingen.');
      }
    } finally {
      setTestingPush(false);
    }
  };


  // Set default km from selected vehicle
  const selectedVehicle = activeVehicles.find((v) => v.id === selectedVehicleId);
  useEffect(() => {
    if (selectedVehicle) {
      setKm(selectedVehicle.lastKnownKm || 0);
    }
  }, [selectedVehicleId]);

  // Existing readings for selected day & vehicle
  const dayVehicleReadings = readings
    .filter((r) => r.readingDate === selectedDate && r.vehicleId === selectedVehicleId)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setReadingError(null);

    if (!selectedVehicle) {
      setReadingError('Selecteer alstublieft een wagen.');
      return;
    }

    if (km <= 0 || isNaN(km)) {
      setReadingError('Voer een geldige kilometerstand in.');
      return;
    }

    try {
      setSavingReading(true);
      await saveDailyReading({
        teamId: selectedVehicle.teamId,
        vehicleId: selectedVehicle.id,
        userId: user.id,
        userName: user.fullName,
        readingDate: selectedDate,
        readingType,
        km: Number(km),
        recordedAt: new Date().toISOString(),
      });

      onSuccess(
        `Dagregistratie (${readingType === 'start' ? 'Startkm' : 'Stopkm'}: ${km} km) succesvol opgeslagen!`
      );
    } catch (err: any) {
      console.error('Error saving reading:', err);
      setReadingError(err.message || 'Kon dagregistratie niet opslaan.');
    } finally {
      setSavingReading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: 'startTime' | 'stopTime',
    val: string
  ) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: val } : s))
    );
  };

  const handleSaveReminders = async () => {
    try {
      setSavingReminders(true);
      await saveNotificationSettings(user.id, schedules);
      await syncSchedulesWithServer(user.id, schedules);
      if (pushStatus === 'granted') {
        await subscribeDeviceToPushServer(user.id, schedules);
      }
      onSuccess('Herinneringsinstellingen succesvol opgeslagen en gesynchroniseerd met de 24/7 achtergrondservice!');
    } catch (err) {
      console.error('Error saving notification settings:', err);
    } finally {
      setSavingReminders(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 md:pb-8 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Dagregistratie & Herinneringen
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Registreer de begin- of eindstand van de wagen en beheer wekelijkse herinneringen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: Dagelijkse KM Invoer */}
        <section aria-labelledby="dagstand-heading" className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-stone-100">
            <Gauge className="w-5 h-5 text-stone-900" />
            <h2 id="dagstand-heading" className="text-base font-bold text-stone-900">
              Kilometerstand invoeren
            </h2>
          </div>

          {readingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{readingError}</span>
            </div>
          )}

          <form onSubmit={handleSaveReading} className="space-y-4">
            {/* Datum */}
            <div>
              <label htmlFor="readingDate" className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Datum
              </label>
              <input
                id="readingDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
                required
              />
            </div>

            {/* Wagen */}
            <div>
              <label htmlFor="readingVehicle" className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Wagen
              </label>
              <select
                id="readingVehicle"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium bg-white"
              >
                {activeVehicles.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    {veh.licensePlate} – {veh.brand} {veh.model} ({veh.lastKnownKm.toLocaleString('nl-BE')} km)
                  </option>
                ))}
              </select>
            </div>

            {/* Type: Startkm of Stopkm */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Type registratie
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReadingType('start')}
                  className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    readingType === 'start'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Startkm (ochtend)
                </button>
                <button
                  type="button"
                  onClick={() => setReadingType('stop')}
                  className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 ${
                    readingType === 'stop'
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Stopkm (avond)
                </button>
              </div>
            </div>

            {/* KM stand */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="readingKm" className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Kilometerstand
                </label>
                {selectedVehicle && (
                  <span className="text-xs text-stone-400">
                    Laatste bekende stand: {selectedVehicle.lastKnownKm.toLocaleString('nl-BE')} km
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="readingKm"
                  type="number"
                  min="1"
                  step="1"
                  value={km || ''}
                  onChange={(e) => setKm(Number(e.target.value))}
                  className="w-full text-lg font-mono font-bold px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900"
                  required
                />
                <span className="absolute right-4 top-3 text-stone-400 font-bold text-xs">
                  KM
                </span>
              </div>
            </div>

            {/* Opslaan button */}
            <button
              type="submit"
              disabled={savingReading}
              className="w-full py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingReading ? 'Bezig met opslaan...' : 'Dagstand opslaan'}
            </button>
          </form>

          {/* Eerder ingegeven waarden voor die dag en wagen */}
          <div className="pt-4 border-t border-stone-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
              Eerdere registraties op {selectedDate}
            </h3>
            {dayVehicleReadings.length === 0 ? (
              <p className="text-xs text-stone-400 italic">
                Nog geen dagstanden voor deze wagen op deze datum.
              </p>
            ) : (
              <div className="space-y-2">
                {dayVehicleReadings.map((reading) => (
                  <div
                    key={reading.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[11px] mr-2 ${
                          reading.readingType === 'start'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {reading.readingType === 'start' ? 'Startstand' : 'Stopstand'}
                      </span>
                      <span className="text-stone-600">Door {reading.userName}</span>
                    </div>
                    <div className="font-mono font-bold text-stone-900">
                      {reading.km.toLocaleString('nl-BE')} km
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: Lokale herinneringen per weekdag */}
        <section aria-labelledby="herinneringen-heading" className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-stone-900" />
              <h2 id="herinneringen-heading" className="text-base font-bold text-stone-900">
                Wekelijkse Herinneringen
              </h2>
            </div>
            <span className="text-xs text-stone-500 font-medium">Persoonlijk</span>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Stel herinneringstijden in om 's ochtends de vertrekstand en 's avonds de stopstand van de wagen niet te vergeten.
          </p>

          {/* Push Notificaties Status & Test paneel */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-stone-800" />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Mobiele Push Notificaties
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    24/7 Server Achtergrondservice actief
                  </span>
                </div>
              </div>
              <div>
                {pushStatus === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Gekoppeld aan gsm
                  </span>
                ) : pushStatus === 'denied' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Geblokkeerd
                  </span>
                ) : pushStatus === 'unsupported' ? (
                  <span className="text-[11px] font-semibold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">
                    Niet ondersteund
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    Toestel nog koppelen
                  </span>
                )}
              </div>
            </div>

            {/* Inschakelknop als nog niet granted */}
            {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestPush}
                className="w-full py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Pushmeldingen inschakelen op dit toestel
              </button>
            )}

            {/* Test knop & Preview van de exacte tekst */}
            <div className="pt-2 border-t border-stone-200/80 space-y-2">
              <div className="text-[11px] text-stone-600 bg-white p-2.5 rounded-lg border border-stone-200 shadow-2xs">
                <span className="font-semibold text-stone-800 block mb-0.5">
                  Berichtvoorbeeld bij vertrektijd:
                </span>
                <span className="italic text-stone-700">
                  &ldquo;Tijd voor vertrek! Vergeet je startkilometerstand voor je gebruikte wagen niet te noteren.&rdquo;
                </span>
              </div>

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={testingPush}
                className="w-full py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-white text-stone-800 font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Send className="w-3.5 h-3.5 text-stone-600" />
                {testingPush ? 'Verzenden...' : 'Stuur testmelding naar mijn gsm'}
              </button>
            </div>

            {/* Smartphone installatie gids */}
            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>iPhone (iOS 16.4+) tip:</strong> Tik in Safari onderaan op het <strong>&lsquo;Deel&rsquo;</strong> icoon (vierkantje met pijl omhoog) en kies <strong>&lsquo;Zet op beginscherm&rsquo;</strong>. Open vervolgens de app vanaf je beginscherm om meldingen te ontvangen.
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {schedules.map((schedule) => (
              <div
                key={schedule.dayOfWeek}
                className={`p-3 rounded-xl border transition-all ${
                  schedule.isActive
                    ? 'bg-stone-50/70 border-stone-300'
                    : 'bg-stone-50/20 border-stone-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`day-${schedule.dayOfWeek}`}
                      checked={schedule.isActive}
                      onChange={() => handleToggleDay(schedule.dayOfWeek)}
                      className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
                    />
                    <label
                      htmlFor={`day-${schedule.dayOfWeek}`}
                      className="text-xs font-semibold text-stone-800 cursor-pointer w-24"
                    >
                      {schedule.dayName}
                    </label>
                  </div>

                  {schedule.isActive ? (
                    <div className="flex items-center gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Start</span>
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) =>
                            handleTimeChange(schedule.dayOfWeek, 'startTime', e.target.value)
                          }
                          className="px-2 py-1 rounded border border-stone-300 text-xs font-mono font-medium"
                        />
                      </div>
                      <span className="text-stone-300 mt-3">—</span>
                      <div>
                        <span className="text-[10px] text-stone-400 block">Stop</span>
                        <input
                          type="time"
                          value={schedule.stopTime}
                          onChange={(e) =>
                            handleTimeChange(schedule.dayOfWeek, 'stopTime', e.target.value)
                          }
                          className="px-2 py-1 rounded border border-stone-300 text-xs font-mono font-medium"
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400 italic">Uitgeschakeld</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveReminders}
            disabled={savingReminders}
            className="w-full py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 font-semibold text-stone-800 text-xs shadow-xs transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {savingReminders ? 'Bezig met opslaan...' : 'Herinneringen opslaan'}
          </button>
        </section>
      </div>
    </div>
  );
};
