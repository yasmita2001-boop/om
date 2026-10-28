import React, { useEffect } from 'react';
import { NepaliPatroCalendar } from './NepaliPatroCalendar';

interface BsDateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BsDateModal: React.FC<BsDateModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sanctuary-bs-date-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/65 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Nepali Patro Calendar"
    >
      <div className="relative w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        <NepaliPatroCalendar onClose={onClose} initialTab="patro" />
      </div>
    </div>
  );
};
