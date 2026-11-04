import React, { useState, useMemo } from 'react';
import { Trip, Vehicle, Team, UserProfile } from '../types';
import { StatusBadge } from './StatusBadge';
import { DayOverview } from './DayOverview';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Car,
  User,
  Users,
  ChevronDown,
  RotateCcw,
  Clock,
  Gauge,
  ArrowUpDown,
  ListFilter,
  CalendarDays,
} from 'lucide-react';
import { exportTripsToCSV } from '../services/tripService';

interface SearchTripsProps {
  trips: Trip[];
  vehicles: Vehicle[];
  teams: Team[];
  currentUser: UserProfile;
  profiles: UserProfile[];
}

export const SearchTrips: React.FC<SearchTripsProps> = ({
  trips,
  vehicles,
  teams,
  currentUser,
  profiles,
}) => {
  const isFleetAdminOrAbove =
    currentUser.role === 'fleet_admin' || currentUser.role === 'admin';

  // Sub-view mode: 'day' for specific day logging inspection or 'custom' for range/text search
  const [viewMode, setViewMode] = useState<'day' | 'custom'>('day');

  // Filters for custom search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState(
    isFleetAdminOrAbove ? 'all' : currentUser.id
  );
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Vehicles visible to current user (users only see vehicles of their assigned teams)
  const userTeamIds = currentUser.teamIds || [];
  const visibleVehicles = isFleetAdminOrAbove
    ? vehicles
    : vehicles.filter((v) => userTeamIds.includes(v.teamId));

  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        // Non-admins can only see their own trips or trips of vehicles belonging to their teams
        if (!isFleetAdminOrAbove) {
          const isOwn = trip.userId === currentUser.id;
          const isOwnTeam = trip.teamId && userTeamIds.includes(trip.teamId);
          if (!isOwn && !isOwnTeam) {
            return false;
          }
        }

        // Search query: vehicle plate, purpose, notes, driver name
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchPlate = trip.licensePlate.toLowerCase().includes(q);
          const matchPurpose = trip.purpose.toLowerCase().includes(q);
          const matchName = trip.userName.toLowerCase().includes(q);
          const matchVeh = trip.vehicleName.toLowerCase().includes(q);
          const matchNotes = (trip.notes || '').toLowerCase().includes(q);
          if (!matchPlate && !matchPurpose && !matchName && !matchVeh && !matchNotes) {
            return false;
          }
        }

        // Vehicle filter
        if (selectedVehicleId !== 'all' && trip.vehicleId !== selectedVehicleId) {
          return false;
        }

        // Team filter
        if (selectedTeamId !== 'all' && trip.teamId !== selectedTeamId) {
          return false;
        }

        // User filter
        if (selectedUserId !== 'all' && trip.userId !== selectedUserId) {
          return false;
        }

        // Status filter
        if (selectedStatus !== 'all') {
          if (selectedStatus === 'auto_closed' && !trip.closedAutomatically && trip.status !== 'auto_closed') {
            return false;
          }
          if (selectedStatus === 'open' && trip.status !== 'open') {
            return false;
          }
          if (selectedStatus === 'closed' && (trip.status !== 'closed' || trip.closedAutomatically)) {
            return false;
          }
        }

        // Date filter
        const tripDate = trip.startTime.split('T')[0];
        if (startDate && tripDate < startDate) {
          return false;
        }
        if (endDate && tripDate > endDate) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [
    trips,
    searchTerm,
    selectedVehicleId,
    selectedTeamId,
    selectedUserId,
    selectedStatus,
    startDate,
    endDate,
    sortOrder,
    isFleetAdminOrAbove,
    currentUser.id,
    userTeamIds,
  ]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedVehicleId('all');
    setSelectedTeamId('all');
    setSelectedUserId(isFleetAdminOrAbove ? 'all' : currentUser.id);
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setSortOrder('desc');
  };

  const handleExport = () => {
    const today = new Date().toISOString().split('T')[0];
    exportTripsToCSV(filteredTrips, `ritten_export_${today}.csv`);
  };

  const totalFilteredKm = filteredTrips.reduce((acc, t) => {
    if (t.endKm && t.endKm >= t.startKm) {
      return acc + (t.endKm - t.startKm);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Ritten Raadplegen & Zoeken
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {isFleetAdminOrAbove
              ? 'Volledige logging van alle ritten per datum of filter op voertuig, team en bestuurder.'
              : 'Overzicht en historiek van jouw ritten en wagens.'}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex p-1 bg-white border border-stone-200 rounded-xl shadow-xs self-start sm:self-auto">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'day'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Dagoverzicht
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'custom'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            Uitgebreid zoeken
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: DAY OVERVIEW (Per datum alle ritten) */}
      {viewMode === 'day' ? (
        <DayOverview
          trips={trips}
          vehicles={visibleVehicles}
          teams={teams}
          currentUser={currentUser}
          profiles={profiles}
        />
      ) : (
        /* VIEW MODE 2: CUSTOM SEARCH & FILTERS */
        <div className="space-y-6 animate-in fade-in">
          {/* Filter Controls Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Filteropties
              </span>
              {isFleetAdminOrAbove && (
                <button
                  onClick={handleExport}
                  disabled={filteredTrips.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-40 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporteer CSV ({filteredTrips.length})
                </button>
              )}
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op nummerplaat, doel, model of bestuurder..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900 focus:outline-none"
              />
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Wagen */}
              <div>
                <label className="block text-stone-500 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                  Wagen
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium"
                >
                  <option value="all">Alle wagens</option>
                  {visibleVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.licensePlate} ({v.brand} {v.model})
                    </option>
                  ))}
                </select>
              </div>

              {/* Team / Wagenpark */}
              {teams.length > 0 && (
                <div>
                  <label className="block text-stone-500 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                    Team / Wagenpark
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium"
                  >
                    <option value="all">Alle teams</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Bestuurder */}
              {isFleetAdminOrAbove ? (
                <div>
                  <label className="block text-stone-500 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                    Bestuurder
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium"
                  >
                    <option value="all">Alle bestuurders</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-stone-500 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium"
                  >
                    <option value="all">Alle statussen</option>
                    <option value="open">Open</option>
                    <option value="closed">Afgesloten</option>
                    <option value="auto_closed">Automatisch afgesloten</option>
                  </select>
                </div>
              )}

              {/* Status (if admin has user filter) */}
              {isFleetAdminOrAbove && (
                <div>
                  <label className="block text-stone-500 font-semibold mb-1 uppercase tracking-wider text-[11px]">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-stone-900 focus:outline-none font-medium"
                  >
                    <option value="all">Alle statussen</option>
                    <option value="open">Open</option>
                    <option value="closed">Afgesloten</option>
                    <option value="auto_closed">Automatisch afgesloten</option>
                  </select>
                </div>
              )}
            </div>

            {/* Date Range & Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-stone-100">
              <div>
                <label className="block text-stone-500 font-semibold mb-1">Vanaf datum</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-stone-500 font-semibold mb-1">Tot en met datum</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-stone-900 focus:outline-none"
                />
              </div>
              <div className="flex items-end justify-between gap-2">
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex-1 p-2 rounded-xl border border-stone-300 hover:bg-stone-50 font-medium flex items-center justify-center gap-1.5 transition text-stone-700"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Sorteer: {sortOrder === 'desc' ? 'Nieuwste eerst' : 'Oudste eerst'}
                </button>
                <button
                  onClick={handleResetFilters}
                  title="Filters wissen"
                  className="p-2 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Summary statistics bar */}
          <div className="flex items-center justify-between px-2 text-xs text-stone-500 font-medium">
            <span>
              Gevonden resultaten: <strong className="text-stone-900">{filteredTrips.length}</strong> ritten
            </span>
            <span>
              Totale afstand:{' '}
              <strong className="text-stone-900 font-mono">
                {totalFilteredKm.toLocaleString('nl-BE')} km
              </strong>
            </span>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            {filteredTrips.length === 0 ? (
              <div className="p-12 text-center text-sm text-stone-500">
                Geen ritten gevonden die voldoen aan de filters.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Datum & Tijd</th>
                        <th className="py-3 px-4">Wagen</th>
                        <th className="py-3 px-4">Bestuurder</th>
                        <th className="py-3 px-4">Start KM</th>
                        <th className="py-3 px-4">Stop KM</th>
                        <th className="py-3 px-4">Afstand</th>
                        <th className="py-3 px-4">Doel</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredTrips.map((trip) => {
                        const startDateObj = new Date(trip.startTime);
                        const dateFormatted = startDateObj.toLocaleDateString('nl-BE');
                        const startFormatted = startDateObj.toLocaleTimeString('nl-BE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const stopFormatted = trip.endTime
                          ? new Date(trip.endTime).toLocaleTimeString('nl-BE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—';
                        const kmCount =
                          trip.endKm && trip.endKm >= trip.startKm
                            ? trip.endKm - trip.startKm
                            : null;

                        return (
                          <tr key={trip.id} className="hover:bg-stone-50/80 transition">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-semibold text-stone-900">{dateFormatted}</div>
                              <div className="text-stone-400 text-[11px]">
                                {startFormatted} → {stopFormatted}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900 mr-1.5">
                                {trip.licensePlate}
                              </span>
                              <span className="text-stone-600 truncate max-w-[140px] inline-block align-middle">
                                {trip.vehicleName}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-medium text-stone-800">
                              {trip.userName}
                            </td>
                            <td className="py-3 px-4 font-mono text-stone-600">
                              {trip.startKm.toLocaleString('nl-BE')}
                            </td>
                            <td className="py-3 px-4 font-mono text-stone-600">
                              {trip.endKm ? trip.endKm.toLocaleString('nl-BE') : '—'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-stone-900">
                              {kmCount !== null ? `${kmCount.toLocaleString('nl-BE')} km` : 'Open'}
                            </td>
                            <td className="py-3 px-4 text-stone-800 max-w-xs">
                              <div className="truncate font-medium">{trip.purpose}</div>
                              {trip.closedReason && (
                                <div className="text-[10px] text-blue-700 truncate mt-0.5">
                                  {trip.closedReason}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <StatusBadge
                                status={trip.status}
                                closedAutomatically={trip.closedAutomatically}
                                size="sm"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-stone-100">
                  {filteredTrips.map((trip) => {
                    const startDateObj = new Date(trip.startTime);
                    const dateFormatted = startDateObj.toLocaleDateString('nl-BE');
                    const startFormatted = startDateObj.toLocaleTimeString('nl-BE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const stopFormatted = trip.endTime
                      ? new Date(trip.endTime).toLocaleTimeString('nl-BE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';
                    const kmCount =
                      trip.endKm && trip.endKm >= trip.startKm
                        ? trip.endKm - trip.startKm
                        : null;

                    return (
                      <div key={trip.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                            {trip.licensePlate}
                          </span>
                          <StatusBadge
                            status={trip.status}
                            closedAutomatically={trip.closedAutomatically}
                            size="sm"
                          />
                        </div>

                        <div className="flex items-baseline justify-between">
                          <h4 className="text-sm font-bold text-stone-900">{trip.purpose}</h4>
                          <span className="font-mono font-bold text-sm text-stone-900">
                            {kmCount !== null ? `${kmCount} km` : 'Open'}
                          </span>
                        </div>

                        <div className="text-xs text-stone-500 flex items-center justify-between">
                          <span>{trip.userName}</span>
                          <span>
                            {dateFormatted} ({startFormatted} - {stopFormatted})
                          </span>
                        </div>

                        <div className="text-xs text-stone-400 font-mono">
                          KM: {trip.startKm} → {trip.endKm || '...'}
                        </div>

                        {trip.closedReason && (
                          <p className="text-[11px] text-blue-700 bg-blue-50 p-1.5 rounded">
                            ℹ️ {trip.closedReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
