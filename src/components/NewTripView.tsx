import React, { useState, useEffect } from 'react';
import { Vehicle, Trip, UserProfile, Team } from '../types';
import {
  Car,
  AlertTriangle,
  MapPin,
  FileText,
  Gauge,
  ArrowLeft,
  Check,
  Info,
  Building,
  Clock,
} from 'lucide-react';
import { startNewTrip } from '../services/tripService';

interface NewTripViewProps {
  vehicles: Vehicle[];
  openTrips: Trip[];
  teams: Team[];
  currentUser: UserProfile;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

const COMMON_PURPOSES = [
  'Klantbezoek',
  'Werkplaats',
  'Materiaal ophalen',
  'Werfinspectie',
  'Interventie / Storing',
  'Levering goederen',
];

// Helper to format date to local datetime-local format: YYYY-MM-DDTHH:mm
function getNowLocalString(date: Date = new Date()): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export const NewTripView: React.FC<NewTripViewProps> = ({
  vehicles,
  openTrips,
  teams,
  currentUser,
  onSuccess,
  onCancel,
}) => {
  const isSuperAdmin = currentUser.role === 'admin';
  const userTeamIds = currentUser.teamIds || [];

  // Filter vehicles: regular users only see vehicles from their assigned teams
  const userVisibleVehicles = isSuperAdmin
    ? vehicles.filter((v) => v.isActive)
    : vehicles.filter((v) => v.isActive && userTeamIds.includes(v.teamId));

  const userVisibleTeams = isSuperAdmin
    ? teams.filter((t) => t.isActive)
    : teams.filter((t) => t.isActive && userTeamIds.includes(t.id));

  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    userVisibleVehicles[0]?.id || ''
  );

  const filteredVehicles =
    selectedTeamFilter === 'all'
      ? userVisibleVehicles
      : userVisibleVehicles.filter((v) => v.teamId === selectedTeamFilter);

  const selectedVehicle = userVisibleVehicles.find((v) => v.id === selectedVehicleId);

  // Check if selected vehicle has an open trip by another user
  const existingOpenTrip = openTrips.find(
    (t) => t.vehicleId === selectedVehicleId && t.status === 'open'
  );
  const isOpenByOther =
    existingOpenTrip && existingOpenTrip.userId !== currentUser.id;
  const isOpenBySelf =
    existingOpenTrip && existingOpenTrip.userId === currentUser.id;

  const [startKm, setStartKm] = useState<number>(selectedVehicle?.lastKnownKm || 0);
  const [startTimeLocal, setStartTimeLocal] = useState<string>(getNowLocalString());
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Maximum allowed time is the current moment of registration
  const maxDateTimeLocal = getNowLocalString();

  // Quick preset helper
  const setStartTimeMinutesAgo = (minutesAgo: number) => {
    const d = new Date(Date.now() - minutesAgo * 60 * 1000);
    setStartTimeLocal(getNowLocalString(d));
  };

