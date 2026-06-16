import type { EmergencySeverity } from './api';

// Kaaley Heedhe severity scale, used wherever an incident's urgency needs to
// be shown — status pills, badges, dashboards. Green = lowest, Black =
// life-threatening. Kept separate from Tailwind classes (inline style /
// hex) since these are chosen dynamically and Tailwind's JIT purge can't
// see dynamically-built class names.
export const SEVERITY_COLORS: Record<EmergencySeverity, { hex: string; bgSoft: string; label: string }> = {
  green: { hex: '#22c55e', bgSoft: 'rgba(34, 197, 94, 0.12)', label: 'Low' },
  yellow: { hex: '#f59e0b', bgSoft: 'rgba(245, 158, 11, 0.14)', label: 'Caution' },
  orange: { hex: '#f97316', bgSoft: 'rgba(249, 115, 22, 0.14)', label: 'Urgent' },
  red: { hex: '#ef4444', bgSoft: 'rgba(239, 68, 68, 0.14)', label: 'Critical' },
  black: { hex: '#111111', bgSoft: 'rgba(17, 17, 17, 0.12)', label: 'Life-Threatening' },
};

export function severityColor(severity?: string | null) {
  return SEVERITY_COLORS[(severity as EmergencySeverity) ?? 'yellow'] ?? SEVERITY_COLORS.yellow;
}
