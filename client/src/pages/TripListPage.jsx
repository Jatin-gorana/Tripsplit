import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import { formatRupees, formatDate } from '../utils/formatters';
import TripModal from '../components/TripModal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Toast from '../components/Toast';
import { Plus, LogOut, Compass, MapPin, Users, ArrowRight, KeyRound, Trash2, Edit3, Shield } from 'lucide-react';

export default function TripListPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [toast, setToast] = useState(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/trips');
      setTrips(data);
    } catch (err) {
      setError(err.message || 'Failed to load trips.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleCreateTrip = async (tripData) => {
    const res = await apiRequest('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
    setTrips([res.trip, ...trips]);
    setToast({ type: 'success', message: `Trip "${res.trip.name}" created!` });
    navigate(`/trips/${res.trip.id}`);
  };

  const handleUpdateTrip = async (tripData) => {
    const updated = await apiRequest(`/trips/${tripToEdit.id}`, {
      method: 'PUT',
      body: JSON.stringify(tripData)
    });
    setToast({ type: 'success', message: 'Trip updated!' });
    fetchTrips();
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('Are you sure you want to delete this trip and all its expenses?')) return;
    try {
      await apiRequest(`/trips/${tripId}`, { method: 'DELETE' });
      setToast({ type: 'success', message: 'Trip deleted.' });
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to delete trip.' });
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/join/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Compass className="w-6 h-6 text-sky-500" />
            <h1 className="font-bold text-lg tracking-tight">TripSplit</h1>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">

        {/* Join Trip by Code Card */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <KeyRound className="w-4 h-4 text-sky-500" />
            <span>Have an Invite Code?</span>
          </div>
          <form onSubmit={handleJoinByCode} className="flex space-x-2">
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. GOA123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow transition"
            >
              Join Trip
            </button>
          </form>
        </div>

        {/* Header & Create Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Your Trips</h2>
          <button
            onClick={() => {
              setTripToEdit(null);
              setIsTripModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Trip</span>
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Trip List */}
        {loading ? (
          <LoadingSkeleton />
        ) : trips.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
            <Compass className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">No trips yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create a new trip or join one using an invite code to start splitting expenses.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map(t => {
              const isAdmin = Number(t.admin_user_id) === Number(user?.id);
              return (
                <div
                  key={t.id}
                  className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-sky-500/50 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div
                      onClick={() => navigate(`/trips/${t.id}`)}
                      className="cursor-pointer flex-1"
                    >
                      <div className="flex items-center space-x-1.5">
                        <h3 className="font-bold text-base group-hover:text-sky-500 transition">
                          {t.name}
                        </h3>
                        {isAdmin && <Shield className="w-3.5 h-3.5 text-amber-500" title="Admin" />}
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-500" />
                        <span>{t.destination}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {t.invite_code}
                      </span>

                      {isAdmin && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTripToEdit(t);
                              setIsTripModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Edit Trip Settings"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTrip(t.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Delete Trip"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    onClick={() => navigate(`/trips/${t.id}`)}
                    className="cursor-pointer flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60 pt-3"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.member_count} members</span>
                      </span>
                      <span>•</span>
                      <span>{formatDate(t.start_date)}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-semibold text-slate-800 dark:text-slate-200">
                      <span>{formatRupees(t.total_spent_paise)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Create / Edit Trip Modal */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setTripToEdit(null);
        }}
        onSave={tripToEdit ? handleUpdateTrip : handleCreateTrip}
        onDelete={handleDeleteTrip}
        initialTrip={tripToEdit}
      />

    </div>
  );
}