  // Sync startKm when selectedVehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      setStartKm(selectedVehicle.lastKnownKm || 0);
    }
  }, [selectedVehicleId, selectedVehicle]);

  // Keep selectedVehicleId valid if vehicles change
  useEffect(() => {
    if (filteredVehicles.length > 0 && !filteredVehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(filteredVehicles[0].id);
    }
  }, [selectedTeamFilter, filteredVehicles, selectedVehicleId]);

  const isKmLessThanRecorded =
    selectedVehicle && startKm < (selectedVehicle.lastKnownKm || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedVehicle) {
      setFormError('Selecteer alstublieft een wagen.');
      return;
    }

    if (startKm <= 0 || isNaN(startKm)) {
      setFormError('Vul een geldige, positieve startkilometerstand in.');
      return;
    }

    if (!purpose.trim()) {
      setFormError('Doel van de rit is verplicht.');
      return;
    }

    // Time validation: never later than current moment of registration
    const now = new Date();
    const parsedStartTime = new Date(startTimeLocal);
    if (isNaN(parsedStartTime.getTime())) {
      setFormError('Ongeldige starttijd ingevuld.');
      return;
    }

    // Allow at most 1 minute tolerance for clock skew
    if (parsedStartTime.getTime() > now.getTime() + 60000) {
      setFormError('Starttijd kan nooit later zijn dan het huidige moment van registratie.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await startNewTrip({
        vehicle: selectedVehicle,
        user: currentUser,
        startKm: Number(startKm),
        startTime: parsedStartTime.toISOString(),
        purpose: purpose.trim(),
        notes: notes.trim(),
      });

      if (res.autoClosedTrip) {
        onSuccess(
          `Rit gestart voor ${selectedVehicle.licensePlate}. De openstaande rit van ${res.autoClosedTrip.userName} is automatisch afgesloten.`
        );
      } else {
        onSuccess(`Rit succesvol gestart voor ${selectedVehicle.licensePlate}!`);
      }
      onCancel();
    } catch (err: any) {
      console.error('Error starting trip:', err);
      setFormError(err.message || 'Kon rit niet starten. Probeer opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20 md:pb-8 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition py-1 px-2 -ml-2 rounded-lg hover:bg-stone-200/60"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar Dashboard
        </button>

        <span className="text-xs text-stone-500">
          Bestuurder:{' '}
          <strong className="text-stone-800 font-semibold">{currentUser.fullName}</strong>
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Page Banner */}
        <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/70 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-xs">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
              Nieuwe rit registreren
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Kies een wagen van jouw team, controleer de starttijd en voer de startstand in.
            </p>
          </div>
        </div>

        {/* No vehicles assigned to user's teams */}
        {userVisibleVehicles.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Building className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Geen wagens beschikbaar</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Je bent momenteel niet gekoppeld aan een team met actieve wagens, of er zijn nog
              geen wagens toegewezen aan jouw teams (
              {userVisibleTeams.map((t) => t.name).join(', ') || 'geen teams'}).
            </p>
            <p className="text-xs text-stone-600 font-medium">
              Vraag een wagenbeheerder of systeembeheerder om je aan het juiste wagenpark te koppelen.
            </p>
            <button
              onClick={onCancel}
              className="mt-3 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
            >
              Terug naar overzicht
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Team filter if user is assigned to multiple teams */}
            {userVisibleTeams.length > 1 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
                  Jouw Teams / Wagenparken
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTeamFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedTeamFilter === 'all'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Alle wagens ({userVisibleVehicles.length})
                  </button>
                  {userVisibleTeams.map((team) => {
                    const count = userVisibleVehicles.filter((v) => v.teamId === team.id).length;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedTeamFilter(team.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          selectedTeamFilter === team.id
                            ? 'bg-stone-900 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {team.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vehicle Selection Cards */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
                Kies een wagen <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                {filteredVehicles.map((veh) => {
                  const isSelected = veh.id === selectedVehicleId;
                  const openTripForVeh = openTrips.find(
                    (t) => t.vehicleId === veh.id && t.status === 'open'
                  );
                  const hasOpen = !!openTripForVeh;
                  const isOtherOpen = hasOpen && openTripForVeh.userId !== currentUser.id;
                  const vehTeam = teams.find((t) => t.id === veh.teamId);

                  return (
                    <div
                      key={veh.id}
                      onClick={() => setSelectedVehicleId(veh.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50 ring-2 ring-stone-900/10 shadow-xs'
                          : 'border-stone-200 hover:border-stone-400 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900 inline-block mb-1">
                            {veh.licensePlate}
                          </div>
                          <h4 className="text-sm font-semibold text-stone-900">
                            {veh.brand} {veh.model}
                          </h4>
                          {veh.nickname && (
                            <p className="text-xs text-stone-500 italic">“{veh.nickname}”</p>
                          )}
                          {vehTeam && (
                            <span className="text-[11px] text-stone-400 block mt-0.5">
                              {vehTeam.name}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-stone-500 flex items-center gap-1 font-mono font-medium">
                          <Gauge className="w-3.5 h-3.5 text-stone-400" />
                          {veh.lastKnownKm.toLocaleString('nl-BE')} km
                        </span>
                        {hasOpen && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isOtherOpen
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}
                          >
                            {isOtherOpen ? 'In gebruik' : 'Jouw open rit'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CRITICAL WARNING: Handover alert if open by another user */}
            {isOpenByOther && existingOpenTrip && (
              <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-amber-900">
                    ⚠️ Automatische ritoverdracht van toepassing
                  </p>
                  <p className="mt-1 leading-relaxed">
                    Deze wagen heeft momenteel een openstaande rit van{' '}
                    <span className="font-semibold underline">{existingOpenTrip.userName}</span>{' '}
                    (gestart om{' '}
                    {new Date(existingOpenTrip.startTime).toLocaleTimeString('nl-BE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    ).
                  </p>
                  <p className="mt-1.5 font-medium text-amber-800">
                    Bij het starten sluit het systeem de rit van {existingOpenTrip.userName}{' '}
                    <strong>automatisch af</strong> met jouw opgegeven startkilometerstand.
                  </p>
                </div>
              </div>
            )}

            {isOpenBySelf && (
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs sm:text-sm flex items-start gap-2.5">
                <Info className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  Je hebt momenteel al een openstaande rit voor deze wagen. Als je opnieuw start,
                  wordt je eerdere rit automatisch overschreven/afgesloten.
                </div>
              </div>
            )}

            {/* EDITABLE START TIME (Default: Now, never in the future) */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="startTimeInput"
                  className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5"
                >
                  <Clock className="w-4 h-4 text-stone-600" />
                  Starttijdstip van de rit <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-stone-400">
                  Nooit later dan huidig tijdstip
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  id="startTimeInput"
                  type="datetime-local"
                  max={maxDateTimeLocal}
                  value={startTimeLocal}
                  onChange={(e) => setStartTimeLocal(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 flex-1"
                  required
                />

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStartTimeLocal(getNowLocalString())}
                    className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 transition"
                  >
                    Nu
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTimeMinutesAgo(15)}
                    className="px-2.5 py-2 rounded-lg text-xs font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                  >
                    -15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTimeMinutesAgo(30)}
                    className="px-2.5 py-2 rounded-lg text-xs font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                  >
                    -30 min
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-stone-500">
                Standaard staat het huidige tijdstip ingevuld. Ben je al vertrokken? Pas de tijd hierboven aan.
              </p>
            </div>

            {/* Start KM Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="startKmInput"
                  className="text-xs font-semibold uppercase tracking-wider text-stone-700"
                >
                  Startkilometerstand <span className="text-rose-500">*</span>
                </label>
                {selectedVehicle && (
                  <span className="text-xs text-stone-500">
                    Laatst geregistreerd:{' '}
                    <strong className="text-stone-800">
                      {selectedVehicle.lastKnownKm.toLocaleString('nl-BE')} km
                    </strong>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="startKmInput"
                  type="number"
                  min="1"
                  step="1"
                  value={startKm || ''}
                  onChange={(e) => setStartKm(Number(e.target.value))}
                  placeholder="bv. 142500"
                  className="w-full text-xl font-mono font-bold px-4 py-3.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition"
                  required
                />
                <span className="absolute right-4 top-4 text-stone-400 font-bold text-sm">
                  KM
                </span>
              </div>

              {isKmLessThanRecorded && (
                <div className="mt-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Opgelet: de ingevulde startkm ({startKm} km) is lager dan de laatst bekende stand
                    ({selectedVehicle?.lastKnownKm} km). Controleer het dashboard van de wagen.
                  </span>
                </div>
              )}
            </div>

            {/* Purpose */}
            <div>
              <label
                htmlFor="purposeInput"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
              >
                Doel van de rit <span className="text-rose-500">*</span>
              </label>
              <input
                id="purposeInput"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="bv. Klantbezoek werf Gent, Levering materialen..."
                className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 text-sm transition"
                required
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COMMON_PURPOSES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setPurpose(chip)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                      purpose === chip
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notesInput"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
              >
                Opmerkingen <span className="text-stone-400 font-normal">(optioneel)</span>
              </label>
              <textarea
                id="notesInput"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Eventuele bijzonderheden, route, passagiers..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-stone-900 text-sm transition"
              />
            </div>

            {/* Action Buttons (Inline, no popup) */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-sm transition"
              >
                Annuleren
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white font-bold text-base shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rit wordt gestart...
                  </>
                ) : (
                  <>
                    <Car className="w-5 h-5" />
                    Rit starten
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
