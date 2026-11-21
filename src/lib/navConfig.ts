import {
  LayoutDashboard, CheckSquare, Target, FileText,
  DollarSign, Heart, Folder, Settings,
  BookOpen, Calculator, Repeat, Zap,
  Users, Sparkles, Briefcase,
  type LucideIcon
} from 'lucide-react';
import { NavModule } from '../types';

export interface NavItem {
  id: NavModule;
  label: string;
  Icon: LucideIcon;
  badgeKey?: 'tasks' | 'reminders';
}

/** Top-level modules shown in sidebar / header nav */
export const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'goals',     label: 'Goals',     Icon: Target },
  { id: 'tasks',     label: 'Tasks',     Icon: CheckSquare, badgeKey: 'tasks' },
  { id: 'notes',     label: 'Memo',      Icon: FileText },
  { id: 'finance',   label: 'Finance',   Icon: DollarSign },
  { id: 'health',    label: 'Life',      Icon: Heart },
  { id: 'things',    label: 'Vault',     Icon: Folder },
  { id: 'settings',  label: 'Settings',  Icon: Settings, badgeKey: 'reminders' },
];

/** Child modules accessible from their parent's screen */
export const CHILD_NAV: NavItem[] = [
  { id: 'journal',   label: 'Journal',   Icon: BookOpen },
  { id: 'calculator',label: 'Calculator',Icon: Calculator },
  { id: 'routine',   label: 'Routine',   Icon: Repeat },
  { id: 'focus',     label: 'Focus',     Icon: Zap },
  { id: 'people',    label: 'People',    Icon: Users },
  { id: 'spiritual', label: 'Spiritual', Icon: Sparkles },
  { id: 'work',      label: 'Work',      Icon: Briefcase },
];

/** Maps each child module to its parent in PRIMARY_NAV */
export const CHILD_TO_PARENT: Partial<Record<NavModule, NavModule>> = {
  journal:    'notes',
  calculator: 'notes',
  routine:    'tasks',
  focus:      'tasks',
  people:     'health',
  spiritual:  'health',
  work:       'health',
};

/** Resolve active module to its parent nav item (for active-state highlighting) */
export function resolveSelectedNav(activeModule: NavModule): NavModule {
  return CHILD_TO_PARENT[activeModule] ?? activeModule;
}
