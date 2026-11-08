import React, { useState, useEffect } from 'react';
import { UserProfile, RideRequest, AppSettings, Trip, Vehicle } from '../types';
import {
  Car,
  MapPin,
  Package,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Phone,
  ArrowRight,
  Compass,
  Radio,
  RefreshCw,
  BellRing,
} from 'lucide-react';
import {
  createRideRequest,
  cancelRideRequest,
  completeRideRequest,
  formatExpectedArrivalTime,
} from '../services/tripService';

interface RideRequestViewProps {
  currentUser: UserProfile;
  appSettings: AppSettings;
  rideRequests: RideRequest[];
  openTrips: Trip[];
  vehicles: Vehicle[];
  onSuccess: (msg: string) => void;
  onOpenDriverModal?: (req: RideRequest) => void;
}

export const RideRequestView: React.FC<RideRequestViewProps> = ({
  currentUser,
  appSettings,
  rideRequests,
  openTrips,
  vehicles,
  onSuccess,
  onOpenDriverModal,
}) => {
  const purposes = appSettings?.purposes || [
    'Klantbezoek',
    'Werf / Installatie',
    'Materiaal ophalen / Leverancier',
    'Interventie / Storing',
    'Onderhoud / Keuring',
    'Hoofdzetel / Magazijn',
    'Woon-werk / Verplaatsing',
  ];

  // Locations / Dropdown choices (purposes can serve as locations, plus common stops)
  const defaultLocations = Array.from(
    new Set([...purposes, 'Magazijn / Werkplaats', 'Hoofdzetel', 'Werf'])
  );

  // Form states
  const [fromSelect, setFromSelect] = useState<string>(defaultLocations[0] || 'Magazijn / Werkplaats');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [toSelect, setToSelect] = useState<string>(defaultLocations[1] || 'Klantbezoek');
  const [customTo, setCustomTo] = useState<string>('');
  const [hasMaterials, setHasMaterials] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current user already has an active (pending or accepted) ride request
  const myActiveRequest = rideRequests.find(
    (r) =>
      r.requesterId === currentUser.id &&
      (r.status === 'pending' || r.status === 'accepted')
  );

  // Count active drivers who currently have a vehicle in their possession
  const activeDriverTrips = openTrips.filter((t) => t.status === 'open');
  const activeDriverCount = activeDriverTrips.length;

  // Resolved from & to
  const actualFrom = fromSelect === '__custom__' ? customFrom.trim() : fromSelect;
  const actualTo = toSelect === '__custom__' ? customTo.trim() : toSelect;

  // Request submission
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!actualFrom) {
      setError('Geef aan waar je nu bent (vertreklocatie).');
      return;
    }
    if (!actualTo) {
      setError('Geef aan naar waar je moet (bestemming).');
      return;
    }
    if (actualFrom.toLowerCase() === actualTo.toLowerCase()) {
      setError('Vertreklocatie en bestemming mogen niet hetzelfde zijn.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: Parameters<typeof createRideRequest>[0] = {
        requesterId: currentUser.id,
        requesterName: currentUser.fullName,
        fromLocation: actualFrom,
        toLocation: actualTo,
        hasMaterials,
      };
      if (phone.trim()) {
        payload.requesterPhone = phone.trim();
      }
      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      await createRideRequest(payload);

      onSuccess(
        `Vervoersaanvraag verzonden! Alle ${activeDriverCount} chauffeurs die nu onderweg zijn hebben een melding ontvangen.`
      );
    } catch (err: any) {
      console.error('Error submitting ride request:', err);
      setError(err?.message || 'Kon vervoersaanvraag niet indienen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Weet je zeker dat je deze vervoersaanvraag wilt annuleren?')) return;
    try {
      await cancelRideRequest(requestId);
      onSuccess('Aanvraag geannuleerd.');
    } catch (err: any) {
      alert(err.message || 'Kon aanvraag niet annuleren.');
    }
  };

  const handleComplete = async (requestId: string) => {
    try {
      await completeRideRequest(requestId);
      onSuccess('Rit gemarkeerd als voltooid. Goede reis!');
    } catch (err: any) {
      alert(err.message || 'Kon rit niet voltooien.');
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-xs">
            <Compass className="w-4 h-4" />
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Vervoer Zoeken & Collega Oppikken
          </h1>
        </div>
        <p className="text-xs text-stone-500 mt-1">
          Heb je vervoer nodig naar een werf, magazijn of klant? Vraag direct een rit aan bij collega&apos;s die momenteel met een bedrijfswagen rijden.
        </p>
      </div>

      {/* Driver availability badge */}
      <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              activeDriverCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
            }`}
          />
          <span className="font-semibold text-stone-800">
            {activeDriverCount === 1
              ? '1 wagen momenteel onderweg'
              : `${activeDriverCount} wagens momenteel onderweg`}
          </span>
        </div>
        <span className="text-stone-500">
          {activeDriverCount > 0
            ? 'Ontvangen direct een pushbericht'
            : 'Geen actieve wagens geregistreerd'}
        </span>
      </div>

      {/* SCENARIO 1: CURRENT USER HAS AN ACTIVE REQUEST */}
      {myActiveRequest ? (
        <div className="space-y-4">
          {myActiveRequest.status === 'pending' ? (
            /* Pending state */
            <div className="bg-white rounded-3xl border-2 border-amber-300 p-6 sm:p-8 shadow-sm space-y-6 text-center animate-in fade-in">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                <div className="relative w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                  <Radio className="w-7 h-7 animate-pulse text-amber-700" />
                </div>
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 mb-2">
                  Zoeken naar vervoer...
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  Aanvraag is verzonden naar alle actieve chauffeurs
                </h2>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 leading-relaxed">
                  Zodra een collega jouw aanvraag accepteert en aangeeft over hoeveel minuten hij/zij er is, ontvang je direct een bevestigingsmelding.
                </p>
              </div>

              {/* Request summary box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block font-medium">Van (jouw locatie):</span>
                    <span className="font-bold text-stone-900 text-sm">{myActiveRequest.fromLocation}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-stone-200/80">
                  <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-400 block font-medium">Naar (bestemming):</span>
                    <span className="font-bold text-stone-900 text-sm">{myActiveRequest.toLocation}</span>
                  </div>
                </div>

                {myActiveRequest.hasMaterials && (
                  <div className="pt-2 border-t border-stone-200/80 flex items-center gap-2 text-amber-800 font-semibold bg-amber-50 p-2 rounded-xl">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>Inclusief materiaal dat mee vervoerd moet worden</span>
                  </div>
                )}

                {myActiveRequest.notes && (
                  <div className="text-stone-600 italic pt-1">
                    &ldquo;{myActiveRequest.notes}&rdquo;
                  </div>
                )}
              </div>

              {/* 5-minute recurrence note */}
              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-stone-600 text-[11px] flex items-center justify-center gap-2">
                <BellRing className="w-3.5 h-3.5 text-stone-500" />
                <span>
                  Indien niemand reageert wordt de oproep na 5 minuten automatisch herhaald.
                  {myActiveRequest.retryCount > 0 && ` (Reeds ${myActiveRequest.retryCount}x herhaald)`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCancel(myActiveRequest.id)}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Aanvraag annuleren
              </button>
            </div>
          ) : (
            /* Accepted state: Driver is coming! */
            <div className="bg-white rounded-3xl border-2 border-emerald-400 p-6 sm:p-8 shadow-sm space-y-6 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 mb-2">
                  Vervoer gevonden!
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                  {myActiveRequest.driverName} komt je oppikken!
                </h2>
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-mono text-base font-bold">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  Verwachte aankomsttijd: {formatExpectedArrivalTime(myActiveRequest.acceptedAt, myActiveRequest.etaMinutes || 10)}
                </div>
              </div>

              {/* Driver & vehicle card */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-left text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-stone-400 block font-medium">Bestuurder</span>
                    <span className="font-bold text-stone-900 text-sm">
                      {myActiveRequest.driverName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-400 block font-medium">Wagen</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                      {myActiveRequest.driverLicensePlate}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-stone-600">
                  <span>Traject:</span>
                  <span className="font-medium text-stone-900">
                    {myActiveRequest.fromLocation} ➔ {myActiveRequest.toLocation}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleComplete(myActiveRequest.id)}
                  className="py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Opgepikt & Klaar
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(myActiveRequest.id)}
                  className="py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 font-semibold text-stone-700 text-xs transition"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SCENARIO 2: FORM TO CREATE A NEW RIDE REQUEST */
        <form
          onSubmit={handleCreateRequest}
          className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-7 shadow-xs space-y-5"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Waar je nu bent */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              Waar ben je nu? (Vertreklocatie) <span className="text-rose-500">*</span>
            </label>
            <select
              value={fromSelect}
              onChange={(e) => setFromSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium bg-white"
            >
              {defaultLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
              <option value="__custom__">✏️ Andere locatie typen...</option>
            </select>

            {fromSelect === '__custom__' && (
              <input
                type="text"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                placeholder="Typ hier je vertreklocatie of adres..."
                className="w-full mt-2 px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
                required
              />
            )}
          </div>

          {/* 2. Naar waar je moet */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
              Naar waar moet je? (Bestemming) <span className="text-rose-500">*</span>
            </label>
            <select
              value={toSelect}
              onChange={(e) => setToSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium bg-white"
            >
              {defaultLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
              <option value="__custom__">✏️ Andere locatie typen...</option>
            </select>

            {toSelect === '__custom__' && (
              <input
                type="text"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                placeholder="Typ hier de bestemming of werf..."
                className="w-full mt-2 px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
                required
              />
            )}
          </div>

          {/* 3. Materiaal vinkje */}
          <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 transition hover:bg-amber-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMaterials}
                onChange={(e) => setHasMaterials(e.target.checked)}
                className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-700" />
                  Ik heb materiaal bij dat mee vervoerd moet worden
                </span>
                <span className="text-[11px] text-amber-800/80 block mt-0.5">
                  Vink dit aan als je koffers, gereedschap of onderdelen meehebt, zodat chauffeurs weten dat er laadruimte nodig is.
                </span>
              </div>
            </label>
          </div>

          {/* 4. Optionele toelichting of telefoonnummer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Telefoonnummer <span className="text-stone-400 font-normal">(optioneel)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="bv. 0470 12 34 56"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Extra info / afspreekplek <span className="text-stone-400 font-normal">(optioneel)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="bv. Achterkant parking"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Aanvraag versturen...' : 'Vervoer aanvragen & Chauffeurs waarschuwen'}
          </button>
        </form>
      )}

      {/* ALL ACTIVE REQUESTS FOR DRIVERS TO PICK UP (If logged in driver possesses a car) */}
      <div className="space-y-3 pt-4 border-t border-stone-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Openstaande Vervoersaanvragen ({rideRequests.filter((r) => r.status === 'pending').length})
          </h2>
          <span className="text-[11px] text-stone-400">Chauffeurs kunnen hier direct reageren</span>
        </div>

        {rideRequests.filter((r) => r.status === 'pending').length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 text-center text-xs text-stone-400">
            Er zijn momenteel geen openstaande aanvragen van collega&apos;s.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rideRequests
              .filter((r) => r.status === 'pending')
              .map((req) => (
                <div
                  key={req.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-stone-900 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">
                        {req.requesterName}
                      </span>
                      {req.hasMaterials && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Heeft materiaal
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-600">
                      <strong>Van:</strong> {req.fromLocation} ➔ <strong>Naar:</strong> {req.toLocation}
                    </div>
                    {req.notes && (
                      <div className="text-[11px] text-stone-400 italic">
                        &ldquo;{req.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenDriverModal && onOpenDriverModal(req)}
                    className="py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs transition active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Car className="w-3.5 h-3.5" />
                    Ik pik {req.requesterName.split(' ')[0]} op
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
