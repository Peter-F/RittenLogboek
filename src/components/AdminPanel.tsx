import React, { useState } from 'react';
import { Trip, Vehicle, Team, UserProfile, UserRole } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  ShieldCheck,
  Car,
  Users,
  Layers,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Building,
  KeyRound,
  FileCheck,
} from 'lucide-react';
import {
  adminManualCloseTrip,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  addTeam,
  updateTeam,
  updateUserProfile,
} from '../services/tripService';

interface AdminPanelProps {
  currentUser: UserProfile;
  trips: Trip[];
  vehicles: Vehicle[];
  teams: Team[];
  profiles: UserProfile[];
  onSuccess: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  trips,
  vehicles,
  teams,
  profiles,
  onSuccess,
}) => {
  const isSuperAdmin = currentUser.role === 'admin';
  const isFleetAdmin = currentUser.role === 'fleet_admin' || isSuperAdmin;

  const [activeTab, setActiveTab] = useState<'open_trips' | 'vehicles' | 'users' | 'teams'>(
    'open_trips'
  );

  // Manual close modal state
  const [closingTrip, setClosingTrip] = useState<Trip | null>(null);
  const [manualEndKm, setManualEndKm] = useState<number>(0);
  const [manualEndTime, setManualEndTime] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('');
  const [manualCloseSubmitting, setManualCloseSubmitting] = useState(false);
  const [manualCloseError, setManualCloseError] = useState<string | null>(null);

  // Vehicle edit/create modal state
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehSubmitting, setVehSubmitting] = useState(false);
  const [vehError, setVehError] = useState<string | null>(null);

  // Team edit/create modal state
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // User edit modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Filter open trips
  const openTripsList = trips.filter((t) => t.status === 'open');

  // Trigger manual close dialog
  const handleOpenManualClose = (trip: Trip) => {
    setClosingTrip(trip);
    setManualEndKm(trip.startKm + 10);
    setManualEndTime(new Date().toISOString().slice(0, 16));
    setManualReason('Bestuurder vergeten rit af te sluiten na terugkomst');
    setManualCloseError(null);
  };

  const handleManualCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTrip) return;
    setManualCloseError(null);

    if (manualEndKm < closingTrip.startKm) {
      setManualCloseError('Stopkilometerstand kan niet kleiner zijn dan startkilometerstand.');
      return;
    }

    if (!manualReason.trim()) {
      setManualCloseError('Reden voor handmatig afsluiten is verplicht.');
      return;
    }

    try {
      setManualCloseSubmitting(true);
      await adminManualCloseTrip({
        tripId: closingTrip.id,
        vehicleId: closingTrip.vehicleId,
        endKm: Number(manualEndKm),
        endTime: new Date(manualEndTime).toISOString(),
        reason: manualReason.trim(),
        adminUser: currentUser,
      });

      onSuccess(
        `Rit voor wagen ${closingTrip.licensePlate} is handmatig afgesloten door beheerder.`
      );
      setClosingTrip(null);
    } catch (err: any) {
      console.error('Error manually closing trip:', err);
      setManualCloseError(err.message || 'Kon rit niet afsluiten.');
    } finally {
      setManualCloseSubmitting(false);
    }
  };

  // Save vehicle
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setVehError(null);

    if (!editingVehicle.licensePlate || !editingVehicle.brand || !editingVehicle.model) {
      setVehError('Nummerplaat, merk en model zijn verplicht.');
      return;
    }

    try {
      setVehSubmitting(true);
      if (editingVehicle.id) {
        await updateVehicle(editingVehicle.id, editingVehicle);
        onSuccess(`Wagen ${editingVehicle.licensePlate} bijgewerkt!`);
      } else {
        await addVehicle({
          teamId: editingVehicle.teamId || teams[0]?.id || 'team_bouw',
          licensePlate: editingVehicle.licensePlate.trim().toUpperCase(),
          brand: editingVehicle.brand.trim(),
          model: editingVehicle.model.trim(),
          nickname: editingVehicle.nickname?.trim() || '',
          isActive: editingVehicle.isActive ?? true,
          lastKnownKm: Number(editingVehicle.lastKnownKm || 0),
        });
        onSuccess(`Nieuwe wagen ${editingVehicle.licensePlate} toegevoegd!`);
      }
      setVehicleModalOpen(false);
      setEditingVehicle(null);
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setVehError(err.message || 'Kon wagen niet opslaan.');
    } finally {
      setVehSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (id: string, plate: string) => {
    if (!confirm(`Weet je zeker dat je wagen ${plate} wilt verwijderen?`)) return;
    try {
      await deleteVehicle(id);
      onSuccess(`Wagen ${plate} verwijderd.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Save team
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setTeamError(null);

    if (!editingTeam.name?.trim()) {
      setTeamError('Teamnaam is verplicht.');
      return;
    }

    try {
      setTeamSubmitting(true);
      if (editingTeam.id) {
        await updateTeam(editingTeam.id, editingTeam);
        onSuccess(`Team ${editingTeam.name} bijgewerkt!`);
      } else {
        await addTeam({
          name: editingTeam.name.trim(),
          description: editingTeam.description?.trim() || '',
          isActive: editingTeam.isActive ?? true,
        });
        onSuccess(`Nieuw team ${editingTeam.name} aangemaakt!`);
      }
      setTeamModalOpen(false);
      setEditingTeam(null);
    } catch (err: any) {
      console.error('Error saving team:', err);
      setTeamError(err.message || 'Kon team niet opslaan.');
    } finally {
      setTeamSubmitting(false);
    }
  };

  // Save user profile
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setUserSubmitting(true);
      await updateUserProfile(editingUser.id, editingUser);
      onSuccess(`Gebruiker ${editingUser.fullName} bijgewerkt!`);
      setUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error saving user profile:', err);
      alert('Kon profiel niet bijwerken.');
    } finally {
      setUserSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Beheerderspaneel
            </h1>
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            Ingelogd als{' '}
            <strong className="text-stone-800">
              {isSuperAdmin ? 'Systeem Administrator' : 'Wagen Administrator'}
            </strong>{' '}
            ({currentUser.fullName})
          </p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-stone-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('open_trips')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'open_trips'
              ? 'border-amber-500 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          Openstaande ritten
          {openTripsList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 font-bold">
              {openTripsList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'vehicles'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Car className="w-4 h-4" />
          Wagens ({vehicles.length})
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
              activeTab === 'teams'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Building className="w-4 h-4 text-indigo-600" />
            Groepen & Teams ({teams.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
            activeTab === 'users'
              ? 'border-stone-900 text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Gebruikers & Rollen ({profiles.length})
        </button>
      </div>

      {/* TAB 1: OPENSTAANDE RITTEN (MANUAL CLOSURE) */}
      {activeTab === 'open_trips' && (
        <section aria-labelledby="admin-open-trips-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="admin-open-trips-heading" className="text-base font-bold text-stone-900">
              Actueel openstaande ritten
            </h2>
            <span className="text-xs text-stone-500">
              Als beheerder kun je een vergeten rit handmatig afsluiten.
            </span>
          </div>

          {openTripsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
              Er zijn momenteel geen openstaande ritten in het wagenpark.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openTripsList.map((trip) => {
                const startTimeFormatted = new Date(trip.startTime).toLocaleTimeString('nl-BE', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const startDateFormatted = new Date(trip.startTime).toLocaleDateString('nl-BE');

                return (
                  <div
                    key={trip.id}
                    className="bg-white rounded-2xl border border-amber-300 p-5 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                          {trip.licensePlate}
                        </span>
                        <StatusBadge status="open" size="sm" />
                      </div>

                      <h3 className="text-base font-bold text-stone-900">{trip.vehicleName}</h3>
                      <p className="text-xs text-stone-600 mt-1">
                        Bestuurder:{' '}
                        <strong className="text-stone-900 font-semibold">{trip.userName}</strong>
                      </p>

                      <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-stone-400 block">Gestart om:</span>
                          <span className="font-medium text-stone-800">
                            {startDateFormatted} {startTimeFormatted}
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-400 block">Startstand:</span>
                          <span className="font-mono font-bold text-stone-900">
                            {trip.startKm.toLocaleString('nl-BE')} km
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-stone-400 block">Doel:</span>
                          <span className="text-stone-800 font-medium">{trip.purpose}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenManualClose(trip)}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Vergeten rit handmatig afsluiten
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: WAGENS BEHEER */}
      {activeTab === 'vehicles' && (
        <section aria-labelledby="admin-vehicles-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="admin-vehicles-heading" className="text-base font-bold text-stone-900">
                Wagens in de vloot
              </h2>
              <p className="text-xs text-stone-500">
                Voeg wagens toe, bewerk gegevens of koppel wagens aan teams.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVehicle({
                  licensePlate: '',
                  brand: '',
                  model: '',
                  nickname: '',
                  teamId: teams[0]?.id || 'team_bouw',
                  isActive: true,
                  lastKnownKm: 0,
                });
                setVehicleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Wagen toevoegen
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nummerplaat</th>
                    <th className="py-3 px-4">Voertuig</th>
                    <th className="py-3 px-4">Bijnaam</th>
                    <th className="py-3 px-4">Team / Afdeling</th>
                    <th className="py-3 px-4">Laatst bekende KM</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {vehicles.map((v) => {
                    const team = teams.find((t) => t.id === v.teamId);
                    return (
                      <tr key={v.id} className="hover:bg-stone-50/70 transition">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-stone-900">
                            {v.licensePlate}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900 whitespace-nowrap">
                          {v.brand} {v.model}
                        </td>
                        <td className="py-3 px-4 text-stone-500 italic">
                          {v.nickname ? `“${v.nickname}”` : '—'}
                        </td>
                        <td className="py-3 px-4 text-stone-700 whitespace-nowrap">
                          {team?.name || 'Onbekend team'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                          {v.lastKnownKm.toLocaleString('nl-BE')} km
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              v.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-stone-100 text-stone-500 border-stone-200'
                            }`}
                          >
                            {v.isActive ? 'Actief' : 'Inactief'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setEditingVehicle(v);
                              setVehicleModalOpen(true);
                            }}
                            className="p-1.5 text-stone-400 hover:text-stone-800 transition mr-1"
                            title="Bewerken"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v.id, v.licensePlate)}
                            className="p-1.5 text-rose-400 hover:text-rose-700 transition"
                            title="Verwijderen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: GROEPEN & TEAMS (Super admin only) */}
      {activeTab === 'teams' && isSuperAdmin && (
        <section aria-labelledby="admin-teams-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="admin-teams-heading" className="text-base font-bold text-stone-900">
                Groepen & Teams beheren
              </h2>
              <p className="text-xs text-stone-500">
                Definieer aparte teams met elk hun eigen wagenpark en bevoegdheden.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTeam({
                  name: '',
                  description: '',
                  isActive: true,
                });
                setTeamModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Nieuw team aanmaken
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const assignedVehicles = vehicles.filter((v) => v.teamId === team.id);
              return (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                        <Building className="w-4 h-4" />
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          team.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                      >
                        {team.isActive ? 'Actief' : 'Inactief'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-stone-900">{team.name}</h3>
                    {team.description && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {team.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-stone-100">
                      <span className="text-xs font-semibold text-stone-500 block mb-1.5">
                        Wagenpark ({assignedVehicles.length} wagens):
                      </span>
                      {assignedVehicles.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">Geen wagens gekoppeld</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {assignedVehicles.map((v) => (
                            <span
                              key={v.id}
                              className="font-mono text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200"
                            >
                              {v.licensePlate}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-stone-100 flex justify-end">
                    <button
                      onClick={() => {
                        setEditingTeam(team);
                        setTeamModalOpen(true);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Bewerken
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 4: GEBRUIKERS & ROLLEN */}
      {activeTab === 'users' && (
        <section aria-labelledby="admin-users-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="admin-users-heading" className="text-base font-bold text-stone-900">
                Gebruikers & Toegangsrollen
              </h2>
              <p className="text-xs text-stone-500">
                Beheer rollen (Medewerker, Wagen Administrator, Systeembeheerder) en teamlidmaatschappen.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Naam</th>
                    <th className="py-3 px-4">E-mailadres</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Toegewezen Teams</th>
                    <th className="py-3 px-4">Status</th>
                    {isFleetAdmin && <th className="py-3 px-4 text-right">Actie</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {profiles.map((p) => {
                    const roleLabel =
                      p.role === 'admin'
                        ? 'Systeem Administrator'
                        : p.role === 'fleet_admin'
                        ? 'Wagen Administrator'
                        : 'Medewerker';

                    const roleBadgeClass =
                      p.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : p.role === 'fleet_admin'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-stone-100 text-stone-700 border-stone-200';

                    const userTeamNames = (p.teamIds || [])
                      .map((tId) => teams.find((t) => t.id === tId)?.name)
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <tr key={p.id} className="hover:bg-stone-50/70 transition">
                        <td className="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">
                          {p.fullName}
                        </td>
                        <td className="py-3 px-4 text-stone-600 whitespace-nowrap">{p.email}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${roleBadgeClass}`}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                          {userTeamNames || 'Geen specifiek team'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              p.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {p.isActive ? 'Actief' : 'Gedeactiveerd'}
                          </span>
                        </td>
                        {isFleetAdmin && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingUser(p);
                                setUserModalOpen(true);
                              }}
                              className="p-1.5 text-stone-400 hover:text-stone-800 transition"
                              title="Rol & Teams bewerken"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* MODAL: MANUAL CLOSE OF FORGOTTEN TRIP */}
      {closingTrip && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-stone-900">
                  Vergeten rit handmatig afsluiten
                </h3>
              </div>
              <button
                onClick={() => setClosingTrip(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualCloseSubmit} className="p-6 space-y-4">
              {manualCloseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {manualCloseError}
                </div>
              )}

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1">
                <div>
                  Wagen:{' '}
                  <strong className="font-mono text-stone-900">{closingTrip.licensePlate}</strong> (
                  {closingTrip.vehicleName})
                </div>
                <div>
                  Bestuurder: <strong>{closingTrip.userName}</strong>
                </div>
                <div>
                  Startstand: <strong>{closingTrip.startKm} km</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Stopkilometerstand <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={closingTrip.startKm}
                  value={manualEndKm || ''}
                  onChange={(e) => setManualEndKm(Number(e.target.value))}
                  className="w-full text-base font-mono font-bold px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Stoptijdstip
                </label>
                <input
                  type="datetime-local"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Reden voor handmatige interventie <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="bv. Medewerker ziek, wagen staat al op terrein..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setClosingTrip(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={manualCloseSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {manualCloseSubmitting ? 'Bezig...' : 'Handmatig afsluiten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT VEHICLE */}
      {vehicleModalOpen && editingVehicle && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="text-base font-bold text-stone-900">
                {editingVehicle.id ? 'Wagen bewerken' : 'Nieuwe wagen toevoegen'}
              </h3>
              <button
                onClick={() => setVehicleModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-6 space-y-4">
              {vehError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {vehError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Nummerplaat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingVehicle.licensePlate || ''}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value })
                  }
                  placeholder="bv. 1-ABC-123"
                  className="w-full font-mono uppercase font-bold px-3 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Merk <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingVehicle.brand || ''}
                    onChange={(e) =>
                      setEditingVehicle({ ...editingVehicle, brand: e.target.value })
                    }
                    placeholder="Volkswagen"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Model <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingVehicle.model || ''}
                    onChange={(e) =>
                      setEditingVehicle({ ...editingVehicle, model: e.target.value })
                    }
                    placeholder="Transporter"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Bijnaam <span className="text-stone-400 font-normal">(optioneel)</span>
                </label>
                <input
                  type="text"
                  value={editingVehicle.nickname || ''}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, nickname: e.target.value })
                  }
                  placeholder="bv. De Grote Witte, Servicebus 1"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Toegewezen Team / Afdeling
                </label>
                <select
                  value={editingVehicle.teamId || teams[0]?.id}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, teamId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white font-medium"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Laatste bekende kilometerstand
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingVehicle.lastKnownKm || 0}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, lastKnownKm: Number(e.target.value) })
                  }
                  className="w-full font-mono px-3 py-2 rounded-xl border border-stone-300 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vehIsActive"
                  checked={editingVehicle.isActive ?? true}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
                />
                <label htmlFor="vehIsActive" className="text-xs font-semibold text-stone-800">
                  Wagen is actief en beschikbaar voor ritten
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={vehSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {vehSubmitting ? 'Bezig...' : 'Wagen opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT TEAM */}
      {teamModalOpen && editingTeam && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="text-base font-bold text-stone-900">
                {editingTeam.id ? 'Team bewerken' : 'Nieuw team aanmaken'}
              </h3>
              <button
                onClick={() => setTeamModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="p-6 space-y-4">
              {teamError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {teamError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Teamnaam <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingTeam.name || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  placeholder="bv. Installatie Regio Zuid"
                  className="w-full font-bold px-3 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Omschrijving
                </label>
                <textarea
                  rows={2}
                  value={editingTeam.description || ''}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, description: e.target.value })
                  }
                  placeholder="Doel van dit wagenpark of afdeling..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="teamIsActive"
                  checked={editingTeam.isActive ?? true}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-600"
                />
                <label htmlFor="teamIsActive" className="text-xs font-semibold text-stone-800">
                  Team is actief
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTeamModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={teamSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {teamSubmitting ? 'Bezig...' : 'Team opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER ROLE & TEAMS */}
      {userModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="text-base font-bold text-stone-900">Gebruikersrol & Teams aanpassen</h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Gebruiker
                </label>
                <div className="text-sm font-bold text-stone-900">{editingUser.fullName}</div>
                <div className="text-xs text-stone-500">{editingUser.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Rol in WagenRit
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                  }
                  className="w-full p-2.5 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                >
                  <option value="user">Gebruiker / Medewerker (Ritten starten/stoppen)</option>
                  <option value="fleet_admin">Wagen Administrator (Wagenpark & ritten beheren)</option>
                  <option value="admin">Systeem Administrator (Teams, groepen & gebruikers beheren)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  Toegewezen Teams
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-stone-200 p-2 rounded-xl">
                  {teams.map((t) => {
                    const isChecked = (editingUser.teamIds || []).includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer p-1 rounded hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = editingUser.teamIds || [];
                            const updated = e.target.checked
                              ? [...cur, t.id]
                              : cur.filter((id) => id !== t.id);
                            setEditingUser({ ...editingUser, teamIds: updated });
                          }}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-600"
                        />
                        <span>{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveToggle"
                  checked={editingUser.isActive}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
                />
                <label htmlFor="userActiveToggle" className="text-xs font-semibold text-stone-800">
                  Gebruiker is actief
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {userSubmitting ? 'Bezig...' : 'Gebruiker opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
