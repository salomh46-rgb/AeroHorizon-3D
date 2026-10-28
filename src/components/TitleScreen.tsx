import React, { useEffect } from 'react';
import {
  DifficultyMode,
  HudTheme,
  ModalTab,
  PilotProfile,
} from '../types/game';
import { soundEngine } from '../audio/soundEngine';

interface TitleScreenProps {
  profile: PilotProfile;
  hudTheme: HudTheme;
  onlineCount: number;
  onStartFlight: () => void;
  onOpenModal: (tab: ModalTab) => void;
  onChangeDifficulty: (diff: DifficultyMode) => void;
  onToggleHudTheme: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  profile,
  hudTheme,
  onlineCount,
  onStartFlight,
  onOpenModal,
  onChangeDifficulty,
  onToggleHudTheme,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        soundEngine.init();
        soundEngine.playUiClick();
        onStartFlight();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStartFlight]);

  const isDark = hudTheme === 'dark';
  const panelSurface = isDark
    ? 'bg-slate-950/90 border-slate-800 text-slate-100'
    : 'bg-white/95 border-slate-300 text-slate-900';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Top Bar: Pilot Identity & Quick Utility Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-lg ${panelSurface}`}
        >
          <span className="text-xl" aria-hidden="true">
            {profile.emblem}
          </span>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>{profile.callsign}</span>
              <span aria-hidden="true" className={mutedText}>
                ·
              </span>
              <span className="font-mono tabular-nums text-amber-500">
                УР. {profile.level}
              </span>
              <span aria-hidden="true" className={mutedText}>
                ·
              </span>
              <span className="font-mono tabular-nums text-sky-400">
                {profile.rating} ELO
              </span>
            </div>
            <div className={`text-xs ${mutedText} flex items-center gap-1.5`}>
              <span>Код синхр.: {profile.syncCode}</span>
              <span aria-hidden="true">·</span>
              <span>Пилотов в небе: {onlineCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('profile');
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${panelSurface} hover:border-amber-500`}
          >
            Профиль и Ливрея
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('leaderboard');
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${panelSurface} hover:border-amber-500`}
          >
            Рейтинг лидеров
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('quests');
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${panelSurface} hover:border-amber-500`}
          >
            Задания и Награды
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('cloud');
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${panelSurface} hover:border-amber-500`}
          >
            Облако
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleHudTheme();
            }}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${panelSurface} hover:border-amber-500`}
            title="Переключить тему интерфейса"
          >
            {isDark ? 'Светлая тема HUD' : 'Тёмная тема HUD'}
          </button>
        </div>
      </div>

      {/* Center Negative Space + Bespoke Inline SVG Title Lockup */}
      <div className="my-auto flex flex-col items-center text-center max-w-2xl mx-auto pointer-events-auto">
        <div
          className={`px-8 py-8 rounded-2xl border shadow-2xl ${panelSurface}`}
        >
          {/* Bespoke Inline SVG Vector Lockup */}
          <svg
            viewBox="0 0 460 96"
            className="w-full max-w-md mx-auto mb-3"
            role="img"
            aria-label="AeroHorizon 3D"
          >
            <defs>
              <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            {/* Geometric Low-Poly Horizon Mountains & Wing Crest */}
            <polygon
              points="155,34 195,8 230,28 265,8 305,34 230,20"
              fill="url(#wingGrad)"
              opacity="0.9"
            />
            <polygon
              points="90,38 175,26 230,38 285,26 370,38 230,31"
              fill="#38bdf8"
              opacity="0.65"
            />
            <line
              x1="40"
              y1="44"
              x2="420"
              y2="44"
              stroke="url(#wingGrad)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x="230"
              y="76"
              textAnchor="middle"
              fill="currentColor"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="700"
              fontSize="36"
              letterSpacing="5"
            >
              AEROHORIZON
            </text>
          </svg>

          <p className={`text-sm md:text-base max-w-lg mx-auto mb-6 ${mutedText}`}>
            Низкополигональный 3D-полёт над процедурными каньонами и хребтами.
            Управляйте тягой, проходите навигационные кольца и летайте с друзьями в реальном времени.
          </p>

          {/* Difficulty Selector */}
          <div className="flex items-center justify-center gap-1.5 p-1 rounded-lg bg-slate-900/60 border border-slate-800 max-w-sm mx-auto mb-6">
            {(
              [
                { id: 'arcade', label: 'Аркада' },
                { id: 'normal', label: 'Стандарт' },
                { id: 'simulation', label: 'Симуляция' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onChangeDifficulty(item.id);
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  profile.difficulty === item.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Primary Start CTA */}
          <button
            type="button"
            onClick={() => {
              soundEngine.init();
              soundEngine.playUiClick();
              onStartFlight();
            }}
            className="px-8 py-3.5 text-base font-bold font-display tracking-wide bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
          >
            Начать полёт (Enter / Space)
          </button>
        </div>
      </div>

      {/* Bottom Single Flat Control-Hint Line */}
      <div className="flex justify-center pointer-events-auto">
        <div
          className={`px-5 py-2.5 rounded-xl border text-xs font-mono ${panelSurface}`}
        >
          <span>WASD / Стрелки Пилотирование (Тангаж и Крен)</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>Shift / E / Q Тяга и Форсаж</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>Space Стабилизация</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>C Камера</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>G Погода</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>V Каркас</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>N День/Ночь</span>
          <span aria-hidden="true" className="mx-2 opacity-50">
            ·
          </span>
          <span>Esc Пауза</span>
        </div>
      </div>
    </div>
  );
};
