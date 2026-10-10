import React from 'react';
import { NepaliPatroCalendar } from './NepaliPatroCalendar';

interface BsDateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BsDateModal: React.FC<BsDateModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg sm:max-w-xl md:max-w-2xl max-h-[96vh] sm:max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        <NepaliPatroCalendar onClose={onClose} initialTab="patro" />
      </div>
    </div>
  );
};
