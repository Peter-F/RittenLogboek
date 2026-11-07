/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Vehicle, Trip, UserProfile } from '../types';
import {
  Car,
  Gauge,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Tag,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  startNewTrip,
  closeTrip,
  updateAppSettings,
  getLatestVehicleMileage,
} from '../services/tripService';

interface VehicleQuickActionViewProps {
  vehicle: Vehicle;
  currentUser: UserProfile;
  openTrips: Trip[];
  availablePurposes: string[];
  expectedDailyKm?: number;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

// Helper to format date to local datetime-local format: YYYY-MM-DDTHH:mm
function getNowLocalString(date: Date = new Date()): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export const VehicleQuickActionView: React.FC<VehicleQuickActionViewProps> = ({
  vehicle,
  currentUser,
  openTrips,
  availablePurposes,
  expectedDailyKm,
  onSuccess,
  onCancel,
}) => {
  // Check if current user has an open trip for this vehicle
  const myOpenTrip = openTrips.find(
    (t) => t.vehicleId === vehicle.id && t.userId === currentUser.id && t.status === 'open'
  );

  // Check if another user has an open trip for this vehicle (auto-handover case)
  const otherOpenTrip = openTrips.find(
    (t) => t.vehicleId === vehicle.id && t.userId !== currentUser.id && t.status === 'open'
  );

  const isClosing = Boolean(myOpenTrip);

  // Authoritative latest mileage from database (considering latest closed trip endKm and vehicle document)
  const latestDbMileage = getLatestVehicleMileage(vehicle, openTrips);

  // KM input state: if starting, initialize with latest confirmed mileage from the previous trip
  const initialKm = isClosing
    ? myOpenTrip?.startKm || latestDbMileage
    : latestDbMileage;

  const [kmValue, setKmValue] = useState<number>(initialKm);
  const [hasUserEditedKm, setHasUserEditedKm] = useState<boolean>(false);

  // Reset user-edited flag when vehicle ID changes
  useEffect(() => {
    setHasUserEditedKm(false);
  }, [vehicle.id]);

  // Keep kmValue synchronized with live database data if user hasn't typed a custom value
  useEffect(() => {
    if (!hasUserEditedKm) {
      if (isClosing && myOpenTrip) {
        setKmValue(myOpenTrip.startKm);
      } else {
        setKmValue(latestDbMileage);
      }
    }
  }, [vehicle.id, latestDbMileage, isClosing, myOpenTrip?.id, myOpenTrip?.startKm, hasUserEditedKm]);

  // Time state (default: Now)
  const [dateTimeLocal, setDateTimeLocal] = useState<string>(getNowLocalString());
  const maxDateTimeLocal = getNowLocalString();

  // Purpose state
  const defaultPurpose =
    isClosing && myOpenTrip?.purpose
      ? myOpenTrip.purpose
      : availablePurposes[0] || 'Klantbezoek';
  const [purpose, setPurpose] = useState<string>(defaultPurpose);
  const [isCustomPurpose, setIsCustomPurpose] = useState<boolean>(false);
  const [saveCustomPurposeToList, setSaveCustomPurposeToList] = useState<boolean>(true);

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Distance calculation when closing
  const startKmOfTrip = myOpenTrip ? myOpenTrip.startKm : 0;
  const drivenDistance = isClosing ? kmValue - startKmOfTrip : 0;
  const isDistanceValid = !isClosing || (drivenDistance >= 0 && !isNaN(drivenDistance));

  // Guideline threshold
  const guidelineThreshold = vehicle.expectedDailyKm || expectedDailyKm || 50;
  const isExceedingGuideline = isClosing && isDistanceValid && drivenDistance > guidelineThreshold;

  // Discrepancy calculation when starting: compare against the true latest recorded mileage
  const prevMileage = latestDbMileage;
  const startKmDiscrepancy = !isClosing && prevMileage > 0 ? kmValue - prevMileage : 0;
  const hasDiscrepancy = !isClosing && Math.abs(startKmDiscrepancy) > 0;

  // Quick preset helper for time
  const setTimeMinutesAgo = (minutesAgo: number) => {
    const d = new Date(Date.now() - minutesAgo * 60 * 1000);
    setDateTimeLocal(getNowLocalString(d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(kmValue) || kmValue <= 0) {
      setError('Vul een geldige kilometerstand in.');
      return;
    }

    const now = new Date();
    const parsedTime = new Date(dateTimeLocal);
    if (isNaN(parsedTime.getTime())) {
      setError('Ongeldig tijdstip ingevuld.');
      return;
    }

    // Validation: cannot be in future
    if (parsedTime.getTime() > now.getTime() + 60000) {
      setError('Het tijdstip kan nooit later zijn dan het huidige moment van registratie.');
      return;
    }

    const finalPurpose = purpose.trim() || 'Zakelijke rit';

    // If a new custom purpose was typed and option is checked, save it to appSettings
    if (isCustomPurpose && saveCustomPurposeToList && finalPurpose) {
      if (!availablePurposes.includes(finalPurpose)) {
        try {
          await updateAppSettings({
            purposes: [...availablePurposes, finalPurpose],
          });
        } catch (err) {
          console.warn('Could not save purpose to global list:', err);
        }
      }
    }

    try {
      setSubmitting(true);

      if (isClosing && myOpenTrip) {
        // CLOSE TRIP
        if (kmValue < myOpenTrip.startKm) {
          setError(
            `Stopkilometerstand (${kmValue.toLocaleString('nl-BE')} km) kan niet lager zijn dan de startkilometerstand (${myOpenTrip.startKm.toLocaleString('nl-BE')} km).`
          );
          setSubmitting(false);
          return;
        }

        const tripStartTime = new Date(myOpenTrip.startTime);
        if (parsedTime.getTime() < tripStartTime.getTime()) {
          setError('Eindtijd kan niet eerder zijn dan de starttijd van de rit.');
          setSubmitting(false);
          return;
        }

        await closeTrip({
          tripId: myOpenTrip.id,
          vehicleId: vehicle.id,
          startKm: myOpenTrip.startKm,
          endKm: Number(kmValue),
          endTime: parsedTime.toISOString(),
          notes: myOpenTrip.notes || '',
          expectedDailyKm: guidelineThreshold,
        });

        onSuccess(
          `Rit voor wagen ${vehicle.licensePlate} afgesloten! Afstand: ${drivenDistance.toLocaleString('nl-BE')} km.`
        );
      } else {
        // START NEW TRIP (with atomic handover if another user was open)
        const result = await startNewTrip({
          vehicle,
          user: currentUser,
          startKm: Number(kmValue),
          purpose: finalPurpose,
          startTime: parsedTime.toISOString(),
        });

        if (result?.autoClosedTrip) {
          onSuccess(
            `Rit gestart voor ${vehicle.licensePlate}! Rit van ${result.autoClosedTrip.userName} is automatisch overgedragen.`
          );
        } else {
          onSuccess(`Rit succesvol gestart voor wagen ${vehicle.licensePlate}!`);
        }
      }
    } catch (err: any) {
      console.error('Error submitting trip action:', err);
      setError(err.message || 'Er is een fout opgetreden. Probeer opnieuw.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full px-2 py-2 sm:py-4">
      {/* 1 Visible Smartphone Screen Container */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        {/* 1. BOVENAAN DE WAGEN (Compact Header) */}
        <div className="bg-stone-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="px-2.5 py-1 bg-white text-stone-900 rounded-lg font-mono font-black text-base sm:text-lg tracking-wider border border-stone-200 shrink-0 shadow-2xs">
              {vehicle.licensePlate}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate leading-tight">
                {vehicle.brand} {vehicle.model}
              </h1>
              {vehicle.nickname ? (
                <p className="text-[11px] text-stone-300 truncate italic">“{vehicle.nickname}”</p>
              ) : (
                <p className="text-[11px] text-stone-400">Bedrijfswagen</p>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0 text-right">
            {isClosing ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-stone-950">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-900 animate-pulse" />
                Jouw rit actief
              </span>
            ) : otherOpenTrip ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                Overname
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                Vrij
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* If another user has an open trip: show short handover note */}
          {!isClosing && otherOpenTrip && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Collega <strong>{otherOpenTrip.userName}</strong> sloot niet af. Rit wordt automatisch overgenomen.
              </span>
            </div>
          )}

          {/* 2. ER ONDER DE KM STAND (Aanpasbaar) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="kmInput"
                className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1"
              >
                <Gauge className="w-3.5 h-3.5 text-stone-500" />
                {isClosing ? 'Stopkilometerstand' : 'Startkilometerstand'}
              </label>

              {isClosing && myOpenTrip ? (
                <span className="text-xs text-stone-500 font-mono">
                  Start: <strong>{myOpenTrip.startKm.toLocaleString('nl-BE')} km</strong>
                </span>
              ) : (
                <span className="text-xs text-stone-500 font-mono">
                  Vorige stand: <strong>{prevMileage.toLocaleString('nl-BE')} km</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="kmInput"
                type="number"
                min="0"
                step="1"
                value={kmValue || ''}
                onChange={(e) => {
                  setHasUserEditedKm(true);
                  setKmValue(Number(e.target.value));
                }}
                placeholder={`bv. ${isClosing && myOpenTrip ? myOpenTrip.startKm + 25 : prevMileage}`}
                className="w-full text-2xl font-mono font-bold px-3.5 py-2.5 rounded-xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none transition bg-stone-50/50"
                required
                autoFocus
              />
              <span className="absolute right-3.5 top-3 text-stone-400 font-bold text-xs uppercase tracking-wider">
                KM
              </span>
            </div>

            {/* Live Distance calculation if Closing */}
            {isClosing && isDistanceValid && (
              <div
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  isExceedingGuideline
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-emerald-50 text-emerald-900'
                }`}
              >
                <span>Berekende afstand:</span>
                <span className="font-mono font-bold text-sm">
                  +{drivenDistance.toLocaleString('nl-BE')} km
                </span>
              </div>
            )}

            {/* Guideline Warning if applicable */}
            {isExceedingGuideline && (
              <p className="text-[11px] text-amber-800 leading-tight">
                ⚠️ Afstand ({drivenDistance} km) is hoger dan richtgetal ({guidelineThreshold} km). Controleer eventuele typefout.
              </p>
            )}

            {/* Discrepancy hint if starting */}
            {hasDiscrepancy && (
              <p className="text-[11px] text-amber-700 leading-tight flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                Kilometer-afwijking van {startKmDiscrepancy > 0 ? '+' : ''}
                {startKmDiscrepancy} km t.o.v. wagenstand wordt geregistreerd voor beheer.
              </p>
            )}
          </div>

          {/* 3. ER ONDER DE DROPDOWN MET DOEL RIT (Ook editeerbaar voor nieuwe doelen) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="purposeSelect"
                className="text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1"
              >
                <Tag className="w-3.5 h-3.5 text-stone-500" />
                Doel van de rit
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsCustomPurpose(!isCustomPurpose);
                  if (!isCustomPurpose) {
                    setPurpose('');
                  } else {
                    setPurpose(availablePurposes[0] || 'Klantbezoek');
                  }
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                {isCustomPurpose ? 'Kies uit lijst' : '+ Nieuw doel typen'}
              </button>
            </div>

            {!isCustomPurpose ? (
              <select
                id="purposeSelect"
                value={purpose}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCustomPurpose(true);
                    setPurpose('');
                  } else {
                    setPurpose(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-semibold text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
              >
                {availablePurposes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__NEW__">➕ Nieuw doel toevoegen / typen...</option>
              </select>
            ) : (
              <div className="space-y-1">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Typ hier het nieuwe ritdoel..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 font-semibold text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomPurpose(false);
                      setPurpose(availablePurposes[0] || 'Klantbezoek');
                    }}
                    className="px-2.5 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                  >
                    Lijst
                  </button>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-stone-600 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={saveCustomPurposeToList}
                    onChange={(e) => setSaveCustomPurposeToList(e.target.checked)}
                    className="w-3 h-3 rounded text-stone-900"
                  />
                  <span>Dit doel bewaren voor volgende keer</span>
                </label>
              </div>
            )}
          </div>

          {/* 4. TIJDSTIP (Compact: standaard nu, editeerbaar, nooit in de toekomst) */}
          <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-500" />
                {isClosing ? 'Eindtijdstip' : 'Starttijdstip'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDateTimeLocal(getNowLocalString())}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-white border border-stone-200 hover:bg-stone-100 text-stone-800"
                >
                  Nu
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMinutesAgo(15)}
                  className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-600"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMinutesAgo(30)}
                  className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-600"
                >
                  -30m
                </button>
              </div>
            </div>

            <input
              type="datetime-local"
              max={maxDateTimeLocal}
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-800 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              required
            />
          </div>

          {/* 5. START RIT / STOP RIT KNOP OF ANNULEREN */}
          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={submitting || (isClosing && !isDistanceValid)}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base text-white shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 ${
                isClosing
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-stone-900 hover:bg-stone-800'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Bezig...
                </>
              ) : isClosing ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Stop rit {drivenDistance >= 0 ? `(${drivenDistance} km)` : ''}
                </>
              ) : otherOpenTrip ? (
                <>
                  <Car className="w-5 h-5" />
                  Start rit (en neem over van {otherOpenTrip.userName})
                </>
              ) : (
                <>
                  <Car className="w-5 h-5" />
                  Start rit
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="w-full py-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 font-semibold text-xs transition"
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
