import {
  AlarmClock,
  Bell,
  BookOpen,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Circle,
  CreditCard,
  Droplets,
  FileText,
  FlaskConical,
  GitBranch,
  Hand,
  Link2,
  ListChecks,
  Mic,
  Music,
  NotebookPen,
  Paperclip,
  PartyPopper,
  PiggyBank,
  Repeat2,
  Save,
  ShieldAlert,
  Smile,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Wallet,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const icons = {
  alarm: AlarmClock,
  alert: TriangleAlert,
  attachment: Paperclip,
  bell: Bell,
  book: BookOpen,
  bottle: FlaskConical,
  branch: GitBranch,
  calendar: CalendarDays,
  calm: Smile,
  calculator: Calculator,
  celebrate: PartyPopper,
  check: CheckCircle2,
  circle: Circle,
  focus: Brain,
  hand: Hand,
  journal: NotebookPen,
  link: Link2,
  loan: CreditCard,
  mainGoal: Target,
  mic: Mic,
  microGoal: Circle,
  music: Music,
  nanoGoal: Circle,
  note: FileText,
  portfolio: TrendingUp,
  presets: ListChecks,
  prayer: Sparkles,
  save: Save,
  savings: PiggyBank,
  subGoal: GitBranch,
  target: Target,
  urgent: ShieldAlert,
  user: UserRound,
  water: Droplets,
  wallet: Wallet,
  star: Star,
  repeat: Repeat2,
  zap: Zap
} satisfies Record<string, LucideIcon>;

export type ThemeIconName = keyof typeof icons;

interface ThemeIconProps {
  name: ThemeIconName;
  className?: string;
}

export function ThemeIcon({ name, className = 'h-4 w-4' }: ThemeIconProps) {
  const Icon = icons[name];
  return <Icon className={`shrink-0 ${className}`} style={{ color: 'var(--color-brand)' }} aria-hidden="true" />;
}

export function GoalTierIcon({ level, className = 'h-3.5 w-3.5' }: { level?: number; className?: string }) {
  const name: ThemeIconName = level === 5
    ? 'zap'
    : level === 4
      ? 'nanoGoal'
      : level === 3
        ? 'microGoal'
        : level === 2
          ? 'subGoal'
          : 'mainGoal';
  return <ThemeIcon name={name} className={className} />;
}
