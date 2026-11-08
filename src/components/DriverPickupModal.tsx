import React, { useState } from 'react';
import { RideRequest, UserProfile, Vehicle, Trip } from '../types';
import {
  Car,
  Clock,
  MapPin,
  ArrowRight,
  Package,
  X,
  CheckCircle2,
  Phone,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { acceptRideRequest, formatExpectedArrivalTime } from '../services/tripService';

interface DriverPickupModalProps {
  request: RideRequest;
  currentUser: UserProfile;
  openTrips: Trip[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const DriverPickupModal: React.FC<DriverPickupModalProps> = ({
  request,
  currentUser,
  openTrips,
  vehicles,
  onClose,
  onSuccess,
}) => {
  // Find vehicle currently driven by this user
  const userOpenTrip = openTrips.find((t) => t.userId === currentUser.id && t.status === 'open');
  const userOpenVehicle = userOpenTrip
    ? vehicles.find((v) => v.id === userOpenTrip.vehicleId)
    : null;

  // Selected vehicle state (defaults to open trip vehicle or first available vehicle)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    userOpenVehicle?.id || (vehicles[0]?.id ?? '')
  );

  // ETA Preset choices: 5m, 10m, 15m or custom
  const [selectedEtaPreset, setSelectedEtaPreset] = useState<'5' | '10' | '15' | 'custom'>('10');
  const [customEtaInput, setCustomEtaInput] = useState<string>('20');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveEta =
    selectedEtaPreset === 'custom'
      ? Math.max(1, parseInt(customEtaInput, 10) || 10)
      : parseInt(selectedEtaPreset, 10);

  const activeVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ||
    (userOpenTrip
      ? {
          id: userOpenTrip.vehicleId,
          licensePlate: userOpenTrip.licensePlate,
          brand: userOpenTrip.vehicleName,
          model: '',
        }
      : null);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeVehicle) {
      setError('Selecteer met welke wagen je de collega ophaalt.');
      return;
    }

    if (effectiveEta < 1) {
      setError('Geef een geldige aankomsttijd in minuten op.');
      return;
    }

    try {
      setSubmitting(true);
      await acceptRideRequest(
        request.id,
        {
          id: currentUser.id,
          name: currentUser.fullName,
        },
        {
          id: activeVehicle.id,
          licensePlate: activeVehicle.licensePlate,
          name: activeVehicle.model
            ? `${activeVehicle.brand} ${activeVehicle.model}`
            : activeVehicle.brand || activeVehicle.licensePlate,
        },
        effectiveEta
      );

      onSuccess(
        `Bevestigd! ${request.requesterName} ontvangt een pushmelding dat je aankomt ${formatExpectedArrivalTime(undefined, effectiveEta)} met wagen ${activeVehicle.licensePlate}.`
      );
      onClose();
    } catch (err: any) {
      console.error('Error accepting ride request:', err);
      setError(err?.message || 'Kon rit niet accepteren.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Car className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-stone-900">Collega Oppikken</h3>
              <p className="text-xs text-stone-500">Kies je geschatte ophaaltijd</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAccept} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Requester Information */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
                  Aanvrager
                </span>
                <span className="text-sm font-bold text-stone-900">
                  {request.requesterName}
                </span>
              </div>
              {request.requesterPhone && (
                <a
                  href={`tel:${request.requesterPhone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
                >
                  <Phone className="w-3 h-3" />
                  <span>{request.requesterPhone}</span>
                </a>
              )}
            </div>

            {/* Route */}
            <div className="pt-2 border-t border-stone-200/80 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-stone-400 block">Ophaalplek (Waar de collega is):</span>
                  <span className="font-bold text-stone-900">{request.fromLocation}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-stone-400 block">Bestemming (Waar hij/zij heen moet):</span>
                  <span className="font-bold text-stone-900">{request.toLocation}</span>
                </div>
              </div>
            </div>

            {/* Material warning */}
            {request.hasMaterials && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Let op: Deze collega heeft materiaal bij dat mee vervoerd moet worden.</span>
              </div>
            )}

            {request.notes && (
              <div className="text-xs text-stone-600 italic bg-white p-2.5 rounded-xl border border-stone-200">
                &ldquo;{request.notes}&rdquo;
              </div>
            )}
          </div>

          {/* Vehicle selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5 flex items-center justify-between">
              <span>Jouw Wagen</span>
              {userOpenVehicle && (
                <span className="text-[11px] text-emerald-600 font-bold">
                  ✓ Actieve wagen in jouw bezit
                </span>
              )}
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-mono"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} - {v.brand} {v.model} {v.id === userOpenVehicle?.id ? ' (Onderweg met jou)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ETA / Ophaaltijd selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              Over hoeveel tijd kun je oppikken?
            </label>

            {/* Preset buttons: 5 min, 10 min, 15 min, Eigen waarde */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedEtaPreset('5')}
                className={`py-3 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                  selectedEtaPreset === '5'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-sm">5m</span>
                <span className="text-[10px] font-normal opacity-80">Direct</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEtaPreset('10')}
                className={`py-3 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                  selectedEtaPreset === '10'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-sm">10m</span>
                <span className="text-[10px] font-normal opacity-80">Kort</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEtaPreset('15')}
                className={`py-3 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                  selectedEtaPreset === '15'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-sm">15m</span>
                <span className="text-[10px] font-normal opacity-80">Normaal</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEtaPreset('custom')}
                className={`py-3 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center border ${
                  selectedEtaPreset === 'custom'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="text-sm">Eigen</span>
                <span className="text-[10px] font-normal opacity-80">Waarde</span>
              </button>
            </div>

            {/* Custom ETA input */}
            {selectedEtaPreset === 'custom' && (
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Aantal minuten tot aankomst:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customEtaInput}
                    onChange={(e) => setCustomEtaInput(e.target.value)}
                    placeholder="bv. 25"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 font-mono font-bold text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-xs font-bold text-stone-500">minuten</span>
                </div>
              </div>
            )}

            {/* Live arrival preview */}
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Clock className="w-3.5 h-3.5" />
                Verwachte aankomsttijd:
              </span>
              <span className="font-bold text-sm text-emerald-900 font-mono">
                {formatExpectedArrivalTime(undefined, effectiveEta)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={submitting || !activeVehicle}
              className="flex-2 py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {submitting
                ? 'Bezig met bevestigen...'
                : `Ik pik ${request.requesterName.split(' ')[0]} op (${formatExpectedArrivalTime(undefined, effectiveEta)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
