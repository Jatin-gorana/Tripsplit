import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Compass, MapPin, Users, CheckCircle2, UserCheck, UserPlus, ArrowLeft } from 'lucide-react';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function JoinTripPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState(null);

  const [joinAction, setJoinAction] = useState('new'); // 'claim' or 'new'
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoading(true);
        const data = await apiRequest(`/trips/invite/${inviteCode}`);
        setInviteData(data);
        if (data.is_already_member) {
          navigate(`/trips/${data.trip.id}`);
          return;
        }
        if (data.unlinked_guests && data.unlinked_guests.length > 0) {
          setJoinAction('claim');
          setSelectedGuestId(String(data.unlinked_guests[0].id));
        } else {
          setJoinAction('new');
        }
      } catch (err) {
        setError(err.message || 'Invalid or expired invite link.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [inviteCode, navigate]);

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        invite_code: inviteCode.toUpperCase(),
        action: joinAction,
        ...(joinAction === 'claim' ? { member_id: Number(selectedGuestId) } : {})
      };

      const res = await apiRequest('/trips/join', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      navigate(`/trips/${res.trip.id}`);
    } catch (err) {
      setError(err.message || 'Failed to join trip.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-slate-900 text-white flex items-center justify-center">
        <div className="w-full max-w-md">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen p-4 bg-slate-900 text-white flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-800 p-6 rounded-2xl text-center space-y-4 border border-slate-700">
          <h2 className="text-xl font-bold text-red-400">Invalid Invite</h2>
          <p className="text-xs text-slate-400">{error || 'Could not find a trip for this invite link.'}</p>
          <button
            onClick={() => navigate('/trips')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-semibold"
          >
            Go to My Trips
          </button>
        </div>
      </div>
    );
  }

  const { trip, unlinked_guests } = inviteData;

  return (
    <div className="min-h-screen p-4 bg-slate-900 text-white flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 shadow-2xl space-y-6">
        
        <button
          onClick={() => navigate('/trips')}
          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">{trip.name}</h1>
          <div className="flex items-center justify-center space-x-1 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>{trip.destination}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs text-center">
            {error}
          </div>
        )}

        {/* Join Options */}
        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              How would you like to join?
            </label>

            {unlinked_guests && unlinked_guests.length > 0 && (
              <div
                onClick={() => setJoinAction('claim')}
                className={`p-4 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                  joinAction === 'claim'
                    ? 'bg-sky-500/10 border-sky-500 text-white'
                    : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <UserCheck className={`w-5 h-5 mt-0.5 shrink-0 ${joinAction === 'claim' ? 'text-sky-400' : 'text-slate-500'}`} />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-sm">Claim an existing guest member</div>
                  <p className="text-xs text-slate-400">
                    If someone already added expenses under your name before you joined.
                  </p>
                  
                  {joinAction === 'claim' && (
                    <select
                      value={selectedGuestId}
                      onChange={(e) => setSelectedGuestId(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      {unlinked_guests.map(g => (
                        <option key={g.id} value={g.id}>
                          This is me: "{g.name}"
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            <div
              onClick={() => setJoinAction('new')}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${
                joinAction === 'new'
                  ? 'bg-sky-500/10 border-sky-500 text-white'
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <UserPlus className={`w-5 h-5 mt-0.5 shrink-0 ${joinAction === 'new' ? 'text-sky-400' : 'text-slate-500'}`} />
              <div>
                <div className="font-semibold text-sm">Join as a new member</div>
                <p className="text-xs text-slate-400">
                  Add "{user?.name}" as a brand new member to this trip.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-xl text-sm font-semibold shadow-lg shadow-sky-500/20 transition flex items-center justify-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Joining...' : 'Confirm & Join Trip'}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
