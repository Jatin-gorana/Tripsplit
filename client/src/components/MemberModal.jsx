import React, { useState } from 'react';
import { X, UserPlus, Edit3, Trash2, AlertTriangle } from 'lucide-react';

function MemberFormInner({
  onClose,
  onAddGuest,
  onRenameMember,
  onDeleteMember,
  memberToEdit = null,
  isAdmin = false,
  isOffline = false
}) {
  const [name, setName] = useState(memberToEdit?.name || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forceDeleteWarning, setForceDeleteWarning] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOffline) {
      setError('Cannot edit members while offline.');
      return;
    }
    if (!name.trim()) {
      setError('Member name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (memberToEdit) {
        await onRenameMember(memberToEdit.id, name.trim());
      } else {
        await onAddGuest(name.trim());
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (force = false) => {
    if (isOffline) return;
    setSubmitting(true);
    setError('');
    try {
      await onDeleteMember(memberToEdit.id, force);
      onClose();
    } catch (err) {
      if (err.message && err.message.includes('requires_force')) {
        setForceDeleteWarning('This member has expense records associated. Confirm force removal?');
      } else {
        setError(err.message || 'Failed to remove member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            {memberToEdit ? <Edit3 className="w-5 h-5 text-sky-500" /> : <UserPlus className="w-5 h-5 text-sky-500" />}
            <h3 className="font-semibold text-lg">
              {memberToEdit ? 'Rename Member' : 'Add Guest Member'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs">
            {error}
          </div>
        )}

        {forceDeleteWarning ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 p-4 rounded-xl space-y-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs font-semibold">{forceDeleteWarning}</p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => handleDelete(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-semibold"
              >
                Force Delete Member
              </button>
              <button
                type="button"
                onClick={() => setForceDeleteWarning(null)}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ankit"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {memberToEdit && isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(false)}
                  className="flex items-center space-x-1.5 text-red-500 hover:text-red-600 text-xs font-semibold px-2 py-1"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}

              <div className="flex items-center space-x-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || isOffline}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

export default function MemberModal(props) {
  if (!props.isOpen) return null;
  return <MemberFormInner key={props.memberToEdit?.id || 'new_member'} {...props} />;
}
