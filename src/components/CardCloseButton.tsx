import { X } from 'lucide-react';

export function CardCloseButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Close ${label}`}
      title={`Hide ${label}`}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
