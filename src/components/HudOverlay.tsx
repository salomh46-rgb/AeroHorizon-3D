import React, { useEffect, useState } from 'react';
import {
  CameraMode,
  ChatMessage,
  DifficultyMode,
  FlightTelemetry,
  GameInvite,
  HudTheme,
  ModalTab,
  PilotProfile,
  RemotePilot,
  WeatherMode,
  xpRequiredForLevel,
} from '../types/game';
import { TutorialProgressFlags } from './FlightCanvas';
import { soundEngine } from '../audio/soundEngine';

interface HudOverlayProps {
  profile: PilotProfile;
  telemetry: FlightTelemetry;
  cameraMode: CameraMode;
  weather: WeatherMode;
  wireframe: boolean;
  isNight: boolean;
  isMuted: boolean;
  hudTheme: HudTheme;
  tutorialFlags: TutorialProgressFlags;
  showTutorial: boolean;
  remotePilots: RemotePilot[];
  chatMessages: ChatMessage[];
  pendingInvite: GameInvite | null;
  toastBanner: { title: string; subtitle: string } | null;
  onToggleCamera: () => void;
  onToggleCinematic: () => void;
  onToggleWeather: () => void;
  onToggleWireframe: () => void;
  onToggleNight: () => void;
  onToggleMute: () => void;
  onToggleHudTheme: () => void;
  onChangeDifficulty: (d: DifficultyMode) => void;
  onDismissTutorial: () => void;
  onOpenModal: (tab: ModalTab) => void;
  onSendChat: (text: string) => void;
  onSendInvite: (targetPilotId: string) => void;
  onAcceptInvite: (invite: GameInvite) => void;
  onDismissInvite: () => void;
  onPauseGame: () => void;
}

const CARDINAL_POINTS: { deg: number; label: string }[] = [
  { deg: 0, label: 'С' },
  { deg: 45, label: 'СВ' },
  { deg: 90, label: 'В' },
  { deg: 135, label: 'ЮВ' },
  { deg: 180, label: 'Ю' },
  { deg: 225, label: 'ЮЗ' },
  { deg: 270, label: 'З' },
  { deg: 315, label: 'СЗ' },
];

