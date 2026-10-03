import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Check, Globe, AlertCircle, Sparkles } from 'lucide-react';
import { parseVoiceTranscript } from '../utils/voiceParser';
import { parseRupeesToPaise } from '../utils/formatters';

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Activities', 'Shopping', 'Other'];

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition ||
    null
  );
}

function ExpenseFormInner({
  onClose,
  onSave,
  members = [],
  currentMemberId,
  initialExpense = null,
  isOffline = false
}) {
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [amountRupees, setAmountRupees] = useState(
    initialExpense?.amount_paise ? String(initialExpense.amount_paise / 100) : ''
  );
  const [category, setCategory] = useState(initialExpense?.category || 'Food');
  const [paidByMemberId, setPaidByMemberId] = useState(
    initialExpense?.paid_by_member_id
      ? Number(initialExpense.paid_by_member_id)
      : (currentMemberId ? Number(currentMemberId) : (members[0]?.id ? Number(members[0].id) : ''))
  );
  const [selectedSplitMemberIds, setSelectedSplitMemberIds] = useState(
    initialExpense?.splits && initialExpense.splits.length > 0
      ? initialExpense.splits.map(s => Number(s.member_id))
      : members.map(m => Number(m.id))
  );
  const [expenseDate, setExpenseDate] = useState(
    initialExpense?.expense_date
      ? initialExpense.expense_date.split('T')[0]
      : new Date().toISOString().split('T')[0]
  );

  // Voice Recognition & Dictation states
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState('en-IN'); // 'en-IN' or 'hi-IN'
  const [transcriptNotice, setTranscriptNotice] = useState('');
  const [voiceInputText, setVoiceInputText] = useState('');
  const [showDictationInput, setShowDictationInput] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const dictationInputRef = useRef(null);

  // Process and apply transcript to fields
  const applyTranscript = (text) => {
    if (!text || !text.trim()) return;
    setTranscriptNotice(`Parsed: "${text}"`);
    const parsed = parseVoiceTranscript(text, members, currentMemberId);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.amountRupees) setAmountRupees(parsed.amountRupees);
    if (parsed.category) setCategory(parsed.category);
    if (parsed.paidByMemberId) setPaidByMemberId(Number(parsed.paidByMemberId));
  };

  const handleStartListening = async () => {
    setError('');
    const SpeechRecognition = getSpeechRecognition();

    if (SpeechRecognition) {
      try {
        if (isListening && recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
          return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setTranscriptNotice('Listening... Speak now (e.g., "Rahul paid 1200 for dinner")');
        };

        recognition.onresult = (event) => {
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscriptNotice(`Listening: "${currentText}"`);
          applyTranscript(currentText);
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error !== 'no-speech') {
            fallbackMicMode();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        console.warn('Speech recognition start failed, using mic fallback:', err);
        fallbackMicMode();
      }
    } else {
      fallbackMicMode();
    }
  };

  const fallbackMicMode = async () => {
    setShowDictationInput(true);
    setIsListening(true);
    setTranscriptNotice('Microphone active. Type or dictate your expense below:');

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch (err) {
      console.warn('MediaDevices getUserMedia notice:', err);
    }

    setTimeout(() => {
      if (dictationInputRef.current) {
        dictationInputRef.current.focus();
      }
    }, 100);
  };

  const stopListeningFallback = () => {
    setIsListening(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleVoiceInputChange = (e) => {
    const val = e.target.value;
    setVoiceInputText(val);
    applyTranscript(val);
  };

  const toggleSplitMember = (id) => {
    const numId = Number(id);
    if (selectedSplitMemberIds.includes(numId)) {
      if (selectedSplitMemberIds.length === 1) return; // Must have at least 1 member selected
      setSelectedSplitMemberIds(selectedSplitMemberIds.filter(mId => mId !== numId));
    } else {
      setSelectedSplitMemberIds([...selectedSplitMemberIds, numId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOffline) {
      setError("Cannot save expenses while offline.");
      return;
    }

    const paise = parseRupeesToPaise(amountRupees);
    if (!description.trim()) {
      setError('Please enter a description.');
      return;
    }
    if (!paise || paise <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!paidByMemberId) {
      setError('Please select who paid for this expense.');
      return;
    }
    if (selectedSplitMemberIds.length === 0) {
      setError('Please select at least one member to split with.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        description: description.trim(),
        amount_paise: paise,
        category,
        expense_date: expenseDate,
        paid_by_member_id: Number(paidByMemberId),
        split_member_ids: selectedSplitMemberIds.map(Number)
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initialExpense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Universal Voice Input Section */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Smart Voice Autofill</span>
              </span>
              <button
                type="button"
                onClick={() => setLang(lang === 'en-IN' ? 'hi-IN' : 'en-IN')}
                className="flex items-center space-x-1 bg-white dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 text-xs text-sky-600 dark:text-sky-400 font-medium"
              >
                <Globe className="w-3 h-3" />
                <span>{lang === 'en-IN' ? 'English (IN)' : 'Hindi (hi-IN)'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={isListening ? stopListeningFallback : handleStartListening}
              disabled={isOffline}
              className={`p-4 rounded-full transition-all shadow-md flex items-center justify-center ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/30'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {isListening ? 'Microphone Active — Speak or Dictate' : 'Tap Mic to speak (e.g. "Rahul paid 1200 for dinner")'}
            </p>

            {/* Quick Sample Voice Command Chips */}
            <div className="w-full pt-1 flex flex-wrap gap-1.5 justify-center">
              <button
                type="button"
                onClick={() => applyTranscript("Rahul paid 1200 for dinner")}
                className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[11px] border border-sky-500/20 transition"
              >
                🎤 "Rahul paid 1200 for dinner"
              </button>
              <button
                type="button"
                onClick={() => applyTranscript("Priya ne 500 ka cab fare kiya")}
                className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[11px] border border-sky-500/20 transition"
              >
                🎤 "Priya ne 500 ka cab fare kiya"
              </button>
            </div>

            {/* Dictation / Text Voice Input Box */}
            {(showDictationInput || isListening) && (
              <div className="w-full pt-2">
                <input
                  ref={dictationInputRef}
                  type="text"
                  placeholder="Speak or type (e.g. Rahul 1200 dinner)..."
                  value={voiceInputText}
                  onChange={handleVoiceInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-sky-500 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            {transcriptNotice && (
              <p className="text-xs italic text-sky-600 dark:text-sky-400">
                {transcriptNotice}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Seafood Dinner at Brittos"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Paid By & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Paid By
              </label>
              <select
                value={paidByMemberId}
                onChange={(e) => setPaidByMemberId(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {Number(m.id) === Number(currentMemberId) ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Split Between (Multi-Select Pills) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Split Equally Between ({selectedSplitMemberIds.length})
              </label>
              <button
                type="button"
                onClick={() => setSelectedSplitMemberIds(members.map(m => Number(m.id)))}
                className="text-xs text-sky-500 hover:text-sky-600 font-medium"
              >
                Select Everyone
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {members.map(m => {
                const isSelected = selectedSplitMemberIds.includes(Number(m.id));
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleSplitMember(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center space-x-1.5 transition ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
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
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition"
            >
              {submitting ? 'Saving...' : (initialExpense ? 'Update Expense' : 'Save Expense')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function VoiceExpenseModal(props) {
  if (!props.isOpen) return null;
  return <ExpenseFormInner key={props.initialExpense?.id || 'new_expense'} {...props} />;
}
