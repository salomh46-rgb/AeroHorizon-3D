import React, { useState } from 'react';
import {
  Achievement,
  DAILY_LOGIN_REWARDS,
  DifficultyMode,
  GameScreenState,
  HudTheme,
  LeaderboardEntry,
  LIVERIES,
  LiveryId,
  ModalTab,
  PilotProfile,
} from '../types/game';
import { soundEngine } from '../audio/soundEngine';

interface ModalsProps {
  screenState: GameScreenState;
  activeModal: ModalTab;
  hudTheme: HudTheme;
  profile: PilotProfile;
  leaderboard: LeaderboardEntry[];
  cloudSyncStatus: string;
  onCloseModal: () => void;
  onSelectModalTab: (tab: ModalTab) => void;
  onResumeGame: () => void;
  onRestartFlight: () => void;
  onReturnToTitle: () => void;
  onUpdateProfile: (updates: Partial<PilotProfile>) => void;
  onClaimDailyLogin: () => void;
  onClaimQuest: (questId: string) => void;
  onSaveToCloud: () => Promise<void>;
  onLoadFromCloud: (syncCode: string) => Promise<void>;
  onUnlockSocialAchievement: () => void;
}

const EMBLEM_OPTIONS = ['✈️', '🦅', '⚡', '🛰️', '🔥', '🚀', '🐉', '🌟'];

