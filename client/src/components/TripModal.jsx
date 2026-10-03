import React, { useState } from 'react';
import { X, MapPin, Calendar, Wallet, Trash2 } from 'lucide-react';
import { parseRupeesToPaise } from '../utils/formatters';

function TripFormInner({
  onClose,
  onSave,
  onDelete = null,
  initialTrip = null,
  isOffline = false
}) {
  const [name, setName] = useState(initialTrip?.name || '');
  const [destination, setDestination] = useState(initialTrip?.destination || '');
  const [startDate, setStartDate] = useState(
    initialTrip?.start_date ? initialTrip.start_date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    initialTrip?.end_date ? initialTrip.end_date.split('T')[0] : (() => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 5);
      return nextWeek.toISOString().split('T')[0];
    })()
  );
  const [budgetRupees, setBudgetRupees] = useState(
    initialTrip?.budget_paise ? String(initialTrip.budget_paise / 100) : ''
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOffline) {
      setError('Cannot save trip while offline.');
      return;
    }
    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const budgetPaise = budgetRupees ? parseRupeesToPaise(budgetRupees) : null;
      await onSave({
        name: name.trim(),
        destination: destination.trim(),
        start_date: startDate,
        end_date: endDate,
        budget_paise: budgetPaise
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save trip.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isOffline || !onDelete) return;
    if (!window.confirm(`Are you sure you want to delete the trip "${name}" and all its expenses?`)) return;

    setSubmitting(true);
    try {
      await onDelete(initialTrip.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete trip.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="font-semibold text-lg">
            {initialTrip ? 'Edit Trip Settings' : 'Create New Trip'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Trip Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Goa Beach Vacation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Destination
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Goa, India"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Optional Budget (₹)
            </label>
            <div className="relative">
              <Wallet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="number"
                placeholder="e.g. 50000"
                value={budgetRupees}
                onChange={(e) => setBudgetRupees(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm font-semibold"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {initialTrip && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting || isOffline}
                className="flex items-center space-x-1 text-red-500 hover:text-red-600 text-xs font-semibold px-2 py-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Trip</span>
              </button>
            )}

            <div className="flex items-center space-x-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || isOffline}
                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold shadow-md"
              >
                {submitting ? 'Saving...' : (initialTrip ? 'Save Changes' : 'Create Trip')}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

export default function TripModal(props) {
  if (!props.isOpen) return null;
  return <TripFormInner key={props.initialTrip?.id || 'new_trip'} {...props} />;
}
