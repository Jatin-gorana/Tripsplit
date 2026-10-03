import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { useOffline } from '../hooks/useOffline';
import { formatRupees, formatDate } from '../utils/formatters';

import BottomNav from '../components/BottomNav';
import VoiceExpenseModal from '../components/VoiceExpenseModal';
import MemberModal from '../components/MemberModal';
import TripModal from '../components/TripModal';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';

import {
  ArrowLeft, Copy, Share2, Plus, Settings, Users, Receipt, LayoutDashboard,
  ArrowRightLeft, AlertCircle, Trash2, Edit3, Shield, User, Wallet, Check, RefreshCw, Sparkles
} from 'lucide-react';

const CATEGORY_COLORS = {
  Food: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  Travel: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  Stay: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  Activities: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Shopping: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  Other: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
};

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isOffline = useOffline();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resplitting, setResplitting] = useState(false);

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState(null);

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);

  const isAnyModalOpen = isExpenseModalOpen || isMemberModalOpen || isTripModalOpen;

  // Fetch Dashboard & Data callback
  const fetchData = useCallback(async () => {
    try {
      const [dash, exps, setts] = await Promise.all([
        apiRequest(`/trips/${id}/dashboard`),
        apiRequest(`/trips/${id}/expenses`),
        apiRequest(`/trips/${id}/settle`)
      ]);

      setDashboardData(dash);
      setExpenses(exps);
      setTransfers(setts.transfers || []);
    } catch (err) {
      console.error('Failed to load trip details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 5-second polling hook (pauses when tab hidden or modal open)
  usePolling(fetchData, 5000, isAnyModalOpen);

  const handleCopyInvite = () => {
    if (!dashboardData?.trip?.invite_code) return;
    const inviteUrl = `${window.location.origin}/join/${dashboardData.trip.invite_code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setToast({ type: 'success', message: 'Invite link copied to clipboard!' });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResplitAll = async () => {
    if (isOffline) return;
    setResplitting(true);
    try {
      await apiRequest(`/trips/${id}/resplit`, { method: 'POST' });
      setToast({ type: 'success', message: 'All trip expenses re-balanced across current members!' });
      fetchData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Re-balance failed.' });
    } finally {
      setResplitting(false);
    }
  };

  // Expense Handlers
  const handleSaveExpense = async (expensePayload) => {
    if (expenseToEdit) {
      await apiRequest(`/trips/${id}/expenses/${expenseToEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify(expensePayload)
      });
      setToast({ type: 'success', message: 'Expense updated!' });
    } else {
      await apiRequest(`/trips/${id}/expenses`, {
        method: 'POST',
        body: JSON.stringify(expensePayload)
      });
      setToast({ type: 'success', message: 'Expense added!' });
    }
    fetchData();
  };

  const handleDeleteExpense = async (expenseId) => {
    if (isOffline) return;
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await apiRequest(`/trips/${id}/expenses/${expenseId}`, { method: 'DELETE' });
      setToast({ type: 'success', message: 'Expense deleted.' });
      fetchData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Delete failed.' });
    }
  };

  // Member Handlers
  const handleAddGuestMember = async (name) => {
    await apiRequest(`/trips/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    setToast({ type: 'success', message: `Added guest "${name}" and re-balanced expenses!` });
    fetchData();
  };

  const handleRenameMember = async (memberId, name) => {
    await apiRequest(`/trips/${id}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
    setToast({ type: 'success', message: 'Member renamed!' });
    fetchData();
  };

  const handleDeleteMember = async (memberId, force = false) => {
    await apiRequest(`/trips/${id}/members/${memberId}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    });
    setToast({ type: 'success', message: 'Member removed and expenses re-balanced.' });
    fetchData();
  };

  // Trip Edit / Delete
  const handleUpdateTrip = async (tripData) => {
    await apiRequest(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tripData)
    });
    setToast({ type: 'success', message: 'Trip updated!' });
    fetchData();
  };

  const handleDeleteTrip = async (tripIdToDelete) => {
    const targetId = tripIdToDelete || id;
    try {
      await apiRequest(`/trips/${targetId}`, { method: 'DELETE' });
      setToast({ type: 'success', message: 'Trip deleted.' });
      navigate('/trips');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Delete trip failed.' });
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4 pt-12">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen max-w-md mx-auto p-4 pt-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-sm font-medium">Failed to load trip details.</p>
        <button onClick={() => navigate('/trips')} className="px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl">
          Back to Trips
        </button>
      </div>
    );
  }

  const { trip, is_admin, current_member, total_spent_paise, budget_paise, budget_remaining_paise, next_to_pay, member_stats, category_totals } = dashboardData;
  const members = member_stats || [];

  // Budget progress percentage
  const budgetPercent = budget_paise ? Math.min(100, Math.round((total_spent_paise / budget_paise) * 100)) : 0;

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/trips')}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-base leading-tight">{trip.name}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{trip.destination}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Invite Pill */}
            <button
              onClick={handleCopyInvite}
              className="flex items-center space-x-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-xl text-xs font-semibold font-mono"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{trip.invite_code}</span>
            </button>

            {is_admin && (
              <button
                onClick={() => setIsTripModalOpen(true)}
                className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Trip Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-lg mx-auto p-4 space-y-6">

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            
            {/* Total Spent & Budget Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-xl space-y-4 border border-slate-700/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Trip Expense
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {members.length} Members
                </span>
              </div>

              <div className="text-3xl font-extrabold tracking-tight text-white">
                {formatRupees(total_spent_paise)}
              </div>

              {/* Budget Progress Bar */}
              {budget_paise && (
                <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Budget ({formatRupees(budget_paise)})</span>
                    <span>{formatRupees(budget_remaining_paise)} remaining</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Highlighted Card: Next to Pay */}
            {next_to_pay && (
              <div className="bg-sky-500/10 dark:bg-sky-950/40 border border-sky-500/30 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-sky-500 text-white font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                      Next to Pay
                    </div>
                    <div className="text-base font-bold">
                      {next_to_pay.name}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  {formatRupees(next_to_pay.balance_paise)}
                </div>
              </div>
            )}

            {/* Ranked Member Balances */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  Member Balances & Shares
                </h3>
                <button
                  onClick={handleResplitAll}
                  disabled={resplitting || isOffline}
                  className="flex items-center space-x-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  title="Re-balance all expenses across current members"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resplitting ? 'animate-spin' : ''}`} />
                  <span>Re-balance All</span>
                </button>
              </div>

              <div className="space-y-3">
                {members.map(m => {
                  const isOwed = m.balance_paise > 0;
                  const isEqualed = m.balance_paise === 0;
                  const maxVal = Math.max(...members.map(mb => Math.max(mb.paid_paise, mb.share_paise)), 1);
                  const paidPct = Math.min(100, Math.round((m.paid_paise / maxVal) * 100));
                  const sharePct = Math.min(100, Math.round((m.share_paise / maxVal) * 100));

                  return (
                    <div key={m.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm flex items-center space-x-1.5">
                          <span>{m.name}</span>
                          {m.id === current_member?.id && (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">You</span>
                          )}
                        </div>

                        <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          isOwed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : isEqualed
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                        }`}>
                          {isOwed ? `+${formatRupees(m.balance_paise)}` : formatRupees(m.balance_paise)}
                        </div>
                      </div>

                      {/* Paid vs Share details */}
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Paid: <strong className="text-slate-700 dark:text-slate-200">{formatRupees(m.paid_paise)}</strong></span>
                        <span>Fair Share: <strong className="text-slate-700 dark:text-slate-200">{formatRupees(m.share_paise)}</strong></span>
                      </div>

                      {/* Plain CSS Bars */}
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${paidPct}%` }} title={`Paid: ${formatRupees(m.paid_paise)}`} />
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 dark:bg-slate-600 rounded-full" style={{ width: `${sharePct}%` }} title={`Share: ${formatRupees(m.share_paise)}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Breakdown */}
            {category_totals && Object.keys(category_totals).length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  Spending by Category
                </h3>

                <div className="space-y-2.5">
                  {Object.entries(category_totals).map(([cat, total]) => {
                    const pct = total_spent_paise > 0 ? Math.round((total / total_spent_paise) * 100) : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other}`}>
                              {cat}
                            </span>
                            <span>{pct}%</span>
                          </span>
                          <span className="font-semibold">{formatRupees(total)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Expense History ({expenses.length})</h2>
              <button
                onClick={() => {
                  setExpenseToEdit(null);
                  setIsExpenseModalOpen(true);
                }}
                disabled={isOffline}
                className="flex items-center space-x-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No expenses added yet. Tap "+" or the button above to log your first trip expense.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map(exp => {
                  const canEditOrDelete = is_admin || Number(exp.created_by_user_id) === Number(current_member?.user_id);
                  return (
                    <div
                      key={exp.id}
                      className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other}`}>
                              {exp.category}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(exp.expense_date)}</span>
                          </div>
                          <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-snug">
                            {exp.description}
                          </h4>
                        </div>

                        <div className="text-right">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {formatRupees(exp.amount_paise)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Paid by <strong className="text-slate-700 dark:text-slate-300">{exp.paid_by_name}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Splits & Actions */}
                      <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/60 pt-2 text-slate-500 dark:text-slate-400">
                        <span>Split among {exp.splits ? exp.splits.length : 0} members</span>

                        {canEditOrDelete && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setExpenseToEdit(exp);
                                setIsExpenseModalOpen(true);
                              }}
                              disabled={isOffline}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Edit Expense"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              disabled={isOffline}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Trip Members ({members.length})</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleResplitAll}
                  disabled={resplitting || isOffline}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
                  title="Re-balance all trip expenses"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resplitting ? 'animate-spin' : ''}`} />
                  <span>Re-balance</span>
                </button>
                {is_admin && (
                  <button
                    onClick={() => {
                      setMemberToEdit(null);
                      setIsMemberModalOpen(true);
                    }}
                    disabled={isOffline}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Guest</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {members.map(m => {
                const isUser = !!m.user_id;
                const isTripAdmin = m.user_id && Number(m.user_id) === Number(trip.admin_user_id);
                const isSelf = m.user_id && Number(m.user_id) === Number(current_member?.user_id);
                const canManageMember = is_admin || isSelf;

                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-sky-500">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center space-x-1.5">
                          <span>{m.name}</span>
                          {isTripAdmin && (
                            <Shield className="w-3.5 h-3.5 text-amber-500" title="Trip Admin" />
                          )}
                          {isSelf && (
                            <span className="text-[10px] bg-sky-500/10 text-sky-500 px-1.5 py-0.5 rounded font-semibold">You</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {isUser ? (m.email || 'Linked Account') : 'Guest Member'}
                        </p>
                      </div>
                    </div>

                    {canManageMember && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setMemberToEdit(m);
                            setIsMemberModalOpen(true);
                          }}
                          disabled={isOffline}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title="Edit Member Name"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {is_admin && !isTripAdmin && (
                          <button
                            onClick={() => {
                              setMemberToEdit(m);
                              setIsMemberModalOpen(true);
                            }}
                            disabled={isOffline}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: SETTLE UP */}
        {activeTab === 'settle' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-bold text-base">Optimal Settlement Plan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Minimum cash flow transfers calculated greedily to settle all member debts.
              </p>
            </div>

            {transfers.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-6 rounded-2xl text-center space-y-2">
                <Check className="w-8 h-8 mx-auto" />
                <h3 className="font-bold text-sm">Everyone is all settled up!</h3>
                <p className="text-xs">No pending transfers needed for this trip.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((t, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        <div className="font-semibold text-sm">
                          <strong className="text-slate-800 dark:text-slate-100">{t.from_name}</strong> pays <strong className="text-slate-800 dark:text-slate-100">{t.to_name}</strong>
                        </div>
                        <span className="text-slate-400">Direct transfer</span>
                      </div>
                    </div>

                    <div className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                      {formatRupees(t.amount_paise)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Floating Action Button for Adding Expense */}
      <button
        onClick={() => {
          setExpenseToEdit(null);
          setIsExpenseModalOpen(true);
        }}
        disabled={isOffline}
        className="fixed bottom-20 right-4 z-40 p-4 rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white shadow-2xl transition-transform active:scale-95 flex items-center justify-center sm:right-auto sm:left-1/2 sm:translate-x-32"
        title="Add Expense"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* Bottom Navigation Bar */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Modals */}
      <VoiceExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseToEdit(null);
        }}
        onSave={handleSaveExpense}
        members={members}
        currentMemberId={current_member?.id}
        initialExpense={expenseToEdit}
        isOffline={isOffline}
      />

      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setMemberToEdit(null);
        }}
        onAddGuest={handleAddGuestMember}
        onRenameMember={handleRenameMember}
        onDeleteMember={handleDeleteMember}
        memberToEdit={memberToEdit}
        isAdmin={is_admin}
        isOffline={isOffline}
      />

      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => setIsTripModalOpen(false)}
        onSave={handleUpdateTrip}
        onDelete={handleDeleteTrip}
        initialTrip={trip}
        isOffline={isOffline}
      />

    </div>
  );
}
