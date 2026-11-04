import React from 'react';
import { Trip, Vehicle, UserProfile, Team } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  Car,
  Clock,
  Gauge,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileText,
  CalendarDays,
  Building,
} from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
  trips: Trip[];
  vehicles: Vehicle[];
  teams: Team[];
  onOpenNewTrip: () => void;
  onOpenCloseTrip: (trip: Trip) => void;
  onViewAllTrips: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  trips,
  vehicles,
  teams,
  onOpenNewTrip,
  onOpenCloseTrip,
  onViewAllTrips,
}) => {
  const isSuperAdmin = user.role === 'admin';
  const isFleetAdmin = user.role === 'fleet_admin' || isSuperAdmin;
  const userTeamIds = user.teamIds || [];

  // Filter vehicles belonging to the user's teams
  const userVehicles = isSuperAdmin
    ? vehicles.filter((v) => v.isActive)
    : vehicles.filter((v) => v.isActive && userTeamIds.includes(v.teamId));

  // Current user's open trip (if any)
  const myOpenTrip = trips.find(
    (t) => t.userId === user.id && t.status === 'open'
  );

  // User's recent trips (max 10), sorted by start_time descending
  const myRecentTrips = trips
    .filter((t) => t.userId === user.id)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 10);

  // Quick statistics
  const totalKmDriven = trips
    .filter((t) => t.userId === user.id && t.endKm && t.endKm >= t.startKm)
    .reduce((acc, t) => acc + ((t.endKm || 0) - t.startKm), 0);

  // Active trips in user's fleet
  const userVehicleIds = new Set(userVehicles.map((v) => v.id));
  const activeInUserFleetCount = trips.filter(
    (t) => t.status === 'open' && userVehicleIds.has(t.vehicleId)
  ).length;

  const userTeamsList = teams.filter((t) => userTeamIds.includes(t.id));

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Welkom, {user.fullName}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                user.role === 'admin'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : user.role === 'fleet_admin'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              {user.role === 'admin'
                ? 'Systeembeheer'
                : user.role === 'fleet_admin'
                ? 'Wagenbeheer'
                : 'Bestuurder'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
            <Building className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Wagenpark:{' '}
              <strong className="text-stone-700 font-semibold">
                {isSuperAdmin
                  ? 'Alle wagenparken (Systeem)'
                  : userTeamsList.length > 0
                  ? userTeamsList.map((t) => t.name).join(', ')
                  : 'Geen team toegewezen'}
              </strong>
            </span>
          </div>
        </div>

        {isFleetAdmin && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={onViewAllTrips}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-semibold text-xs shadow-xs transition"
            >
              <CalendarDays className="w-4 h-4 text-stone-600" />
              Daglogboek raadplegen
            </button>
          </div>
        )}
      </div>

      {/* PROMINENT CARD: "Mijn openstaande rit" */}
      {myOpenTrip ? (
        <section aria-labelledby="open-trip-heading" className="animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-5 sm:p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
                <h2 id="open-trip-heading" className="text-base font-bold text-stone-900 tracking-tight">
                  Mijn openstaande rit
                </h2>
              </div>
              <StatusBadge status="open" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Vehicle info */}
              <div className="bg-white/90 p-4 rounded-xl border border-amber-200/60 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block mb-1">
                  Voertuig
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                    {myOpenTrip.licensePlate}
                  </span>
                </div>
                <div className="text-sm font-semibold text-stone-800 mt-1 truncate">
                  {myOpenTrip.vehicleName}
                </div>
              </div>

              {/* Start time & KM */}
              <div className="bg-white/90 p-4 rounded-xl border border-amber-200/60 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block mb-1">
                  Startgegevens
                </span>
                <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  {new Date(myOpenTrip.startTime).toLocaleTimeString('nl-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  <span className="text-xs font-normal text-stone-500">
                    ({new Date(myOpenTrip.startTime).toLocaleDateString('nl-BE')})
                  </span>
                </div>
                <div className="text-xs text-stone-600 mt-1 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-stone-400" />
                  Startstand: <strong>{myOpenTrip.startKm.toLocaleString('nl-BE')} km</strong>
                </div>
              </div>

              {/* Purpose */}
              <div className="bg-white/90 p-4 rounded-xl border border-amber-200/60 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block mb-1">
                  Doel van de rit
                </span>
                <div className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate">{myOpenTrip.purpose}</span>
                </div>
                {myOpenTrip.notes && (
                  <p className="text-xs text-stone-500 mt-1 truncate italic">
                    “{myOpenTrip.notes}”
                  </p>
                )}
              </div>
            </div>

            {/* Direct CTA to close the trip (Navigates to inline close view, no popup) */}
            <button
              onClick={() => onOpenCloseTrip(myOpenTrip)}
              className="w-full py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base shadow-md transition flex items-center justify-center gap-2 group"
            >
              <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Rit afsluiten (Stopkilometerstand invoeren)
            </button>
          </div>
        </section>
      ) : (
        /* Empty state: No open trip */
        <section aria-labelledby="no-open-trip-heading">
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto mb-3">
              <Car className="w-7 h-7" />
            </div>
            <h2 id="no-open-trip-heading" className="text-base font-bold text-stone-900">
              Geen openstaande rit
            </h2>
            <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
              Je bent momenteel niet onderweg met een wagen. Vertrek je zometeen?
            </p>
            <div className="mt-4">
              <button
                onClick={onOpenNewTrip}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm shadow-sm transition active:scale-[0.99]"
              >
                <PlusCircle className="w-4 h-4" />
                Nieuwe rit starten
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Mini Overview Cards (Filtered to user's assigned teams) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
            Jouw Totaal Afstand
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 mt-1 block">
            {totalKmDriven.toLocaleString('nl-BE')} <span className="text-xs font-normal text-stone-500">km</span>
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
            Wagens in jouw team(s)
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 mt-1 block">
            {userVehicles.length} <span className="text-xs font-normal text-stone-500">actief</span>
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
            Wagens nu onderweg
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-1 block">
            {activeInUserFleetCount} <span className="text-xs font-normal text-stone-500">rit(ten)</span>
          </span>
        </div>
      </div>

      {/* Recent Trips List (My Trips) */}
      <section aria-labelledby="recent-trips-heading" className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 id="recent-trips-heading" className="text-base font-bold text-stone-900">
              Mijn recente ritten
            </h2>
            <p className="text-xs text-stone-500">De laatste 10 ritten geregistreerd op jouw account.</p>
          </div>
          <button
            onClick={onViewAllTrips}
            className="text-xs font-semibold text-stone-700 hover:text-stone-900 flex items-center gap-1 hover:underline"
          >
            Alle ritten
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {myRecentTrips.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Je hebt nog geen ritten gemaakt. Start een rit wanneer je vertrekt!
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {myRecentTrips.map((trip) => {
              const startDate = new Date(trip.startTime);
              const formattedDate = startDate.toLocaleDateString('nl-BE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });
              const startTimeStr = startDate.toLocaleTimeString('nl-BE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endTimeStr = trip.endTime
                ? new Date(trip.endTime).toLocaleTimeString('nl-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '...';

              const kmDriven =
                trip.endKm && trip.endKm >= trip.startKm
                  ? trip.endKm - trip.startKm
                  : null;

              return (
                <div
                  key={trip.id}
                  className="p-4 sm:p-5 hover:bg-stone-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                        {trip.licensePlate}
                      </span>
                      <span className="text-xs text-stone-500 font-medium">
                        {formattedDate} • {startTimeStr} – {endTimeStr}
                      </span>
                      <StatusBadge
                        status={trip.status}
                        closedAutomatically={trip.closedAutomatically}
                        size="sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-stone-900 truncate">
                        {trip.purpose}
                      </h3>
                      <span className="text-xs text-stone-400">•</span>
                      <span className="text-xs text-stone-600 truncate">{trip.vehicleName}</span>
                    </div>

                    {trip.closedReason && (
                      <p className="text-xs text-blue-700 bg-blue-50/80 px-2 py-1 rounded-md mt-1.5 inline-block">
                        ℹ️ {trip.closedReason}
                      </p>
                    )}
                  </div>

                  {/* Mileage & Direct Close Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-stone-400 font-medium">
                        {trip.startKm.toLocaleString('nl-BE')} → {trip.endKm ? `${trip.endKm.toLocaleString('nl-BE')} km` : 'open'}
                      </div>
                      <div className="text-sm font-bold font-mono text-stone-900">
                        {kmDriven !== null ? `${kmDriven.toLocaleString('nl-BE')} km` : 'Onderweg'}
                      </div>
                    </div>

                    {trip.status === 'open' && (
                      <button
                        onClick={() => onOpenCloseTrip(trip)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Afsluiten
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
