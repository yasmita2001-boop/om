import { ThemedDateTimeInput } from '../components/ThemedDateTimeInput';
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Heart, Activity, Droplet, Calendar, Trash2, Compass, Briefcase,
  Stethoscope, FileText, Edit3, X, CheckCircle2, Circle, Loader2, Undo2
} from 'lucide-react';
import { ThemeIcon } from '../components/ThemeIcon';
import {
  HealthProfile, HealthMeasurement, SleepRecord, WaterRecord,
  NutritionRecord, HealthAppointment, HealthNote, Goal, Person,
  Interaction, ReminderItem, SpiritualPractice, NavModule,
  LearningItem, Skill, Task
  , MedicationRecord, CycleRecord
} from '../types';
import { storage, generateUUID } from '../lib/storage';
import { getLocalDateString } from '../lib/dateUtils';
import { ConfirmModal } from '../components/ConfirmModal';
import { GoalLinkSelector, GoalBadge } from '../components/GoalLinkSelector';
import { syncGoalProgressFromHealth, syncGoalProgressFromAppointments } from '../lib/goalTaskSync';
import { ProgressiveActions } from '../components/ProgressiveActions';
import { PeopleView } from './PeopleView';
import { SpiritualView } from './SpiritualView';
import { WorkView } from './WorkView';
import { HeaderDropdown } from '../components/HeaderDropdown';
import { CardCloseButton } from '../components/CardCloseButton';
import { ShowMoreBar } from '../components/ShowMoreBar';

interface HealthViewProps {
  initialTab?: HealthTab;
  profile?: HealthProfile;
  measurements: HealthMeasurement[];
  sleepRecords: SleepRecord[];
  waterRecords: WaterRecord[];
  nutritionRecords: NutritionRecord[];
  appointments: HealthAppointment[];
  healthNotes?: HealthNote[];
  goals?: Goal[];
  people: Person[];
  interactions: Interaction[];
  reminders: ReminderItem[];
  practices: SpiritualPractice[];
  learningItems: LearningItem[];
  skills: Skill[];
  tasks: Task[];
  onNavigate: (module: NavModule) => void;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
}

type HealthTab =
  | 'movement'
  | 'wellness'
  | 'appointments'
  | 'profile'
  | 'people'
  | 'foundation-practices'
  | 'work';

export type { HealthTab };

interface DeleteTarget {
  store: 'healthMeasurements' | 'sleepRecords' | 'waterRecords' | 'nutritionRecords' | 'healthAppointments' | 'healthNotes';
  id: string;
  name: string;
}

interface EditTarget {
  store: 'healthMeasurements' | 'sleepRecords' | 'waterRecords' | 'nutritionRecords' | 'healthAppointments' | 'healthNotes';
  item: any;
}

/* ---------- Sparkline mini-chart ---------- */
const Sparkline = ({ data, color, id }: { data: number[]; color: string; id: string }) => {
  if (data.length < 2) return null;
  const w = 120, h = 40, pad = 4;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - 2 * pad),
    y: h - pad - ((v - mn) / rng) * (h - 2 * pad),
  }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${h - pad} ${polyline} ${pts[pts.length - 1].x},${h - pad}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spk-${id})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} />
    </svg>
  );
};

/* ---------- Water progress ring ---------- */
const WaterRing = ({ current, goal }: { current: number; goal: number }) => {
  const pct = Math.min(100, goal > 0 ? Math.round((current / goal) * 100) : 0);
  const r = 22, cx = 26, cy = 26, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="4" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0ea5e9" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500" />
      </svg>
      <div className="min-w-0">
        <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{current} <span className="text-slate-400 font-medium">/ {goal} ml</span></div>
        <div className="text-[11px] text-slate-400 font-medium">{pct}% of daily goal</div>
      </div>
    </div>
  );
};

/* ---------- Date range filter pills ---------- */
type DateRangeKey = 'week' | 'month' | '3months' | 'all';
const dateRangeLabels: Record<DateRangeKey, string> = { week: '7 Days', month: '30 Days', '3months': '90 Days', all: 'All' };
const DateRangePills = ({ value, onChange }: { value: DateRangeKey; onChange: (v: DateRangeKey) => void }) => (
  <div className="flex items-center gap-1">
    {(Object.keys(dateRangeLabels) as DateRangeKey[]).map(k => (
      <button key={k} type="button" onClick={() => onChange(k)}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          value === k ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}>
        {dateRangeLabels[k]}
      </button>
    ))}
  </div>
);

const getDateCutoff = (range: DateRangeKey): string | null => {
  if (range === 'all') return null;
  const d = new Date();
  if (range === 'week') d.setDate(d.getDate() - 7);
  else if (range === 'month') d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return getLocalDateString(d);
};

