import React, { useState } from 'react';
import { Trip } from '../types';
import {
  Car,
  Clock,
  Gauge,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { closeTrip } from '../services/tripService';

interface CloseTripViewProps {
  trip: Trip;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

// Helper to format date to local datetime-local format: YYYY-MM-DDTHH:mm
function getNowLocalString(date: Date = new Date()): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export const CloseTripView: React.FC<CloseTripViewProps> = ({
  trip,
  onSuccess,
  onCancel,
}) => {
  const [endKm, setEndKm] = useState<number>(trip.startKm);
  const [endTimeLocal, setEndTimeLocal] = useState<string>(getNowLocalString());
  const [notes, setNotes] = useState<string>(trip.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maximum allowed end time is the current moment of registration
  const maxDateTimeLocal = getNowLocalString();

  const drivenDistance = endKm - trip.startKm;
  const isDistanceValid = drivenDistance >= 0 && !isNaN(drivenDistance);

  // Quick preset helper for end time
  const setEndTimeMinutesAgo = (minutesAgo: number) => {
    const d = new Date(Date.now() - minutesAgo * 60 * 1000);
    setEndTimeLocal(getNowLocalString(d));
  };

  const handleImmediateCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(endKm) || endKm <= 0) {
      setError('Vul een geldige stopkilometerstand in.');
      return;
    }

    if (endKm < trip.startKm) {
      setError(
        `Stopkilometerstand (${endKm.toLocaleString('nl-BE')} km) kan niet lager zijn dan de startkilometerstand (${trip.startKm.toLocaleString('nl-BE')} km).`
      );
      return;
    }

    const now = new Date();
    const parsedEndTime = new Date(endTimeLocal);
    if (isNaN(parsedEndTime.getTime())) {
      setError('Ongeldige eindtijd ingevuld.');
      return;
    }

    // Validation: End time cannot be in the future (later than registration moment)
    if (parsedEndTime.getTime() > now.getTime() + 60000) {
      setError('Eindtijd kan nooit later zijn dan het huidige moment van registratie.');
      return;
    }

    // Validation: End time cannot be before trip start time
    const tripStartTime = new Date(trip.startTime);
    if (parsedEndTime.getTime() < tripStartTime.getTime()) {
      setError(
        `Eindtijd (${parsedEndTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}) kan niet eerder zijn dan de starttijd van de rit (${tripStartTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}).`
      );
      return;
    }

    try {
      setSubmitting(true);
      await closeTrip({
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        startKm: trip.startKm,
        endKm: Number(endKm),
        endTime: parsedEndTime.toISOString(),
        notes: notes.trim(),
      });
      onSuccess(`Rit succesvol afgesloten! Totaal gereden: ${drivenDistance.toLocaleString('nl-BE')} km.`);
    } catch (err: any) {
      console.error('Error closing trip:', err);
      setError(err.message || 'Kon rit niet afsluiten. Probeer opnieuw.');
      setSubmitting(false);
    }
  };

  const startDateFormatted = new Date(trip.startTime).toLocaleDateString('nl-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startTimeFormatted = new Date(trip.startTime).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20 md:pb-8 animate-in fade-in duration-200">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition py-1 px-2 -ml-2 rounded-lg hover:bg-stone-200/60"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar Dashboard
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Banner */}
        <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-stone-900 leading-tight">
                Rit afsluiten
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Wagen: <strong className="text-stone-800">{trip.licensePlate}</strong> • {trip.vehicleName}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleImmediateCloseSubmit} className="p-6 sm:p-7 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Trip Details Summary Card */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-stone-300 text-stone-900">
                {trip.licensePlate}
              </span>
              <span className="text-xs text-stone-500 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                Gestart: {startDateFormatted} om {startTimeFormatted}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-stone-900">{trip.vehicleName}</h3>
              <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                Doel: <strong className="text-stone-800">{trip.purpose}</strong>
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Startkilometerstand:</span>
              <span className="font-mono font-bold text-stone-900 text-sm">
                {trip.startKm.toLocaleString('nl-BE')} km
              </span>
            </div>
          </div>

          {/* EDITABLE END TIME (Default: Now, never in the future) */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="endTimeInput"
                className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4 text-stone-600" />
                Eindtijdstip van de rit <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-stone-400">
                Nooit later dan huidig tijdstip
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="endTimeInput"
                type="datetime-local"
                max={maxDateTimeLocal}
                value={endTimeLocal}
                onChange={(e) => setEndTimeLocal(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 flex-1"
                required
              />

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEndTimeLocal(getNowLocalString())}
                  className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 transition"
                >
                  Nu
                </button>
                <button
                  type="button"
                  onClick={() => setEndTimeMinutesAgo(5)}
                  className="px-2.5 py-2 rounded-lg text-xs font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                >
                  -5 min
                </button>
                <button
                  type="button"
                  onClick={() => setEndTimeMinutesAgo(15)}
                  className="px-2.5 py-2 rounded-lg text-xs font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                >
                  -15 min
                </button>
              </div>
            </div>
            <p className="text-[11px] text-stone-500">
              Standaard staat het huidige tijdstip ingevuld. Ben je al eerder gestopt? Pas het tijdstip hierboven aan.
            </p>
          </div>

          {/* Stop KM Input */}
          <div>
            <label
              htmlFor="stopKmInput"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
            >
              Stopkilometerstand <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="stopKmInput"
                type="number"
                min={trip.startKm}
                step="1"
                value={endKm || ''}
                onChange={(e) => setEndKm(Number(e.target.value))}
                placeholder={`bv. ${trip.startKm + 25}`}
                className="w-full text-2xl font-mono font-bold px-4 py-3.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                required
                autoFocus
              />
              <span className="absolute right-4 top-4 text-stone-400 font-bold text-sm">
                KM
              </span>
            </div>
          </div>

          {/* Live Distance Calculation Banner */}
          <div
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              isDistanceValid
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800/80 block">
                Berekende ritafstand
              </span>
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-900">
                {isDistanceValid ? `${drivenDistance.toLocaleString('nl-BE')} km` : 'Ongeldige kilometerstand'}
              </span>
            </div>
            <Gauge className="w-8 h-8 text-emerald-600 opacity-80" />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="closeNotesInput"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
            >
              Opmerkingen bij afsluiten <span className="text-stone-400 font-normal">(optioneel)</span>
            </label>
            <input
              id="closeNotesInput"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="bv. Wagen getankt, werfmateriaal uitgeladen..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm"
            />
          </div>

          {/* IMMEDIATE ACTION BUTTONS (No extra confirmation step) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-sm transition"
            >
              Annuleren
            </button>

            <button
              type="submit"
              disabled={!isDistanceValid || submitting}
              className="w-full sm:flex-1 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base shadow-md transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Rit wordt direct afgesloten...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Rit direct afsluiten ({drivenDistance >= 0 ? `${drivenDistance.toLocaleString('nl-BE')} km` : ''})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
