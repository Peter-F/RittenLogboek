import React, { useState, useMemo } from 'react';
import { Trip, Vehicle, Team, UserProfile } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Car,
  Users,
  Gauge,
  Clock,
  Download,
  Filter,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { exportTripsToCSV } from '../services/tripService';

interface DayOverviewProps {
  trips: Trip[];
  vehicles: Vehicle[];
  teams: Team[];
  currentUser: UserProfile;
  profiles: UserProfile[];
  onOpenManualClose?: (trip: Trip) => void;
}

export const DayOverview: React.FC<DayOverviewProps> = ({
  trips,
  vehicles,
  teams,
  currentUser,
  profiles,
  onOpenManualClose,
}) => {
  const isSuperAdmin = currentUser.role === 'admin';
  const isFleetAdmin = currentUser.role === 'fleet_admin' || isSuperAdmin;

  // Selected date (defaults to today)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');

  // Change date by delta days (-1 or +1)
  const changeDateBy = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  // Format date display (e.g., "Woensdag 4 november 2026")
  const dateObj = new Date(selectedDate);
  const dateFormattedDutch = dateObj.toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isToday = selectedDate === todayStr;

  // Filter trips for the selected day
  const dayTrips = useMemo(() => {
    return trips
      .filter((t) => {
        // Match day by start date or end date
        const startDatePart = t.startTime.split('T')[0];
        const endDatePart = t.endTime ? t.endTime.split('T')[0] : null;
        const matchesDate = startDatePart === selectedDate || endDatePart === selectedDate;
        if (!matchesDate) return false;

        // Team filter
        if (selectedTeamId !== 'all' && t.teamId !== selectedTeamId) {
          return false;
        }

        // Vehicle filter
        if (selectedVehicleId !== 'all' && t.vehicleId !== selectedVehicleId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [trips, selectedDate, selectedTeamId, selectedVehicleId]);

  // Daily statistics
  const totalDayKm = dayTrips.reduce((acc, t) => {
    if (t.endKm && t.endKm >= t.startKm) {
      return acc + (t.endKm - t.startKm);
    }
    return acc;
  }, 0);

  const uniqueVehiclesCount = new Set(dayTrips.map((t) => t.vehicleId)).size;
  const uniqueDriversCount = new Set(dayTrips.map((t) => t.userId)).size;

  const handleExportDay = () => {
    exportTripsToCSV(dayTrips, `ritten_dagoverzicht_${selectedDate}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Date Navigation Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Selector with Next / Prev */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDateBy(-1)}
            title="Vorige dag"
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-stone-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-stone-900 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => changeDateBy(1)}
            title="Volgende dag"
            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 transition"
            >
              Vandaag
            </button>
          )}
        </div>

        {/* Selected date formatted title */}
        <div className="text-left md:text-right">
          <div className="text-sm font-bold text-stone-900 capitalize">
            {dateFormattedDutch}
          </div>
          <div className="text-xs text-stone-500">
            {isToday ? 'Vandaag' : `Historisch logboek`}
          </div>
        </div>

        {/* Export Day CSV */}
        <button
          onClick={handleExportDay}
          disabled={dayTrips.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-xs transition disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          Exporteer deze dag ({dayTrips.length})
        </button>
      </div>

      {/* Daily Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
            Ritten op deze dag
          </span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            {dayTrips.length}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
            Totaal gereden km
          </span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            {totalDayKm.toLocaleString('nl-BE')} <span className="text-xs font-normal text-stone-500">km</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
            Gebruikte wagens
          </span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            {uniqueVehiclesCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block">
            Actieve bestuurders
          </span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            {uniqueDriversCount}
          </span>
        </div>
      </div>

      {/* Quick Day Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-stone-200 text-xs">
        <div className="flex items-center gap-1.5 text-stone-500 font-semibold uppercase tracking-wider text-[11px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Team filter */}
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="p-1.5 rounded-lg border border-stone-300 bg-white font-medium text-xs focus:ring-1 focus:ring-stone-900"
        >
          <option value="all">Alle wagenparken / teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Vehicle filter */}
        <select
          value={selectedVehicleId}
          onChange={(e) => setSelectedVehicleId(e.target.value)}
          className="p-1.5 rounded-lg border border-stone-300 bg-white font-medium text-xs focus:ring-1 focus:ring-stone-900"
        >
          <option value="all">Alle wagens</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.licensePlate} ({v.brand} {v.model})
            </option>
          ))}
        </select>
      </div>

      {/* Trips Timeline / Table for that Day */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        {dayTrips.length === 0 ? (
          <div className="p-12 text-center text-sm text-stone-500">
            Geen ritten geregistreerd op {dateFormattedDutch}.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {dayTrips.map((trip) => {
              const startObj = new Date(trip.startTime);
              const startFormatted = startObj.toLocaleTimeString('nl-BE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const stopFormatted = trip.endTime
                ? new Date(trip.endTime).toLocaleTimeString('nl-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Onderweg';

              const kmDriven =
                trip.endKm && trip.endKm >= trip.startKm
                  ? trip.endKm - trip.startKm
                  : null;

              const teamObj = teams.find((t) => t.id === trip.teamId);

              return (
                <div
                  key={trip.id}
                  className="p-4 sm:p-5 hover:bg-stone-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                        {trip.licensePlate}
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {trip.vehicleName}
                      </span>
                      {teamObj && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-50 text-stone-500 border border-stone-200">
                          {teamObj.name}
                        </span>
                      )}
                      <StatusBadge
                        status={trip.status}
                        closedAutomatically={trip.closedAutomatically}
                        size="sm"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-600">
                      <span className="font-semibold text-stone-800">{trip.userName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        {startFormatted} → {stopFormatted}
                      </span>
                    </div>

                    <div className="text-xs text-stone-700">
                      Doel: <strong className="font-medium text-stone-900">{trip.purpose}</strong>
                      {trip.notes && (
                        <span className="text-stone-400 italic ml-2">“{trip.notes}”</span>
                      )}
                    </div>

                    {trip.closedReason && (
                      <div className="text-[11px] text-blue-700 bg-blue-50/80 px-2 py-1 rounded inline-block">
                        ℹ️ {trip.closedReason}
                      </div>
                    )}
                  </div>

                  {/* Distance & Admin Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-mono text-stone-400">
                        {trip.startKm.toLocaleString('nl-BE')} → {trip.endKm ? `${trip.endKm.toLocaleString('nl-BE')} km` : '...'}
                      </div>
                      <div className="text-base font-mono font-bold text-stone-900">
                        {kmDriven !== null ? `${kmDriven.toLocaleString('nl-BE')} km` : 'Openstaand'}
                      </div>
                    </div>

                    {trip.status === 'open' && isFleetAdmin && onOpenManualClose && (
                      <button
                        onClick={() => onOpenManualClose(trip)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Afsluiten
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