export const HealthView: React.FC<HealthViewProps> = ({
  initialTab,
  profile,
  measurements,
  sleepRecords,
  waterRecords,
  nutritionRecords,
  appointments,
  healthNotes = [],
  goals = [],
  people,
  interactions,
  reminders,
  practices,
  learningItems,
  skills,
  tasks,
  onNavigate,
  onRefresh,
  onSuccess,
  onError
}) => {
  const reportError = onError || ((msg: string) => console.error('[HealthView]', msg));
  const today = getLocalDateString();
  const [activeTab, setActiveTab] = useState<HealthTab>(initialTab ?? 'movement');
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [movementFormOpen, setMovementFormOpen] = useState(true);
  const [wellnessFormOpen, setWellnessFormOpen] = useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = useState<'appointment' | 'observation' | 'both' | null>(null);
  const [profileFormOpen, setProfileFormOpen] = useState(false);

  // Goal linking state for appointments
  const [apptInputMode, setApptInputMode] = useState<'manual' | 'link'>('manual');
  const [apptGoalId, setApptGoalId] = useState<string>('');

  const [hNoteInputMode, setHNoteInputMode] = useState<'manual' | 'link'>('manual');
  const [hNoteGoalId, setHNoteGoalId] = useState<string>('');

  const [editGoalId, setEditGoalId] = useState<string>('');

  // Profile form
  const [name, setName] = useState(profile?.name || '');
  const [dob, setDob] = useState(profile?.dob || '');
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex === 'female' ? 'female' : 'male');
  const [height, setHeight] = useState<number | ''>(profile?.height && profile.height > 0 ? profile.height : '');
  const [weight, setWeight] = useState<number | ''>(profile?.weight && profile.weight > 0 ? profile.weight : '');
  const [targetWeight, setTargetWeight] = useState<number | ''>(profile?.targetWeight && profile.targetWeight > 0 ? profile.targetWeight : '');

  // Blood group for profile
  const [bloodGroup, setBloodGroup] = useState(profile?.bloodGroup || '');

  // Water goal for profile
  const [waterGoal, setWaterGoal] = useState<number | ''>(profile?.waterGoal && profile.waterGoal > 0 ? profile.waterGoal : '');

  // Loading state
  const [loading, setLoading] = useState(true);

  // Show-more counts
  const [visibleWellnessCount, setVisibleWellnessCount] = useState(20);
  const [visibleMovementCount, setVisibleMovementCount] = useState(20);

  // Date range filters
  const [movementDateRange, setMovementDateRange] = useState<DateRangeKey>('all');
  const [wellnessDateRange, setWellnessDateRange] = useState<DateRangeKey>('all');

  // Undo stack
  const [undoStack, setUndoStack] = useState<Array<{ item: any; storeName: string; label: string; timer: ReturnType<typeof setTimeout> }>>([]);

  // Daily log forms
  const [weightLog, setWeightLog] = useState('');
  const [stepsLog, setStepsLog] = useState('');
  const [exerciseLog, setExerciseLog] = useState('');
  const [exerciseCategory, setExerciseCategory] = useState('Other');
  const [durationLog, setDurationLog] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRateLog, setHeartRateLog] = useState('');

  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [sleepBedtime, setSleepBedtime] = useState('');
  const [sleepWakeTime, setSleepWakeTime] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinGrams, setProteinGrams] = useState('');
  const [carbsGrams, setCarbsGrams] = useState('');
  const [fatGrams, setFatGrams] = useState('');
  const [nutritionNote, setNutritionNote] = useState('');
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [medicationSchedule, setMedicationSchedule] = useState('');
  const [cycleRecords, setCycleRecords] = useState<CycleRecord[]>([]);
  const [cycleDate, setCycleDate] = useState(today);
  const [cycleFlow, setCycleFlow] = useState<CycleRecord['flow']>('medium');
  const [cycleSymptoms, setCycleSymptoms] = useState('');
  useEffect(() => {
    let active = true;
    void storage.getAll<MedicationRecord>('medications').then(items => { if (active) setMedications(items); }).catch(error => console.warn('Could not load medication records', error));
    void storage.getAll<CycleRecord>('cycleRecords').then(items => { if (active) setCycleRecords(items.sort((a, b) => b.date.localeCompare(a.date))); }).catch(error => console.warn('Could not load cycle records', error));
    return () => { active = false; };
  }, []);

  const saveMedication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!medicationName.trim()) return;
    const now = Date.now();
    const item: MedicationRecord = { id: generateUUID(), name: medicationName.trim(), dose: medicationDose.trim() || undefined, schedule: medicationSchedule.trim() || undefined, startDate: today, createdAt: now, updatedAt: now };
    try {
      await storage.put('medications', item);
      setMedications(current => [item, ...current]);
      setMedicationName(''); setMedicationDose(''); setMedicationSchedule('');
      onSuccess('Medication saved');
    } catch (e) { console.error('[om] Save failed', e); onSuccess('⚠ Could not save medication. Try again.'); }
  };

  const saveCycleRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    const item: CycleRecord = { id: generateUUID(), date: cycleDate, flow: cycleFlow, symptoms: cycleSymptoms.trim() || undefined, createdAt: Date.now() };
    try {
      await storage.put('cycleRecords', item);
      setCycleRecords(current => [item, ...current].sort((a, b) => b.date.localeCompare(a.date)));
      setCycleSymptoms('');
      onSuccess('Cycle entry saved');
    } catch (e) { console.error('[om] Save failed', e); onSuccess('⚠ Could not save cycle entry. Try again.'); }
  };

  // Appointment & note form
  const [apptTitle, setApptTitle] = useState('');
  const [apptDoctor, setApptDoctor] = useState('');
  const [apptDate, setApptDate] = useState(today);
  const [hNoteText, setHNoteText] = useState('');

  // Edit & Delete modal states
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const editDialogTitleId = useId();

  // Mark loading false once data arrives or after a short timeout
  useEffect(() => {
    if (measurements.length > 0 || sleepRecords.length > 0 || waterRecords.length > 0 || nutritionRecords.length > 0 || appointments.length > 0 || !loading) {
      setLoading(false);
    }
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [measurements, sleepRecords, waterRecords, nutritionRecords, appointments]);

  // Cleanup undo timers on unmount
  useEffect(() => {
    return () => { undoStack.forEach(entry => clearTimeout(entry.timer)); };
  }, []);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editDate, setEditDate] = useState(today);
  const [editVal1, setEditVal1] = useState('');
  const [editVal2, setEditVal2] = useState('');
  const [editNote, setEditNote] = useState('');

  const hasSavedHeight = typeof profile?.height === 'number' && profile.height > 0;
  const hasSavedWeight = typeof profile?.weight === 'number' && profile.weight > 0;
  const hasSavedTargetWeight = typeof profile?.targetWeight === 'number' && profile.targetWeight > 0;
  const hasBiometricProfile = Boolean(
    profile?.name?.trim() || profile?.dob || hasSavedHeight || hasSavedWeight || hasSavedTargetWeight
  );
  const birthDate = profile?.dob ? new Date(`${profile.dob}T00:00:00`) : null;
  const todayDate = new Date();
  const age = birthDate && !Number.isNaN(birthDate.getTime())
    ? todayDate.getFullYear() - birthDate.getFullYear() -
      (todayDate.getMonth() < birthDate.getMonth() ||
      (todayDate.getMonth() === birthDate.getMonth() && todayDate.getDate() < birthDate.getDate()) ? 1 : 0)
    : null;
  const heightValue = typeof height === 'number' ? height : 0;
  const weightValue = typeof weight === 'number' ? weight : 0;
  const hasSavedBmi = hasSavedHeight && hasSavedWeight;
  const bmi = hasSavedBmi
    ? (heightValue > 0 ? (weightValue / ((heightValue / 100) ** 2)).toFixed(1) : 'N/A')
    : 'Not set';
  const bmr = hasSavedBmi && age !== null && age >= 0
    ? Math.round(10 * weightValue + 6.25 * heightValue - 5 * age + (sex === 'female' ? -161 : 5))
    : null;

  // Focus trap for edit modal
  useEffect(() => {
    if (!editTarget) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editDialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setEditTarget(null); return; }
      if (event.key === 'Tab') {
        const focusable = editDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus(); };
  }, [editTarget]);

  const handleUndoDelete = (index: number) => {
    const entry = undoStack[index];
    if (!entry) return;
    clearTimeout(entry.timer);
    storage.put(entry.storeName as any, entry.item).then(() => {
      setUndoStack(prev => prev.filter((_, i) => i !== index));
      onSuccess(`Restored "${entry.label}"`);
      onRefresh();
    });
  };

  const handleOpenEdit = (store: EditTarget['store'], item: any) => {
    setEditTarget({ store, item });
    setEditDate(item.date || today);
    if (store === 'healthAppointments' || store === 'healthNotes') {
      setEditGoalId(item.goalId || '');
    }

    if (store === 'healthMeasurements') {
      setEditTitle(item.exercise || 'Workout');
      setEditVal1(item.steps ? String(item.steps) : '');
      setEditVal2(item.duration ? String(item.duration) : '');
      setEditSubtitle(item.weight ? String(item.weight) : '');
    } else if (store === 'sleepRecords') {
      setEditVal1(String(item.hours || ''));
    } else if (store === 'waterRecords') {
      setEditVal1(String(item.amount || ''));
    } else if (store === 'nutritionRecords') {
      setEditVal1(item.calories ? String(item.calories) : '');
      setEditNote(item.note || '');
    } else if (store === 'healthAppointments') {
      setEditTitle(item.title || '');
      setEditSubtitle(item.doctor || '');
    } else if (store === 'healthNotes') {
      setEditNote(item.text || '');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const { store, item } = editTarget;
    const now = Date.now();
    try {
      if (store === 'healthMeasurements') {
        const updated: HealthMeasurement = {
          ...item,
          date: editDate || today,
          exercise: editTitle.trim() || undefined,
          steps: editVal1 ? Number(editVal1) : undefined,
          duration: editVal2 ? Number(editVal2) : undefined,
          weight: editSubtitle ? Number(editSubtitle) : undefined,
          updatedAt: now
        };
        await storage.put('healthMeasurements', updated);
        onSuccess('✓ Measurement record updated');
      } else if (store === 'sleepRecords') {
        const updated: SleepRecord = {
          ...item,
          date: editDate || today,
          hours: Number(editVal1) || 0,
          updatedAt: now
        };
        await storage.put('sleepRecords', updated);
        onSuccess('✓ Sleep log updated');
      } else if (store === 'waterRecords') {
        const updated: WaterRecord = {
          ...item,
          date: editDate || today,
          amount: Number(editVal1) || 0,
          updatedAt: now
        };
        await storage.put('waterRecords', updated);
        onSuccess('✓ Hydration log updated');
      } else if (store === 'nutritionRecords') {
        const updated: NutritionRecord = {
          ...item,
          date: editDate || today,
          calories: editVal1 ? Number(editVal1) : undefined,
          note: editNote.trim() || undefined,
          updatedAt: now
        };
        await storage.put('nutritionRecords', updated);
        onSuccess('✓ Nutrition log updated');
      } else if (store === 'healthAppointments') {
        const updated: HealthAppointment = {
          ...item,
          title: editTitle.trim(),
          doctor: editSubtitle.trim() || undefined,
          date: editDate || today,
          goalId: editGoalId || null,
          updatedAt: now
        };
        await storage.put('healthAppointments', updated);
        onSuccess('✓ Appointment updated');
      } else if (store === 'healthNotes') {
        const updated: HealthNote = {
          ...item,
          date: editDate || today,
          text: editNote.trim(),
          goalId: editGoalId || null,
          updatedAt: now
        };
        await storage.put('healthNotes', updated);
        onSuccess('✓ Health note updated');
      }

      if (store === 'healthAppointments' || store === 'healthNotes') {
        const targetGoalId = editGoalId || null;
        if (targetGoalId) {
          await syncGoalProgressFromHealth(targetGoalId);
        }
        if (item.goalId && item.goalId !== targetGoalId) {
          await syncGoalProgressFromHealth(item.goalId);
        }
      }

      setEditTarget(null);
      onRefresh();
    } catch (e) { console.error('[om] Save failed', e); onSuccess('⚠ Could not save. Please try again.'); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const itemToDelete: any = await storage.get(deleteTarget.store, deleteTarget.id);
      const linkedGoalId = itemToDelete?.goalId;
      await storage.delete(deleteTarget.store, deleteTarget.id);
      if (linkedGoalId && deleteTarget.store === 'healthNotes') {
        await syncGoalProgressFromHealth(linkedGoalId);
      } else if (linkedGoalId && deleteTarget.store === 'healthAppointments') {
        await syncGoalProgressFromAppointments(linkedGoalId);
      }
      // Push to undo stack
      if (itemToDelete) {
        const timer = setTimeout(() => {
          setUndoStack(prev => prev.filter(e => e.item?.id !== deleteTarget.id));
        }, 8000);
        setUndoStack(prev => [...prev, { item: itemToDelete, storeName: deleteTarget.store, label: deleteTarget.name, timer }]);
      }
      onSuccess(`✓ ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      console.error('Delete error', err);
      onSuccess('⚠ Could not delete. Please try again.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !hasBiometricProfile &&
      !name.trim() &&
      !dob &&
      height === '' &&
      weight === '' &&
      targetWeight === ''
    ) return;
    const updated: HealthProfile = {
      name,
      dob,
      sex,
      height: height === '' ? undefined : height,
      weight: weight === '' ? undefined : weight,
      targetWeight: targetWeight === '' ? undefined : targetWeight,
      bloodGroup: bloodGroup || undefined,
      waterGoal: waterGoal === '' ? undefined : waterGoal,
      goalId: profile?.goalId || null,
      updatedAt: Date.now()
    };
    try {
      await storage.setSingleton('healthProfile', updated);
      onSuccess('✓ Health profile updated');
      onRefresh();
    } catch (e) { console.error('[om] Save failed', e); onSuccess('⚠ Could not save profile. Try again.'); }
  };

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightLog && !stepsLog && !exerciseLog.trim() && !durationLog && !bpSystolic && !heartRateLog) return;
    const validations = [
      { value: weightLog, label: 'Weight', max: 500 },
      { value: stepsLog, label: 'Steps', max: 100000 },
      { value: durationLog, label: 'Duration', max: 1440 },
      { value: bpSystolic, label: 'Systolic BP', max: 300 },
      { value: bpDiastolic, label: 'Diastolic BP', max: 200 },
      { value: heartRateLog, label: 'Heart Rate', max: 300 }
    ];
    const invalidMeasurement = validations.find(({ value, max }) => value !== ''
      && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max));
    if (invalidMeasurement) {
      reportError(`${invalidMeasurement.label} must be between 0 and ${invalidMeasurement.max}.`);
      return;
    }
    const now = Date.now();
    const m: HealthMeasurement = {
      id: generateUUID(),
      date: today,
      weight: weightLog ? Number(weightLog) : undefined,
      steps: stepsLog ? Number(stepsLog) : undefined,
      exercise: exerciseLog.trim() || undefined,
      exerciseCategory: exerciseLog.trim() ? exerciseCategory : undefined,
      duration: durationLog ? Number(durationLog) : undefined,
      bloodPressureSystolic: bpSystolic ? Number(bpSystolic) : undefined,
      bloodPressureDiastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
      heartRate: heartRateLog ? Number(heartRateLog) : undefined,
      createdAt: now
    };
    try {
      await storage.put('healthMeasurements', m);
      if (weightLog) {
        setWeight(Number(weightLog));
        const p = await storage.getSingleton<HealthProfile>('healthProfile') || {};
        p.weight = Number(weightLog);
        await storage.setSingleton('healthProfile', p);
      }
      onSuccess(weightLog ? '✓ Measurement recorded (profile weight updated)' : '✓ Physical measurement recorded');
      setWeightLog('');
      setStepsLog('');
      setExerciseLog('');
      setExerciseCategory('Other');
      setDurationLog('');
      setBpSystolic('');
      setBpDiastolic('');
      setHeartRateLog('');
      onRefresh();
    } catch (e) { console.error('[om] Save failed', e); onSuccess('⚠ Could not save measurement. Try again.'); }
  };

  const handleAddWellness = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const wellnessValues = [
      { value: sleepHours, label: 'Sleep hours', max: 24 },
      { value: waterMl, label: 'Water', max: 10000 },
      { value: calories, label: 'Calories', max: 50000 }
    ];
    const invalidWellness = wellnessValues.find(({ value, max }) => value !== ''
      && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > max));
    if (invalidWellness) {
      reportError(`${invalidWellness.label} must be between 0 and ${invalidWellness.max}.`);
      return;
    }

    try {
    if (sleepHours) {
      const s: SleepRecord = {
        id: generateUUID(),
        date: today,
        hours: Number(sleepHours),
        quality: sleepQuality || undefined,
        bedtime: sleepBedtime || undefined,
        wakeTime: sleepWakeTime || undefined,
        createdAt: now
      };
      await storage.put('sleepRecords', s);
    }

    if (waterMl) {
      const w: WaterRecord = {
        id: generateUUID(),
        date: today,
        amount: Number(waterMl),
        createdAt: now
      };
      await storage.put('waterRecords', w);
    }

    if (calories || nutritionNote || proteinGrams || carbsGrams || fatGrams) {
      const n: NutritionRecord = {
        id: generateUUID(),
        date: today,
        calories: calories ? Number(calories) : undefined,
        proteinGrams: proteinGrams ? Number(proteinGrams) : undefined,
        carbsGrams: carbsGrams ? Number(carbsGrams) : undefined,
        fatGrams: fatGrams ? Number(fatGrams) : undefined,
        note: nutritionNote.trim() || undefined,
        createdAt: now
      };
      await storage.put('nutritionRecords', n);
    }
    } catch (e) {
      console.error('[om] handleAddWellness failed', e);
      onSuccess('⚠ Could not save wellness data. Please try again.');
      return;
    }

    onSuccess('✓ Wellness telemetry saved');
    setSleepHours('');
    setSleepQuality('');
    setSleepBedtime('');
    setSleepWakeTime('');
    setWaterMl('');
    setCalories('');
    setProteinGrams('');
    setCarbsGrams('');
    setFatGrams('');
    setNutritionNote('');
    onRefresh();
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptTitle.trim()) return;

    const appt: HealthAppointment = {
      id: generateUUID(),
      title: apptTitle.trim(),
      doctor: apptDoctor.trim() || undefined,
      date: apptDate,
      status: 'scheduled',
      completed: false,
      goalId: apptGoalId || undefined,
      createdAt: Date.now()
    };
    try {
      await storage.put('healthAppointments', appt);
      if (appt.goalId) {
        await syncGoalProgressFromAppointments(appt.goalId, appt.id, false, 'scheduled');
      }
    } catch (e) {
      console.error('[om] handleAddAppointment failed', e);
      onSuccess('⚠ Could not save appointment. Please try again.');
      return;
    }
    onSuccess('✓ Doctor appointment scheduled');
    setApptTitle('');
    setApptDoctor('');
    setApptGoalId('');
    setApptInputMode('manual');
    onRefresh();
  };

  const handleToggleAppointmentComplete = async (appt: HealthAppointment) => {
    const isComp = Boolean(appt.completed || appt.status === 'completed');
    const nextCompleted = !isComp;
    const nextStatus: 'scheduled' | 'completed' = nextCompleted ? 'completed' : 'scheduled';
    const updated: HealthAppointment = {
      ...appt,
      completed: nextCompleted,
      status: nextStatus,
      updatedAt: Date.now()
    };
    await storage.put('healthAppointments', updated);
    if (appt.goalId) {
      await syncGoalProgressFromAppointments(appt.goalId, appt.id, nextCompleted, nextStatus);
    }
    onSuccess(nextCompleted ? `✓ Attended checkup: "${appt.title}"` : `Checkup marked scheduled: "${appt.title}"`);
    onRefresh();
  };

  const handleAddHealthNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hNoteText.trim()) return;

    const hn: HealthNote = {
      id: generateUUID(),
      date: today,
      text: hNoteText.trim(),
      goalId: hNoteGoalId || undefined,
      createdAt: Date.now()
    };
    await storage.put('healthNotes', hn);
    if (hn.goalId) {
      await syncGoalProgressFromHealth(hn.goalId);
    }
    onSuccess('✓ Health observation saved');
    setHNoteText('');
    setHNoteGoalId('');
    setHNoteInputMode('manual');
    onRefresh();
  };

  const wellnessEntries = [
    ...sleepRecords.map(s => ({ type: 'Sleep', text: `${s.hours} hours`, date: s.date, id: s.id, store: 'sleepRecords' as const, raw: s })),
    ...waterRecords.map(w => ({ type: 'Water', text: `${w.amount} ml`, date: w.date, id: w.id, store: 'waterRecords' as const, raw: w })),
    ...nutritionRecords.map(n => ({ type: 'Nutrition', text: `${n.calories ? `${n.calories} kcal` : ''} ${n.note || ''}`, date: n.date, id: n.id, store: 'nutritionRecords' as const, raw: n }))
  ]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || ((b.raw as any)?.createdAt || 0) - ((a.raw as any)?.createdAt || 0));

  const biometricFieldCount = profile
    ? [
        profile.name,
        profile.dob,
        profile.height,
        profile.weight,
        profile.targetWeight,
        profile.bloodGroup,
      ].filter((value) => value !== undefined && value !== null && String(value).trim() !== '').length
    : 0;

  const healthTabOptions: { id: HealthTab; label: string; count: number; icon: typeof Heart }[] = [
    { id: 'movement', label: 'Workouts', count: measurements.length, icon: Activity },
    { id: 'wellness', label: 'Sleep & Fuel', count: sleepRecords.length + waterRecords.length + nutritionRecords.length, icon: Droplet },
    { id: 'appointments', label: 'Appointments', count: appointments.length + healthNotes.length, icon: Stethoscope },
    { id: 'profile', label: 'Biometrics', count: biometricFieldCount, icon: Heart },
    { id: 'people', label: 'People', count: people.length, icon: Heart },
    { id: 'foundation-practices', label: 'Daily Practices', count: practices.length, icon: Compass },
    { id: 'work', label: 'Work', count: learningItems.length + skills.length, icon: Briefcase }
  ];
  const selectedTab = healthTabOptions.find(tab => tab.id === activeTab);
  const selectedTabLabel = selectedTab?.label || 'Life';
  const isHealthTab = ['movement', 'wellness', 'appointments', 'profile'].includes(activeTab);
  const SelectedTabIcon = activeTab === 'movement'
    ? Activity
    : activeTab === 'wellness'
      ? Droplet
      : activeTab === 'appointments'
        ? Stethoscope
        : activeTab === 'people'
          ? Heart
          : activeTab === 'foundation-practices'
            ? Compass
          : activeTab === 'work'
            ? Briefcase
            : Heart;

  // --- Filtered & sorted lists ---
  const movementCutoff = getDateCutoff(movementDateRange);
  const sortedMeasurements = [...measurements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  const filteredMeasurements = movementCutoff ? sortedMeasurements.filter(m => m.date >= movementCutoff) : sortedMeasurements;

  const wellnessCutoff = getDateCutoff(wellnessDateRange);
  const filteredWellnessEntries = wellnessCutoff ? wellnessEntries.filter(e => e.date >= wellnessCutoff) : wellnessEntries;

  // --- Today's water progress ---
  const todayWaterTotal = waterRecords.filter(w => w.date === today).reduce((sum, w) => sum + (w.amount || 0), 0);
  const effectiveWaterGoal = (typeof waterGoal === 'number' && waterGoal > 0) ? waterGoal : (profile?.waterGoal && profile.waterGoal > 0 ? profile.waterGoal : 2000);

  // --- Sparkline trend data (chronological, last 30) ---
  const weightTrend = sortedMeasurements.filter(m => m.weight).slice(0, 30).reverse().map(m => m.weight!);
  const stepsTrend = sortedMeasurements.filter(m => m.steps).slice(0, 30).reverse().map(m => m.steps!);
  const bpTrend = sortedMeasurements.filter(m => m.bloodPressureSystolic).slice(0, 30).reverse().map(m => m.bloodPressureSystolic!);
  const sleepTrend = [...sleepRecords].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(-30).map(s => s.hours);
  const waterTrendByDay: Record<string, number> = {};
  waterRecords.forEach(w => { waterTrendByDay[w.date] = (waterTrendByDay[w.date] || 0) + w.amount; });
  const waterTrend = Object.entries(waterTrendByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([, v]) => v);

  const exportHealthData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      measurements,
      sleepRecords,
      waterRecords,
      nutritionRecords,
      appointments,
      healthNotes
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `om-lifeos-health-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="life-view space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
            <span>Life</span>
          </h1>
          <div className="flex items-center gap-2">
          <button type="button" onClick={exportHealthData} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" title="Export health records">
            <FileText className="h-4 w-4" /> Export
          </button>
          <HeaderDropdown
            label={selectedTabLabel}
            menuLabel="Life submenu"
            icon={<SelectedTabIcon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
          >
            {closeMenu => healthTabOptions.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'movement') setMovementFormOpen(true);
                  if (tab.id === 'wellness') setWellnessFormOpen(true);
                  if (tab.id === 'appointments') setAppointmentFormOpen('both');
                  if (tab.id === 'profile') setProfileFormOpen(true);
                  closeMenu();
                }}
                className={`flex w-full min-w-0 items-center gap-2 border-b-2 px-2 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 ${
                  activeTab === tab.id ? 'border-amber-300' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}</span>
              </button>
            ))}
          </HeaderDropdown>
          </div>
        </div>
      </div>

      {isHealthTab && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><div className="text-[10px] font-semibold uppercase text-slate-400">Steps</div><div className="mt-1 font-mono text-sm font-bold text-slate-800 dark:text-white">{measurements.filter(m => m.date === today).reduce((n, m) => n + (m.steps || 0), 0).toLocaleString()}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><div className="text-[10px] font-semibold uppercase text-slate-400">Water</div><div className="mt-1 font-mono text-sm font-bold text-sky-600">{waterRecords.filter(w => w.date === today).reduce((n, w) => n + w.amount, 0).toLocaleString()} ml</div></div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><div className="text-[10px] font-semibold uppercase text-slate-400">Sleep</div><div className="mt-1 font-mono text-sm font-bold text-purple-600">{sleepRecords.filter(s => s.date === today).reduce((n, s) => n + s.hours, 0)} h</div></div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><div className="text-[10px] font-semibold uppercase text-slate-400">Calories</div><div className="mt-1 font-mono text-sm font-bold text-amber-600">{nutritionRecords.filter(n => n.date === today).reduce((n, r) => n + (r.calories || 0), 0)} kcal</div></div>
      </div>}

      {isHealthTab && (hasSavedWeight || hasSavedBmi) && (() => {
        const latestBp = [...measurements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).find(m => m.bloodPressureSystolic);
        const latestHr = [...measurements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).find(m => m.heartRate);
        return (
      <div className="metric-summary-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {hasSavedWeight && <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Current Weight</span>
            <Heart className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {hasSavedWeight ? `${weightValue} kg` : 'Not set'}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {hasSavedTargetWeight ? `Goal: ${targetWeight} kg` : 'Set a target in Biometrics'}
          </div>
        </div>}

        {hasSavedBmi && <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Body Mass Index</span>
            <Activity className="h-4 w-4 shrink-0 text-indigo-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {bmi}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {`Ht ${heightValue} cm${bmr !== null ? ` · BMR est. ${bmr}` : ''}`}
          </div>
        </div>}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Blood Pressure</span>
            <Stethoscope className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {latestBp ? `${latestBp.bloodPressureSystolic}/${latestBp.bloodPressureDiastolic}` : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {latestBp ? `mmHg · ${latestBp.date}` : 'Log a measurement to track'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card dark:border-white/[0.08] dark:bg-slate-900 min-w-0">
          <div className="flex items-center justify-between gap-1 text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">Heart Rate</span>
            <Heart className="h-4 w-4 shrink-0 text-pink-500" />
          </div>
          <div className="mt-2.5 sm:mt-3 font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
            {latestHr ? `${latestHr.heartRate}` : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-medium truncate">
            {latestHr ? `bpm · ${latestHr.date}` : 'Log a measurement to track'}
          </div>
        </div>

      </div>
        );
      })()}

      {/* Tab: Physical Movement */}
      {activeTab === 'movement' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {movementFormOpen && <div className={`${
            measurements.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
          } rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <Activity className="h-4 w-4" />
                </span>
                <span>Log Workout / Steps</span>
              </h2>
              <CardCloseButton label="workout form" onClick={() => setMovementFormOpen(false)} />
            </div>
            <form onSubmit={handleAddMeasurement} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="500"
                    value={weightLog}
                    onChange={e => setWeightLog(e.target.value)}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Daily Steps</label>
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={stepsLog}
                    onChange={e => setStepsLog(e.target.value)}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Exercise</label>
                  <input
                    type="text"
                    value={exerciseLog}
                    onChange={e => setExerciseLog(e.target.value)}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Type</label>
                  <select value={exerciseCategory} onChange={e => setExerciseCategory(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {['Walking', 'Running', 'Cycling', 'Strength', 'Yoga', 'Sports', 'Other'].map(category => <option key={category}>{category}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Duration (Min)</label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={durationLog}
                    onChange={e => setDurationLog(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">BP Systolic</label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    placeholder="120"
                    value={bpSystolic}
                    onChange={e => setBpSystolic(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">BP Diastolic</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    placeholder="80"
                    value={bpDiastolic}
                    onChange={e => setBpDiastolic(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Pulse (bpm)</label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    placeholder="72"
                    value={heartRateLog}
                    onChange={e => setHeartRateLog(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <button type="submit" disabled={!weightLog && !stepsLog && !exerciseLog.trim() && !durationLog && !bpSystolic && !heartRateLog} className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                Log Physical Activity
              </button>
            </form>
          </div>}

          {(measurements.length > 0 || !movementFormOpen) && <div className={`${movementFormOpen ? 'lg:col-span-7' : 'lg:col-span-12'} ${
            measurements.length > 0
              ? 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900'
              : 'flex min-h-20 items-center justify-start py-3'
          }`}>
            {measurements.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Movement history
                  </h2>
                  <DateRangePills value={movementDateRange} onChange={v => { setMovementDateRange(v); setVisibleMovementCount(20); }} />
                </div>

                {/* Sparklines */}
                {(weightTrend.length >= 2 || stepsTrend.length >= 2 || bpTrend.length >= 2) && (
                  <div className="mt-3 mb-1 flex flex-wrap items-center gap-5">
                    {weightTrend.length >= 2 && (
                      <div className="flex items-center gap-2">
                        <Sparkline data={weightTrend} color="#6366f1" id="mv-wt" />
                        <span className="text-[10px] font-semibold text-slate-400">Weight</span>
                      </div>
                    )}
                    {stepsTrend.length >= 2 && (
                      <div className="flex items-center gap-2">
                        <Sparkline data={stepsTrend} color="#10b981" id="mv-st" />
                        <span className="text-[10px] font-semibold text-slate-400">Steps</span>
                      </div>
                    )}
                    {bpTrend.length >= 2 && (
                      <div className="flex items-center gap-2">
                        <Sparkline data={bpTrend} color="#f43f5e" id="mv-bp" />
                        <span className="text-[10px] font-semibold text-slate-400">BP systolic</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 space-y-2">
                  {filteredMeasurements.slice(0, visibleMovementCount).map(m => (
                  <div key={m.id} className="dashboard-item-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-900 dark:text-white">{m.exercise || 'Daily Activity'}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{m.date}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {m.steps && <span>{m.steps.toLocaleString()} steps</span>}
                      {m.weight && <span>{m.weight} kg</span>}
                      {m.duration && <span className="text-indigo-600 dark:text-indigo-400">{m.duration} min</span>}
                      {m.bloodPressureSystolic && <span className="text-rose-600 dark:text-rose-400">{m.bloodPressureSystolic}/{m.bloodPressureDiastolic} mmHg</span>}
                      {m.heartRate && <span className="text-pink-600 dark:text-pink-400">{m.heartRate} bpm</span>}
                    </div>
                    <ProgressiveActions label={`More actions for ${m.exercise || 'Activity record'}`} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit('healthMeasurements', m)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                        title="Edit Measurement"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: 'healthMeasurements', id: m.id, name: m.exercise || 'Activity record' })}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/50"
                        title="Delete Record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </ProgressiveActions>
                  </div>
                  ))}
                </div>
                {filteredMeasurements.length > visibleMovementCount && (
                  <ShowMoreBar
                    remaining={filteredMeasurements.length - visibleMovementCount}
                    step={20}
                    onReveal={() => setVisibleMovementCount(c => c + 20)}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 text-left">
                <span className="om-empty-state-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">No activity yet</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Log a workout or steps to start your history.</p>
                </div>
              </div>
            )}
          </div>}
        </div>
      )}

      {/* Tab: Wellness */}
      {activeTab === 'wellness' && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {wellnessFormOpen && <div className={`${
            wellnessEntries.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'
          } rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300">
                  <Droplet className="h-4 w-4" />
                </span>
                <span>Log Sleep, Water & Nutrition</span>
              </h2>
              <CardCloseButton label="wellness form" onClick={() => setWellnessFormOpen(false)} />
            </div>
            <form onSubmit={handleAddWellness} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Sleep (hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    value={sleepHours}
                    onChange={e => setSleepHours(e.target.value)}

                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Water (ml)</label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={waterMl}
                    onChange={e => setWaterMl(e.target.value)}

                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Calories (kcal)</label>
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    value={calories}
                    onChange={e => setCalories(e.target.value)}

                    className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              {sleepHours && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Sleep Quality</label>
                    <select value={sleepQuality} onChange={e => setSleepQuality(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      <option value="">—</option><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Fair">Fair</option><option value="Poor">Poor</option>
                    </select>
                  </div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Bedtime</label><ThemedDateTimeInput type="time" value={sleepBedtime} onChange={e => setSleepBedtime(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
                  <div><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Wake time</label><ThemedDateTimeInput type="time" value={sleepWakeTime} onChange={e => setSleepWakeTime(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[['Protein (g)', proteinGrams, setProteinGrams], ['Carbs (g)', carbsGrams, setCarbsGrams], ['Fat (g)', fatGrams, setFatGrams]].map(([label, value, setter]) => (
                  <label key={label as string} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label as string}<input type="number" min="0" max="1000" value={value as string} onChange={e => (setter as (value: string) => void)(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Nutrition Memo</label>
                <input
                  type="text"
                  value={nutritionNote}
                  onChange={e => setNutritionNote(e.target.value)}

                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Quick Water Tap Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const w: WaterRecord = {
                      id: generateUUID(),
                      date: today,
                      amount: 250,
                      createdAt: Date.now()
                    };
                    await storage.put('waterRecords', w);
                    onSuccess('+250ml Water logged');
                    onRefresh();
                  }}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/60"
                >
                  <><ThemeIcon name="water" className="h-4 w-4" /> +250ml Glass</>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const w: WaterRecord = {
                      id: generateUUID(),
                      date: today,
                      amount: 500,
                      createdAt: Date.now()
                    };
                    await storage.put('waterRecords', w);
                    onSuccess('+500ml Bottle logged');
                    onRefresh();
                  }}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/60"
                >
                  <><ThemeIcon name="bottle" className="h-4 w-4" /> +500ml Bottle</>
                </button>
              </div>

              <button
                type="submit"
                disabled={!sleepHours && !sleepBedtime && !sleepWakeTime && !waterMl && !calories && !proteinGrams && !carbsGrams && !fatGrams && !nutritionNote.trim()}
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Wellness Record
              </button>
            </form>
          </div>}

          {(wellnessEntries.length > 0 || !wellnessFormOpen) && (
            <div className={`${wellnessFormOpen ? 'lg:col-span-7' : 'lg:col-span-12'} ${
              wellnessEntries.length > 0
                ? 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900'
                : 'flex min-h-20 items-center justify-start py-3'
            }`}>
              {wellnessEntries.length > 0 ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Wellness history</h2>
                    <DateRangePills value={wellnessDateRange} onChange={v => { setWellnessDateRange(v); setVisibleWellnessCount(20); }} />
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-sky-50/70 p-3 dark:bg-sky-950/20">
                    <WaterRing current={todayWaterTotal} goal={effectiveWaterGoal} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Water today</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{todayWaterTotal.toLocaleString()} / {effectiveWaterGoal.toLocaleString()} ml</p>
                    </div>
                  </div>
                  {(sleepTrend.length >= 2 || waterTrend.length >= 2) && (
                    <div className="mb-4 flex flex-wrap items-center gap-5">
                      {sleepTrend.length >= 2 && <div className="flex items-center gap-2"><Sparkline data={sleepTrend} color="#8b5cf6" id="well-sleep" /><span className="text-[10px] font-semibold text-slate-400">Sleep</span></div>}
                      {waterTrend.length >= 2 && <div className="flex items-center gap-2"><Sparkline data={waterTrend} color="#0ea5e9" id="well-water" /><span className="text-[10px] font-semibold text-slate-400">Water</span></div>}
                    </div>
                  )}
                  <div className="mt-4 space-y-2">
                    {filteredWellnessEntries.slice(0, visibleWellnessCount).map(item => (
                  <div key={item.id} className="dashboard-item-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                      <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        item.type === 'Sleep' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400' :
                        item.type === 'Water' ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.text}</span>
                      <span className="font-mono text-xs text-slate-400">{item.date}</span>
                    </div>

                    {/* EDIT & DELETE BUTTONS */}
                    <ProgressiveActions label={`More actions for ${item.text}`} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item.store, item.raw)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ store: item.store, id: item.id, name: `${item.type} log` })}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </ProgressiveActions>
                  </div>
                  ))}
                  </div>
                  {filteredWellnessEntries.length > visibleWellnessCount && (
                    <ShowMoreBar remaining={filteredWellnessEntries.length - visibleWellnessCount} step={20} onReveal={() => setVisibleWellnessCount(c => c + 20)} />
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 text-left">
                  <span className="om-empty-state-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Heart className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">No wellness records yet</p>
                    <p className="mt-0.5 text-xs text-ink-muted">Log sleep, water or nutrition to build your history.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Appointments & Health Notes */}
      {activeTab === 'appointments' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Medication log</h2>
            <form onSubmit={saveMedication} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input required value={medicationName} onChange={e => setMedicationName(e.target.value)} placeholder="Medication" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <input value={medicationDose} onChange={e => setMedicationDose(e.target.value)} placeholder="Dose" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <input value={medicationSchedule} onChange={e => setMedicationSchedule(e.target.value)} placeholder="Schedule" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <button type="submit" className="h-10 rounded-lg px-3 text-sm font-semibold">Add medication</button>
            </form>
            {medications.length > 0 && <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{medications.map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-semibold text-slate-800 dark:text-slate-200">{item.name} <span className="font-normal text-slate-500">{item.dose} {item.schedule}</span></span><button type="button" aria-label={`Delete ${item.name}`} onClick={async () => { try { await storage.delete('medications', item.id); setMedications(items => items.filter(record => record.id !== item.id)); } catch (e) { console.error('[om] delete medication failed', e); } }} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cycle tracking</h2>
              <form onSubmit={saveCycleRecord} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <ThemedDateTimeInput type="date" value={cycleDate} onChange={e => setCycleDate(e.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <select value={cycleFlow} onChange={e => setCycleFlow(e.target.value as CycleRecord['flow'])} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="light">Light flow</option><option value="medium">Medium flow</option><option value="heavy">Heavy flow</option></select>
                <input value={cycleSymptoms} onChange={e => setCycleSymptoms(e.target.value)} placeholder="Symptoms or note" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <button type="submit" className="h-10 rounded-lg px-3 text-sm font-semibold">Log cycle</button>
              </form>
              {cycleRecords.length > 0 && <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{cycleRecords.slice(0, 8).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-700 dark:text-slate-200">{item.date} · {item.flow || 'flow'} {item.symptoms && <span className="text-slate-500">· {item.symptoms}</span>}</span><button type="button" aria-label="Delete cycle entry" onClick={async () => { try { await storage.delete('cycleRecords', item.id); setCycleRecords(items => items.filter(record => record.id !== item.id)); } catch (e) { console.error('[om] delete cycleRecord failed', e); } }} className="text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
            </div>
          </section>
          {appointmentFormOpen && <div className={`grid grid-cols-1 items-start gap-4 ${
            appointmentFormOpen === 'both' ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
          }`}>
            {(appointmentFormOpen === 'appointment' || appointmentFormOpen === 'both') && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Medical appointment</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Schedule a consultation or checkup.</p>
                  </div>
                  </div>
                  <CardCloseButton
                    label="appointment form"
                    onClick={() => setAppointmentFormOpen(current => current === 'both' ? 'observation' : null)}
                  />
                </div>
                <form onSubmit={handleAddAppointment} className="mt-4 space-y-3">
                <GoalLinkSelector
                  goals={goals}
                  mode={apptInputMode}
                  goalId={apptGoalId}
                  onModeChange={setApptInputMode}
                  onGoalChange={setApptGoalId}
                />
                <input
                  type="text"
                  required
                  value={apptTitle}
                  onChange={e => setApptTitle(e.target.value)}

                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={apptDoctor}
                    onChange={e => setApptDoctor(e.target.value)}

                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <ThemedDateTimeInput
                    type="date"
                    value={apptDate}
                    onChange={e => setApptDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button type="submit" className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
                  + Add Appointment
                </button>
              </form>
              </section>
            )}
            {(appointmentFormOpen === 'observation' || appointmentFormOpen === 'both') && (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Health observation</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Keep symptoms and recovery notes.</p>
                  </div>
                  </div>
                  <CardCloseButton
                    label="health observation form"
                    onClick={() => setAppointmentFormOpen(current => current === 'both' ? 'appointment' : null)}
                  />
                </div>
                <form onSubmit={handleAddHealthNote} className="mt-4 space-y-3">
                  <GoalLinkSelector
                    goals={goals}
                    mode={hNoteInputMode}
                    goalId={hNoteGoalId}
                    onModeChange={setHNoteInputMode}
                    onGoalChange={setHNoteGoalId}
                  />
                  <textarea
                    rows={3}
                    required
                    value={hNoteText}
                    onChange={e => setHNoteText(e.target.value)}

                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button type="submit" className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-700">
                    Save Health Note
                  </button>
                </form>
              </section>
            )}
          </div>}

          <div className="space-y-4">
            {/* Appointments List */}
            <div className={appointments.length > 0 ? 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900' : 'py-1'}>
              {appointments.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Scheduled Consultations
                </h2>
              </div>}
              <div className={appointments.length > 0 ? 'mt-4 space-y-2' : 'flex items-center gap-3 py-2 text-left'}>
                {appointments.length === 0 ? (
                  appointmentFormOpen === 'appointment' || appointmentFormOpen === 'both' ? null : (
                    <>
                      <span className="om-empty-state-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Stethoscope className="h-4 w-4" /></span>
                      <div>
                        <p className="text-sm font-semibold text-ink">No appointments scheduled</p>
                        <p className="mt-0.5 text-xs text-ink-muted">Add a visit to keep its date and details here.</p>
                      </div>
                    </>
                  )
                ) : (
                  [...appointments].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(a => (
                    <div key={a.id} className="dashboard-item-row flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <button
                        type="button"
                        onClick={() => handleToggleAppointmentComplete(a)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                        title={a.completed || a.status === 'completed' ? 'Mark as Scheduled / Upcoming' : 'Mark as Attended / Completed'}
                      >
                        {a.completed || a.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-slate-900 dark:text-white truncate ${a.completed || a.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                            {a.title}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            a.completed || a.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : a.date > today
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                          }`}>
                            {a.completed || a.status === 'completed' ? '✓ Attended' : a.date > today ? 'Upcoming' : 'Scheduled'}
                          </span>
                          <GoalBadge goalId={a.goalId} goals={goals} />
                        </div>
                        <div className="min-w-0 break-words text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>{a.date}</span>
                          {a.doctor && <span>· Dr: {a.doctor}</span>}
                        </div>
                      </div>
                      <ProgressiveActions label="More actions for observation note" className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('healthAppointments', a)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Appointment"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'healthAppointments', id: a.id, name: a.title })}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Delete Appointment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ProgressiveActions>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Health Notes List */}
            <div className={healthNotes.length > 0 ? 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-slate-900' : 'py-1'}>
              {healthNotes.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Health Observations & Records
                </h2>
              </div>}
              <div className={healthNotes.length > 0 ? 'mt-4 space-y-2' : 'flex items-center gap-3 py-2 text-left'}>
                {healthNotes.length === 0 ? (
                  appointmentFormOpen === 'observation' || appointmentFormOpen === 'both' ? null : (
                    <>
                      <span className="om-empty-state-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><FileText className="h-4 w-4" /></span>
                      <div>
                        <p className="text-sm font-semibold text-ink">No health observations</p>
                        <p className="mt-0.5 text-xs text-ink-muted">Save symptoms or recovery notes to build a history.</p>
                      </div>
                    </>
                  )
                ) : (
                  [...healthNotes].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0)).map(n => (
                    <div key={n.id} className="dashboard-item-row flex justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm transition-all hover:border-slate-200 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-800 dark:text-slate-200 leading-relaxed">{n.text}</div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-400">{n.date}</span>
                          <GoalBadge goalId={n.goalId} goals={goals} />
                        </div>
                      </div>
                      <ProgressiveActions label={`More actions for ${n.text}`} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit('healthNotes', n)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Note"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ store: 'healthNotes', id: n.id, name: 'Observation note' })}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </ProgressiveActions>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Biometric Profile */}
      {activeTab === 'profile' && (
        profileFormOpen ? (
          <div className="max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Biometric Profile</h2>
              <CardCloseButton label="biometric profile form" onClick={() => setProfileFormOpen(false)} />
            </div>
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Date of Birth</label>
                  <ThemedDateTimeInput
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Sex (for BMR)</label>
                  <select
                    value={sex}
                    onChange={e => setSex(e.target.value === 'female' ? 'female' : 'male')}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">— Select —</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Height (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Target (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value === '' ? '' : Number(e.target.value))}

                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Daily water target (ml)</label>
                  <input
                    type="number"
                    min="250"
                    max="10000"
                    step="250"
                    value={waterGoal}
                    onChange={e => setWaterGoal(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="2000"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!hasBiometricProfile && !name.trim() && !dob && height === '' && weight === '' && targetWeight === '' && waterGoal === ''}
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Biometric Profile
              </button>
            </form>
          </div>
        ) : hasBiometricProfile ? (
          <section className="max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Biometric Profile</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile?.name?.trim() && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.name}</p>
              </div>}
              {profile?.dob && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Date of birth</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.dob}</p>
              </div>}
              {profile?.sex && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sex</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.sex === 'female' ? 'Female' : 'Male'}</p>
              </div>}
              {hasSavedHeight && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Height</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.height} cm</p>
              </div>}
              {hasSavedWeight && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current weight</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.weight} kg</p>
              </div>}
              {hasSavedTargetWeight && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Target weight</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.targetWeight} kg</p>
              </div>}
              {profile?.bloodGroup && <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Blood group</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.bloodGroup}</p>
              </div>}
            </div>
          </section>
        ) : (
          <div className="flex max-w-3xl items-center gap-3 py-3 text-left">
            <span className="om-empty-state-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Set up your biometric profile</p>
              <p className="mt-0.5 text-xs text-ink-muted">Add measurements to see weight and BMI summaries here.</p>
            </div>
          </div>
        )
      )}

      {activeTab === 'people' && (
        <PeopleView
          key={activeTab}
          people={people}
          interactions={interactions}
          goals={goals}
          reminders={reminders}
          embedded
          initialForm="person"
          onRefresh={onRefresh}
          onSuccess={onSuccess}
        />
      )}

      {activeTab === 'foundation-practices' && (
        <SpiritualView
          key={activeTab}
          practices={practices}
          goals={goals}
          embedded
          initialForm="practices"
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          onSuccess={onSuccess}
        />
      )}

      {activeTab === 'work' && (
        <WorkView
          key={activeTab}
          learningItems={learningItems}
          skills={skills}

          goals={goals}
          tasks={tasks}
          embedded
          showTabsWhenEmbedded
          initialTab="learning"
          onRefresh={onRefresh}
          onSuccess={onSuccess}
        />
      )}

      {/* DEDICATED EDIT MODAL */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            ref={editDialogRef}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby={editDialogTitleId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 id={editDialogTitleId} className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Health Record
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Date</label>
                <ThemedDateTimeInput
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              {(editTarget.store === 'healthAppointments' || editTarget.store === 'healthNotes') && (
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-2.5 dark:border-indigo-800/80 dark:bg-indigo-950/30">
                  <label className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 mb-1">
                    <span>Linked Goal Alignment:</span>
                  </label>
                  <select
                    value={editGoalId}
                    onChange={e => setEditGoalId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-indigo-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-white cursor-pointer font-medium"
                  >
                    <option value="">None (Standalone)</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.level === 5 ? '◆' : g.level === 4 ? '◇' : g.level === 3 ? '●' : g.level === 2 ? '○' : '★'} {g.title} ({g.progress}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editTarget.store === 'healthMeasurements' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Exercise / Activity</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}

                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Steps</label>
                      <input
                        type="number"
                        value={editVal1}
                        onChange={e => setEditVal1(e.target.value)}

                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Duration (m)</label>
                      <input
                        type="number"
                        value={editVal2}
                        onChange={e => setEditVal2(e.target.value)}

                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editSubtitle}
                        onChange={e => setEditSubtitle(e.target.value)}

                        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {editTarget.store === 'sleepRecords' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Sleep Duration (Hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editVal1}
                    onChange={e => setEditVal1(e.target.value)}

                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              {editTarget.store === 'waterRecords' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Water Volume (ml)</label>
                  <input
                    type="number"
                    value={editVal1}
                    onChange={e => setEditVal1(e.target.value)}

                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              {editTarget.store === 'nutritionRecords' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Calories (kcal)</label>
                    <input
                      type="number"
                      value={editVal1}
                      onChange={e => setEditVal1(e.target.value)}

                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Nutrition Memo</label>
                    <input
                      type="text"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}

                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {editTarget.store === 'healthAppointments' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Appointment / Reason</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Doctor / Clinic</label>
                    <input
                      type="text"
                      value={editSubtitle}
                      onChange={e => setEditSubtitle(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {editTarget.store === 'healthNotes' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Health Observation</label>
                  <textarea
                    rows={3}
                    required
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Health Record?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"?`
            : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Undo Delete Toast Stack */}
      {undoStack.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
          {undoStack.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Deleted "{entry.label}"
              </span>
              <button
                type="button"
                onClick={() => handleUndoDelete(idx)}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/70 cursor-pointer"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