export const Modals: React.FC<ModalsProps> = ({
  screenState,
  activeModal,
  hudTheme,
  profile,
  leaderboard,
  cloudSyncStatus,
  onCloseModal,
  onSelectModalTab,
  onResumeGame,
  onRestartFlight,
  onReturnToTitle,
  onUpdateProfile,
  onClaimDailyLogin,
  onClaimQuest,
  onSaveToCloud,
  onLoadFromCloud,
  onUnlockSocialAchievement,
}) => {
  const [callsignDraft, setCallsignDraft] = useState(profile.callsign);
  const [bioDraft, setBioDraft] = useState(profile.bio);
  const [syncInput, setSyncInput] = useState('');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isDark = hudTheme === 'dark';
  const modalCardClass = isDark
    ? 'bg-slate-950 border-slate-800 text-slate-100'
    : 'bg-white border-slate-300 text-slate-900';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';
  const subSurface = isDark
    ? 'bg-slate-900/90 border-slate-800'
    : 'bg-slate-100 border-slate-200';

  const handleShareAchievement = async (ach?: Achievement) => {
    soundEngine.playUiClick();
    onUnlockSocialAchievement();
    const shareText = ach
      ? `🏆 В симуляторе AeroHorizon 3D открыто достижение «${ach.title}»! Мой пилот: ${profile.callsign} (Ур. ${profile.level}, Рейтинг ${profile.rating} ELO).`
      : `✈️ Полёт в AeroHorizon 3D! Пилот ${profile.callsign} · Уровень ${profile.level} · Рекорд: ${profile.highScore} очков (${profile.rating} ELO).`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AeroHorizon 3D — Достижения пилота',
          text: shareText,
        });
        setShareFeedback('Опубликовано через системное меню обмена!');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('Карточка пилота скопирована для отправки в соцсети!');
      } else {
        setShareFeedback('Карточка достижения сформирована!');
      }
    } catch {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText).catch(() => {});
      }
      setShareFeedback('Текст достижения скопирован в буфер обмена!');
    }
    setTimeout(() => setShareFeedback(null), 3500);
  };

  // 1. Pause or Game Over Screen Modal (when no sub-tab is open)
  if ((screenState === 'paused' || screenState === 'gameover') && !activeModal) {
    const isGameOver = screenState === 'gameover';
    return (
      <div className="fixed inset-0 z-30 bg-slate-950/75 flex items-center justify-center p-4">
        <div
          className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl text-center ${modalCardClass}`}
        >
          <h2 className="text-2xl font-bold font-display mb-2">
            {isGameOver ? 'Крушение борта' : 'Полёт на паузе'}
          </h2>
          <p className={`text-sm mb-5 ${mutedText}`}>
            {isGameOver
              ? 'Корпус получил критические повреждения при столкновении с рельефом.'
              : 'Системы стабилизированы. Выберите действие или откройте бортовой журнал.'}
          </p>

          <div
            className={`grid grid-cols-3 gap-2 p-3 rounded-xl border mb-6 font-mono tabular-nums ${subSurface}`}
          >
            <div>
              <div className={`text-[11px] font-sans ${mutedText}`}>Уровень</div>
              <div className="text-base font-bold text-amber-500">
                {profile.level}
              </div>
            </div>
            <div>
              <div className={`text-[11px] font-sans ${mutedText}`}>Рекорд</div>
              <div className="text-base font-bold text-sky-400">
                {profile.highScore}
              </div>
            </div>
            <div>
              <div className={`text-[11px] font-sans ${mutedText}`}>Рейтинг</div>
              <div className="text-base font-bold text-emerald-400">
                {profile.rating}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {!isGameOver && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onResumeGame();
                }}
                className="w-full py-2.5 px-4 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl cursor-pointer"
              >
                Продолжить полёт (Esc)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onRestartFlight();
              }}
              className="w-full py-2.5 px-4 text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl cursor-pointer"
            >
              Новый вылет с начала долины
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSelectModalTab('profile')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border cursor-pointer ${subSurface}`}
              >
                Профиль и Ливрея
              </button>
              <button
                type="button"
                onClick={() => onSelectModalTab('leaderboard')}
                className={`py-2 px-3 text-xs font-medium rounded-lg border cursor-pointer ${subSurface}`}
              >
                Рейтинг лидеров
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onReturnToTitle();
              }}
              className={`w-full py-2 px-4 text-xs font-medium rounded-lg border border-slate-700/60 hover:border-amber-500 cursor-pointer mt-1 ${mutedText}`}
            >
              Выйти на главный экран
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/75 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-3xl max-h-[86vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${modalCardClass}`}
      >
        {/* Modal Top Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-800/70">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'leaderboard', label: 'Рейтинг лидеров' },
                { id: 'quests', label: 'Задания и Награды' },
                { id: 'achievements', label: 'Достижения и Соцсети' },
                { id: 'profile', label: 'Профиль пилота' },
                { id: 'cloud', label: 'Облачная синхронизация' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onSelectModalTab(t.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeModal === t.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : `${mutedText} hover:text-amber-400`
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onCloseModal();
            }}
            className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-700 hover:border-amber-500 cursor-pointer"
          >
            Закрыть ✕
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: LEADERBOARD & COMPETITIVE RATING */}
          {activeModal === 'leaderboard' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold font-display">
                    Глобальный рейтинг лидеров
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    Кроссплатформенная таблица пилотов, ранжированная по соревновательному рейтингу ELO и рекорду очков.
                  </p>
                </div>
                <div
                  className={`px-4 py-2 rounded-xl border font-mono text-xs tabular-nums ${subSurface}`}
                >
                  Ваш рейтинг:{' '}
                  <strong className="text-amber-500">{profile.rating} ELO</strong> · Рекорд:{' '}
                  <strong className="text-sky-400">{profile.highScore}</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className={`${subSurface} border-b border-slate-800/70 font-sans`}>
                    <tr>
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Пилот</th>
                      <th className="py-2.5 px-4">Платформа</th>
                      <th className="py-2.5 px-4">Режим</th>
                      <th className="py-2.5 px-4 text-right">Уровень</th>
                      <th className="py-2.5 px-4 text-right">Кольца</th>
                      <th className="py-2.5 px-4 text-right">Рекорд</th>
                      <th className="py-2.5 px-4 text-right">Рейтинг ELO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {leaderboard.map((entry, idx) => {
                      const isMe = entry.id === profile.id;
                      return (
                        <tr
                          key={entry.id}
                          className={isMe ? 'bg-amber-500/10 font-semibold' : ''}
                        >
                          <td className="py-2.5 px-4 font-bold text-amber-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-sans">
                            <span>{entry.emblem}</span>{' '}
                            <span>{entry.callsign}</span>
                            {isMe && (
                              <span className="ml-1.5 text-[11px] text-amber-500">
                                (Вы)
                              </span>
                            )}
                          </td>
                          <td className={`py-2.5 px-4 font-sans ${mutedText}`}>
                            {entry.platform}
                          </td>
                          <td className={`py-2.5 px-4 font-sans ${mutedText}`}>
                            {entry.difficulty === 'simulation'
                              ? 'Симуляция'
                              : entry.difficulty === 'normal'
                                ? 'Стандарт'
                                : 'Аркада'}
                          </td>
                          <td className="py-2.5 px-4 text-right">{entry.level}</td>
                          <td className="py-2.5 px-4 text-right">
                            {entry.totalRings}
                          </td>
                          <td className="py-2.5 px-4 text-right text-sky-400">
                            {entry.highScore}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                            {entry.rating}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DAILY QUESTS & DAILY LOGIN REWARDS */}
          {activeModal === 'quests' && (
            <div className="space-y-6">
              {/* 7-Day Login Streak Rewards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold font-display">
                      Ежедневные награды за вход (Серия: {profile.loginStreak} дн.)
                    </h3>
                    <p className={`text-xs ${mutedText}`}>
                      Заходите каждый день, чтобы получать бонусный опыт и повышать уровень пилота.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={profile.claimedTodayReward}
                    onClick={() => {
                      soundEngine.playLevelUp();
                      onClaimDailyLogin();
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap ${
                      profile.claimedTodayReward
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {profile.claimedTodayReward
                      ? 'Награда за сегодня получена ✓'
                      : 'Забрать награду дня'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {DAILY_LOGIN_REWARDS.map((item) => {
                    const isCurrent =
                      ((profile.loginStreak - 1) % 7) + 1 === item.day;
                    const isPassed =
                      ((profile.loginStreak - 1) % 7) + 1 > item.day ||
                      (isCurrent && profile.claimedTodayReward);
                    return (
                      <div
                        key={item.day}
                        className={`p-3 rounded-xl border text-center ${
                          isCurrent
                            ? 'border-amber-500 bg-amber-500/10'
                            : subSurface
                        }`}
                      >
                        <div className="text-xs font-bold text-amber-500 mb-1">
                          День {item.day}
                        </div>
                        <div className="text-xs font-mono font-semibold mb-1">
                          +{item.xp} XP
                        </div>
                        <div className={`text-[11px] ${mutedText}`}>
                          {isPassed ? 'Получено ✓' : 'Бонус'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Daily Quests */}
              <div>
                <h3 className="text-lg font-bold font-display mb-2">
                  Ежедневные лётные задания
                </h3>
                <div className="space-y-2.5">
                  {profile.dailyQuests.map((q) => {
                    const pct = Math.min(
                      100,
                      Math.round((q.progress / q.target) * 100)
                    );
                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${subSurface}`}
                      >
                        <div className="flex-1 min-w-[220px]">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <span>{q.title}</span>
                            <span aria-hidden="true" className={mutedText}>
                              ·
                            </span>
                            <span className="text-xs font-mono text-amber-500">
                              +{q.rewardXp} XP
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${mutedText}`}>
                            {q.description}
                          </p>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                            <div
                              className="h-full bg-emerald-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                          <span>
                            {Math.min(q.progress, q.target)} / {q.target}
                          </span>
                          <button
                            type="button"
                            disabled={!q.completed || q.claimed}
                            onClick={() => {
                              soundEngine.playLevelUp();
                              onClaimQuest(q.id);
                            }}
                            className={`px-3.5 py-1.5 rounded-lg font-sans font-semibold cursor-pointer whitespace-nowrap ${
                              q.claimed
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : q.completed
                                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                  : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {q.claimed
                              ? 'Получено ✓'
                              : q.completed
                                ? 'Забрать XP'
                                : 'В процессе'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACHIEVEMENTS & SOCIAL SHARING */}
          {activeModal === 'achievements' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold font-display">
                    Лётные достижения и обмен в соцсетях
                  </h3>
                  <p className={`text-xs ${mutedText}`}>
                    Открыто{' '}
                    {profile.achievements.filter((a) => a.unlocked).length} из{' '}
                    {profile.achievements.length} достижений. Поделитесь карточкой пилота в один клик.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleShareAchievement()}
                  className="px-4 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Поделиться рекордом в соцсетях
                </button>
              </div>

              {shareFeedback && (
                <div className="mb-4 px-4 py-2.5 rounded-xl border border-emerald-500/60 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                  {shareFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.achievements.map((ach) => {
                  const pct = Math.min(
                    100,
                    Math.round((ach.progress / ach.maxProgress) * 100)
                  );
                  return (
                    <div
                      key={ach.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        ach.unlocked
                          ? 'border-amber-500/70 bg-amber-500/5'
                          : subSurface
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">
                            {ach.unlocked ? '🏆 ' : '🔒 '}
                            {ach.title}
                          </span>
                          <span className="text-xs font-mono text-amber-500">
                            +{ach.xpReward} XP
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${mutedText}`}>
                          {ach.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              ach.unlocked ? 'bg-amber-500' : 'bg-sky-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums">
                          {Math.min(ach.progress, ach.maxProgress)} /{' '}
                          {ach.maxProgress}
                        </span>
                        {ach.unlocked && (
                          <button
                            type="button"
                            onClick={() => handleShareAchievement(ach)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            Поделиться
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PILOT PROFILE CUSTOMIZATION */}
          {activeModal === 'profile' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold font-display">
                  Кастомизация профиля и самолёта
                </h3>
                <p className={`text-xs ${mutedText}`}>
                  Настройте позывной, эмблему, цветовую схему обшивки 3D-истребителя и сложность полёта.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Позывной пилота (Callsign)
                  </label>
                  <input
                    type="text"
                    value={callsignDraft}
                    onChange={(e) => setCallsignDraft(e.target.value)}
                    maxLength={18}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    Девиз / статус в эскадрилье
                  </label>
                  <input
                    type="text"
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    maxLength={60}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Emblem Picker */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Эмблема пилота
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMBLEM_OPTIONS.map((emb) => (
                    <button
                      key={emb}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateProfile({ emblem: emb });
                      }}
                      className={`w-11 h-11 text-xl rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                        profile.emblem === emb
                          ? 'border-amber-500 bg-amber-500/20'
                          : `${subSurface} hover:border-slate-500`
                      }`}
                    >
                      {emb}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aircraft Livery Picker */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Ливрея 3D-самолёта
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(LIVERIES) as LiveryId[]).map((lid) => {
                    const spec = LIVERIES[lid];
                    const selected = profile.livery === lid;
                    return (
                      <button
                        key={lid}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          onUpdateProfile({ livery: lid });
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                          selected
                            ? 'border-amber-500 bg-amber-500/10'
                            : `${subSurface} hover:border-slate-600`
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full inline-block"
                            style={{ backgroundColor: spec.cssColor }}
                          />
                          <span className="text-xs font-bold">{spec.name}</span>
                        </div>
                        <div className={`text-[11px] ${mutedText}`}>
                          {selected ? 'Активна' : 'Выбрать'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty Mode */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Сложность физики и столкновений
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'arcade',
                        title: 'Аркада',
                        desc: 'Мягкие касания рельефа, быстрое восстановление',
                      },
                      {
                        id: 'normal',
                        title: 'Стандарт',
                        desc: 'Сбалансированная тяга и бонус x1.15 к рейтингу',
                      },
                      {
                        id: 'simulation',
                        title: 'Симуляция',
                        desc: 'Высокая скорость, жёсткие столкновения, бонус x1.35',
                      },
                    ] as { id: DifficultyMode; title: string; desc: string }[]
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateProfile({ difficulty: d.id });
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer ${
                        profile.difficulty === d.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : subSurface
                      }`}
                    >
                      <div className="text-xs font-bold mb-1">{d.title}</div>
                      <div className={`text-[11px] ${mutedText}`}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onUpdateProfile({
                      callsign: callsignDraft.trim() || 'СОКОЛ-1',
                      bio: bioDraft.trim() || 'Пилот AeroHorizon',
                    });
                    onCloseModal();
                  }}
                  className="px-6 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl cursor-pointer"
                >
                  Сохранить профиль и синхронизировать
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: CLOUD SAVES & CROSS-PLATFORM SYNC */}
          {activeModal === 'cloud' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold font-display">
                  Облачные сохранения и кроссплатформенная синхронизация
                </h3>
                <p className={`text-xs ${mutedText}`}>
                  Ваш прогресс, уровень, ливрея и достижения автоматически сохраняются на сервере. Используйте код синхронизации для переноса профиля между ПК, веб-браузером и мобильными устройствами.
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${subSurface}`}
              >
                <div>
                  <div className={`text-xs ${mutedText}`}>
                    Ваш уникальный код синхронизации:
                  </div>
                  <div className="text-xl font-mono font-bold tracking-wider text-amber-500 mt-0.5">
                    {profile.syncCode}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    onSaveToCloud();
                  }}
                  className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  Выгрузить прогресс в облако сейчас
                </button>
              </div>

              <div className={`p-4 rounded-xl border space-y-3 ${subSurface}`}>
                <div className="text-xs font-semibold">
                  Восстановить профиль с другого устройства по коду
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={syncInput}
                    onChange={(e) => setSyncInput(e.target.value.toUpperCase())}
                    placeholder="Например: AERO-8F2K"
                    className="flex-1 px-3.5 py-2 text-xs font-mono rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!syncInput.trim()) return;
                      soundEngine.playUiClick();
                      onLoadFromCloud(syncInput.trim());
                    }}
                    className="px-4 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Загрузить из облака
                  </button>
                </div>
              </div>

              {cloudSyncStatus && (
                <div className="px-4 py-2.5 rounded-xl border border-sky-500/50 bg-sky-500/10 text-sky-400 text-xs font-medium">
                  {cloudSyncStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