export const HudOverlay: React.FC<HudOverlayProps> = ({
  profile,
  telemetry,
  cameraMode,
  weather,
  wireframe,
  isNight,
  isMuted,
  hudTheme,
  tutorialFlags,
  showTutorial,
  remotePilots,
  chatMessages,
  pendingInvite,
  toastBanner,
  onToggleCamera,
  onToggleCinematic,
  onToggleWeather,
  onToggleWireframe,
  onToggleNight,
  onToggleMute,
  onToggleHudTheme,
  onChangeDifficulty,
  onDismissTutorial,
  onOpenModal,
  onSendChat,
  onSendInvite,
  onAcceptInvite,
  onDismissInvite,
  onPauseGame,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyM') {
        onToggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggleMute]);

  const isDark = hudTheme === 'dark';
  const surfaceClass = isDark
    ? 'bg-slate-950/88 border-slate-800 text-slate-100'
    : 'bg-white/92 border-slate-300 text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';

  const xpNext = xpRequiredForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / xpNext) * 100));

  const cameraLabel =
    cameraMode === 'chase'
      ? 'Хвостовая'
      : cameraMode === 'cockpit'
        ? 'Кокпит'
        : cameraMode === 'tactical'
          ? 'Тактическая'
          : 'Cinematic';

  const weatherLabel =
    weather === 'clear'
      ? 'Ясно'
      : weather === 'rain'
        ? 'Дождь (Порывы)'
        : weather === 'snow'
          ? 'Снег (Обледенение)'
          : 'Туман (Низинный)';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Top Row: Left Telemetry Cluster | Center Compass Tape | Right Level & Score */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        {/* Top-Left: Compact Flight Telemetry (Speed, Altitude, Hull, Throttle) */}
        <div
          className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-lg ${surfaceClass}`}
        >
          <div className="flex items-center gap-5 font-mono tabular-nums">
            <div>
              <div className={`text-[11px] font-sans ${mutedClass}`}>СКОРОСТЬ</div>
              <div className="text-xl font-bold text-amber-500">
                {telemetry.speedKmh}{' '}
                <span className="text-xs font-normal">км/ч</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-700/40" />

            <div>
              <div className={`text-[11px] font-sans ${mutedClass}`}>ВЫСОТА</div>
              <div className="text-xl font-bold text-sky-400">
                {telemetry.altitudeM}{' '}
                <span className="text-xs font-normal">м</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-700/40" />

            <div>
              <div className={`text-[11px] font-sans ${mutedClass}`}>ТЯГА / ФОРСАЖ</div>
              <div className="text-sm font-semibold">
                {telemetry.throttlePct}% ·{' '}
                <span className="text-amber-400">{telemetry.boostPct}%</span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-700/40" />

            <div>
              <div className={`text-[11px] font-sans ${mutedClass}`}>ПРОЧНОСТЬ</div>
              <div
                className={`text-sm font-bold ${
                  telemetry.hullPct > 50
                    ? 'text-emerald-400'
                    : telemetry.hullPct > 25
                      ? 'text-amber-400'
                      : 'text-rose-500'
                }`}
              >
                {telemetry.hullPct}%
              </div>
            </div>
          </div>

          <div
            className={`mt-1.5 pt-1.5 border-t border-slate-700/30 flex items-center justify-between gap-3 text-xs ${mutedClass}`}
          >
            <span>{telemetry.biomeName}</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-400 font-medium">
              Метео: {weatherLabel}
              {telemetry.windDriftKmh > 0
                ? ` · Снос ${telemetry.windDriftKmh} км/ч`
                : ''}
            </span>
            {telemetry.gamepadConnected && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-medium">
                  Геймпад активен
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-Center: Minimalist Heading Indicator (Compass Tape) */}
        <div
          className={`pointer-events-auto flex flex-col items-center px-5 py-2.5 rounded-xl border shadow-lg ${surfaceClass}`}
        >
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className={mutedClass}>КУРС</span>
            <span className="text-base font-bold text-amber-500">
              {String(telemetry.headingDeg).padStart(3, '0')}°
            </span>
            <span aria-hidden="true" className={mutedClass}>
              ·
            </span>
            <span className={mutedClass}>
              Кольцо: {telemetry.nextRingDistanceM} м (
              {String(telemetry.nextRingBearingDeg).padStart(3, '0')}°)
            </span>
          </div>

          {/* Horizontal Compass Scale */}
          <div className="relative w-64 h-6 mt-1 overflow-hidden border-t border-slate-700/40 pt-1">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-2.5 bg-amber-500 z-10" />
            {CARDINAL_POINTS.map((pt) => {
              let diff = pt.deg - telemetry.headingDeg;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              if (Math.abs(diff) > 75) return null;
              const leftPct = 50 + (diff / 75) * 46;
              return (
                <span
                  key={pt.label}
                  style={{ left: `${leftPct}%` }}
                  className="absolute top-1 -translate-x-1/2 text-[11px] font-mono font-semibold"
                >
                  {pt.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Top-Right: Pilot Level, Score & Pause Button */}
        <div
          className={`pointer-events-auto flex items-center gap-4 px-4 py-2.5 rounded-xl border shadow-lg ${surfaceClass}`}
        >
          <div className="text-right font-mono tabular-nums">
            <div className="text-xs font-sans font-semibold">
              {profile.callsign} · УР. {profile.level}
            </div>
            <div className="text-sm font-bold text-amber-500">
              Счёт: {telemetry.score}
              {telemetry.combo > 1 ? ` (x${telemetry.combo})` : ''}
            </div>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 ml-auto">
              <div
                className="h-full bg-sky-400 transition-all duration-200"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onPauseGame();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Меню / Пауза
          </button>
        </div>
      </div>

      {/* Center Reticle (Subtle non-occluding vector flight reticle) */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-45">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <circle
            cx="28"
            cy="28"
            r="3"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
          <line x1="8" y1="28" x2="20" y2="28" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="36" y1="28" x2="48" y2="28" stroke="#38bdf8" strokeWidth="1.5" />
          <line x1="28" y1="12" x2="28" y2="20" stroke="#38bdf8" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Achievement / Level Up Notification Toast */}
      {toastBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
          <div
            className={`px-5 py-3 rounded-xl border border-amber-500 shadow-xl ${surfaceClass} flex items-center gap-3`}
          >
            <span className="text-lg">🏆</span>
            <div>
              <div className="text-xs font-bold text-amber-500">
                {toastBanner.title}
              </div>
              <div className="text-xs">{toastBanner.subtitle}</div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Game Invite Notification Toast */}
      {pendingInvite && (
        <div className="fixed top-24 right-6 pointer-events-auto z-30 max-w-xs">
          <div
            className={`p-4 rounded-xl border border-sky-400 shadow-xl ${surfaceClass}`}
          >
            <div className="text-xs font-bold text-sky-400 mb-1">
              Приглашение в звено
            </div>
            <p className="text-xs mb-3">
              Пилот <strong>{pendingInvite.fromCallsign}</strong> (Ур.{' '}
              {pendingInvite.fromLevel}) приглашает в совместный вылет (комната{' '}
              <span className="font-mono">{pendingInvite.room}</span>).
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAcceptInvite(pendingInvite)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg cursor-pointer whitespace-nowrap"
              >
                Принять вызов
              </button>
              <button
                type="button"
                onClick={onDismissInvite}
                className={`px-3 py-1.5 text-xs rounded-lg border border-slate-700 cursor-pointer whitespace-nowrap ${mutedClass}`}
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concise Onboarding Tutorial Checklist (Top-Left below telemetry, dismissible) */}
      {showTutorial && (
        <div className="fixed top-32 left-5 pointer-events-auto max-w-xs">
          <div className={`p-3.5 rounded-xl border shadow-lg ${surfaceClass}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-amber-500">
                Краткое обучение пилота
              </span>
              <button
                type="button"
                onClick={onDismissTutorial}
                className={`text-[11px] hover:underline cursor-pointer ${mutedClass}`}
              >
                Скрыть
              </button>
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span
                  className={
                    tutorialFlags.adjustedThrottle
                      ? 'text-emerald-400 font-bold'
                      : mutedClass
                  }
                >
                  {tutorialFlags.adjustedThrottle ? '✓' : '1.'}
                </span>
                <span
                  className={
                    tutorialFlags.adjustedThrottle ? 'line-through opacity-60' : ''
                  }
                >
                  Тяга и форсаж (Shift / E / Q)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    tutorialFlags.steeredAircraft
                      ? 'text-emerald-400 font-bold'
                      : mutedClass
                  }
                >
                  {tutorialFlags.steeredAircraft ? '✓' : '2.'}
                </span>
                <span
                  className={
                    tutorialFlags.steeredAircraft ? 'line-through opacity-60' : ''
                  }
                >
                  Пилотирование и вираж (WASD / Стрелки / Геймпад)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    tutorialFlags.toggledModeOrCamera
                      ? 'text-emerald-400 font-bold'
                      : mutedClass
                  }
                >
                  {tutorialFlags.toggledModeOrCamera ? '✓' : '3.'}
                </span>
                <span
                  className={
                    tutorialFlags.toggledModeOrCamera ? 'line-through opacity-60' : ''
                  }
                >
                  Смена камеры [C] или каркаса [V]
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={
                    tutorialFlags.passedFirstRing
                      ? 'text-emerald-400 font-bold'
                      : mutedClass
                  }
                >
                  {tutorialFlags.passedFirstRing ? '✓' : '4.'}
                </span>
                <span
                  className={
                    tutorialFlags.passedFirstRing ? 'line-through opacity-60' : ''
                  }
                >
                  Пролёт сквозь золотое кольцо
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Compact In-Game Real-Time Chat & Squad Invites Drawer (Bottom-Right above dock when opened) */}
      {chatOpen && (
        <div
          className={`fixed bottom-24 right-5 w-80 pointer-events-auto rounded-xl border shadow-2xl p-3.5 ${surfaceClass}`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/40">
            <span className="text-xs font-bold">
              Эфир пилотов ({remotePilots.length + 1} в сети)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSendInvite('all')}
                className="px-2 py-1 text-[11px] font-medium bg-sky-500/20 text-sky-400 border border-sky-500/40 rounded cursor-pointer whitespace-nowrap"
              >
                Позвать в звено
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className={`text-xs cursor-pointer ${mutedClass}`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Online Pilots Strip */}
          {remotePilots.length > 0 && (
            <div className="mb-2 pb-2 border-b border-slate-700/30 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              {remotePilots.map((rp) => (
                <button
                  key={rp.id}
                  type="button"
                  onClick={() => onSendInvite(rp.id)}
                  className="px-2 py-0.5 rounded border border-slate-700 hover:border-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Пригласить пилота в полёт"
                >
                  {rp.emblem} {rp.callsign} ({rp.platform}) +
                </button>
              ))}
            </div>
          )}

          <div className="h-36 overflow-y-auto space-y-1.5 pr-1 text-xs mb-2">
            {chatMessages.map((m) => (
              <div key={m.id} className="leading-snug">
                <span className="font-semibold text-amber-500">
                  {m.emblem} {m.callsign}:{' '}
                </span>
                <span className={m.isSystem ? 'text-sky-400' : ''}>{m.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Сообщение в эфир..."
              maxLength={180}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-900/70 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg cursor-pointer whitespace-nowrap"
            >
              Отпр.
            </button>
          </form>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Mandatory Three.js Skill Layout) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-4 z-20 pointer-events-auto flex flex-col items-center transition-transform duration-200"
        style={{
          maxWidth: 'min(940px, 95vw)',
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 28px))'
            : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse / Expand Zen Mode Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className={`px-3.5 py-1 text-[11px] font-medium rounded-t-lg border border-b-0 cursor-pointer whitespace-nowrap ${surfaceClass}`}
        >
          {dockCollapsed ? '▴ Показать панель [H]' : '▾ Скрыть панель [H]'}
        </button>

        {/* Main Horizontal Control Dock */}
        <div
          className={`flex flex-wrap items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border shadow-2xl ${surfaceClass}`}
        >
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleCamera();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Камера: {cameraLabel} [C]
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleCinematic();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              cameraMode === 'cinematic'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'border-slate-700/70 hover:border-amber-500'
            }`}
          >
            🎬 Cinematic: {cameraMode === 'cinematic' ? 'ВКЛ' : 'ВЫКЛ'}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleWireframe();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              wireframe
                ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                : 'border-slate-700/70 hover:border-amber-500'
            }`}
          >
            Каркас: {wireframe ? 'ВКЛ' : 'ВЫКЛ'} [V]
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleNight();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isNight
                ? 'bg-indigo-600 text-white border-indigo-400 font-semibold'
                : 'border-slate-700/70 hover:border-amber-500'
            }`}
          >
            Свет: {isNight ? 'Ночь' : 'День'} [N]
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleWeather();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              weather !== 'clear'
                ? 'bg-sky-500/20 text-sky-300 border-sky-400 font-semibold'
                : 'border-slate-700/70 hover:border-amber-500'
            }`}
          >
            Погода:{' '}
            {weather === 'clear'
              ? 'Ясно'
              : weather === 'rain'
                ? 'Дождь'
                : weather === 'snow'
                  ? 'Снег'
                  : 'Туман'}{' '}
            [G]
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleMute();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Звук: {isMuted ? 'ВЫКЛ' : 'ВКЛ'} [M]
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              const nextDiff: DifficultyMode =
                profile.difficulty === 'arcade'
                  ? 'normal'
                  : profile.difficulty === 'normal'
                    ? 'simulation'
                    : 'arcade';
              onChangeDifficulty(nextDiff);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Сложность:{' '}
            {profile.difficulty === 'arcade'
              ? 'Аркада'
              : profile.difficulty === 'normal'
                ? 'Стандарт'
                : 'Симуляция'}
          </button>

          <div className="h-5 w-px bg-slate-700/40 mx-0.5" />

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setChatOpen((o) => !o);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              chatOpen
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'border-slate-700/70 hover:border-amber-500'
            }`}
          >
            Чат и Друзья ({remotePilots.length + 1})
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('quests');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Задания
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('achievements');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Достижения
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('leaderboard');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Лидеры
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('profile');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Профиль
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenModal('cloud');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Облако
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleHudTheme();
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-700/70 hover:border-amber-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Переключить тему интерфейса"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </div>
  );
};
