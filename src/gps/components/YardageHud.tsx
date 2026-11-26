import React from 'react';
import { Crosshair, Flag, X } from 'lucide-react';
import { GreenDistances, LayupMeasurement } from '../types';

interface YardageHudProps {
  greenDistances: GreenDistances;
  layupMeasurement: LayupMeasurement | null;
  onClearTarget: () => void;
}

export const YardageHud: React.FC<YardageHudProps> = ({
  greenDistances,
  layupMeasurement,
  onClearTarget,
}) => {
  return (
    <div className="fixed left-3 top-[calc(max(0.65rem,env(safe-area-inset-top))+62px)] z-20 flex flex-col gap-2 pointer-events-none">
      {/* Primary Front / Center / Back Card */}
      <div className="pointer-events-auto w-[92px] bg-[#143F27]/90 backdrop-blur-md border border-white/20 rounded-2xl px-2.5 py-2.5 shadow-2xl text-center">
        <div className="pb-1.5 border-b border-white/15">
          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-100/75">
            Back
          </div>
          <div className="font-mono text-lg font-bold text-white leading-tight">
            {greenDistances.backYards}
          </div>
        </div>

        <div className="py-1.5 border-b border-white/15">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#D4AF37]">
            {greenDistances.onGreen ? 'On Green' : 'Center'}
          </div>
          <div className="font-mono text-[34px] font-extrabold text-white leading-none tracking-tight mt-0.5">
            {greenDistances.centerYards}
          </div>
        </div>

        <div className="pt-1.5">
          <div className="font-mono text-lg font-bold text-emerald-300 leading-tight">
            {greenDistances.frontYards}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-200/80">
            Front
          </div>
        </div>

        <div className="mt-1.5 pt-1 border-t border-white/10 text-[9px] font-mono font-semibold text-emerald-100/70">
          {greenDistances.depthYards}y deep
        </div>
      </div>

      {/* Layup / Target Readout */}
      {layupMeasurement && (
        <div className="pointer-events-auto w-[92px] bg-[#143F27]/92 backdrop-blur-md border border-[#D4AF37]/60 rounded-2xl px-2 py-2 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#D4AF37]">
              <Crosshair className="w-3 h-3" /> Pin
            </span>
            <button
              type="button"
              onClick={onClearTarget}
              className="p-0.5 rounded-md text-white/60 hover:text-white hover:bg-white/10"
              aria-label="Clear target pin"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1 text-center">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-white/70">
                To Pin
              </div>
              <div className="font-mono text-base font-extrabold text-white leading-tight">
                {layupMeasurement.toTargetYards}y
              </div>
            </div>
            <div className="border-t border-white/10 pt-1">
              <div className="flex items-center justify-center gap-0.5 text-[9px] uppercase tracking-wider text-[#F4E4C1]/80">
                <Flag className="w-2.5 h-2.5 text-[#D4AF37]" /> Left
              </div>
              <div className="font-mono text-base font-extrabold text-[#F4E4C1] leading-tight">
                {layupMeasurement.targetToGreenYards}y
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
