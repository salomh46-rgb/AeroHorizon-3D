import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraMode,
  ChatMessage,
  DAILY_LOGIN_REWARDS,
  DifficultyMode,
  FlightTelemetry,
  GameInvite,
  GameScreenState,
  HudTheme,
  INITIAL_ACHIEVEMENTS,
  INITIAL_DAILY_QUESTS,
  LeaderboardEntry,
  ModalTab,
  PilotProfile,
  RemotePilot,
  WeatherMode,
  xpRequiredForLevel,
} from './types/game';
import { FlightCanvas, TutorialProgressFlags } from './components/FlightCanvas';
import { TitleScreen } from './components/TitleScreen';
import { HudOverlay } from './components/HudOverlay';
import { Modals } from './components/Modals';
import { soundEngine } from './audio/soundEngine';

const STORAGE_KEY = 'aerohorizon_pilot_profile_v1';

function createInitialProfile(): PilotProfile {
  const todayStr = new Date().toISOString().slice(0, 10);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PilotProfile;
      // Check daily login streak progression
      if (parsed.lastLoginDate !== todayStr) {
        const prevDate = new Date(parsed.lastLoginDate);
        const nowDate = new Date(todayStr);
        const diffDays = Math.round(
          (nowDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24)
        );
        parsed.loginStreak = diffDays === 1 ? (parsed.loginStreak || 1) + 1 : 1;
        parsed.lastLoginDate = todayStr;
        parsed.claimedTodayReward = false;
        parsed.dailyQuests = INITIAL_DAILY_QUESTS.map((q) => ({ ...q }));
      }
      return parsed;
    }
  } catch {
    // Ignore localStorage parse error
  }

  const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return {
    id: `pilot-${Math.random().toString(36).substring(2, 9)}`,
    syncCode: `AERO-${randCode}`,
    callsign: `СОКОЛ-${Math.floor(10 + Math.random() * 89)}`,
    emblem: '🦅',
    bio: 'Исследователь горных каньонов',
    livery: 'amber',
    platform: 'PC',
    level: 1,
    xp: 0,
    score: 0,
    highScore: 0,
    rating: 1200,
    totalRings: 0,
    totalFlightSeconds: 0,
    maxSpeedReached: 0,
    loginStreak: 1,
    lastLoginDate: todayStr,
    claimedTodayReward: false,
    tutorialCompleted: false,
    difficulty: 'normal',
    achievements: INITIAL_ACHIEVEMENTS.map((a) => ({ ...a })),
    dailyQuests: INITIAL_DAILY_QUESTS.map((q) => ({ ...q })),
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [profile, setProfile] = useState<PilotProfile>(createInitialProfile);
  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [activeModal, setActiveModal] = useState<ModalTab>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [isNight, setIsNight] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hudTheme, setHudTheme] = useState<HudTheme>('dark');
  const [resetSignal, setResetSignal] = useState<number>(0);

  const [tutorialFlags, setTutorialFlags] = useState<TutorialProgressFlags>({
    adjustedThrottle: false,
    steeredAircraft: false,
    toggledModeOrCamera: false,
    passedFirstRing: false,
  });

  const [telemetry, setTelemetry] = useState<FlightTelemetry>({
    speedKmh: 210,
    altitudeM: 68,
    groundClearanceM: 50,
    headingDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    throttlePct: 58,
    hullPct: 100,
    boostPct: 100,
    score: 0,
    combo: 0,
    ringsCollected: 0,
    nextRingDistanceM: 240,
    nextRingBearingDeg: 0,
    gamepadConnected: false,
    gamepadName: '',
    biomeName: 'Изумрудная Долина Ветров',
    weather: 'clear',
    windDriftKmh: 0,
  });

  const [remotePilots, setRemotePilots] = useState<RemotePilot[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pendingInvite, setPendingInvite] = useState<GameInvite | null>(null);
  const [toastBanner, setToastBanner] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string>('');
  const [currentRoom, setCurrentRoom] = useState<string>('global');

  const wsRef = useRef<WebSocket | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const triggerToast = useCallback((title: string, subtitle: string) => {
    setToastBanner({ title, subtitle });
    setTimeout(() => {
      setToastBanner((prev) => (prev?.title === title ? null : prev));
    }, 4200);
  }, []);

  // Persist profile to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  // Add XP and handle automatic Level Up progression
  const grantXpAndEvaluate = useCallback(
    (
      addedXp: number,
      mutator?: (draft: PilotProfile) => { unlockedTitles: string[] }
    ) => {
      setProfile((prev) => {
        const draft: PilotProfile = {
          ...prev,
          achievements: prev.achievements.map((a) => ({ ...a })),
          dailyQuests: prev.dailyQuests.map((q) => ({ ...q })),
          updatedAt: Date.now(),
        };

        let unlockedTitles: string[] = [];
        if (mutator) {
          const res = mutator(draft);
          unlockedTitles = res.unlockedTitles;
        }

        draft.xp += addedXp;
        let leveledUp = false;
        while (draft.xp >= xpRequiredForLevel(draft.level)) {
          draft.xp -= xpRequiredForLevel(draft.level);
          draft.level += 1;
          leveledUp = true;
        }

        const diffMult =
          draft.difficulty === 'simulation'
            ? 1.35
            : draft.difficulty === 'normal'
              ? 1.15
              : 1.0;
        draft.rating = Math.max(
          draft.rating,
          Math.round(
            1000 +
              draft.highScore * 0.045 * diffMult +
              draft.totalRings * 4 +
              draft.level * 45
          )
        );

        if (leveledUp) {
          soundEngine.playLevelUp();
          setTimeout(() => {
            triggerToast(
              `Новый уровень пилота: ${draft.level}!`,
              'Повышен рейтинг эскадрильи и мощность форсажа'
            );
          }, 50);
        } else if (unlockedTitles.length > 0) {
          soundEngine.playLevelUp();
          setTimeout(() => {
            triggerToast(
              `Достижение открыто: ${unlockedTitles[0]}`,
              'Бонусный опыт зачислен в лётную книжку'
            );
          }, 50);
        }

        return draft;
      });
    },
    [triggerToast]
  );

  // Cloud Save & Leaderboard Sync Helpers
  const syncProfileToServer = useCallback(
    async (targetProfile: PilotProfile, showStatus = false) => {
      try {
        const res = await fetch('/api/cloud-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: targetProfile }),
        });
        if (res.ok) {
          const data = await res.json();
          if (showStatus) {
            setCloudSyncStatus(
              `Облачное сохранение успешно обновлено (код ${data.syncCode})`
            );
          }
          // Refresh leaderboard
          const lbRes = await fetch('/api/leaderboard');
          if (lbRes.ok) {
            const lbData = await lbRes.json();
            if (Array.isArray(lbData.entries)) {
              setLeaderboard(lbData.entries);
            }
          }
        }
      } catch {
        if (showStatus) {
          setCloudSyncStatus('Локальная копия сохранена');
        }
      }
    },
    []
  );

  const handleLoadFromCloud = useCallback(
    async (syncCode: string) => {
      setCloudSyncStatus('Поиск сохранения в облаке...');
      try {
        const res = await fetch(
          `/api/cloud-save/${encodeURIComponent(syncCode.trim().toUpperCase())}`
        );
        if (!res.ok) {
          setCloudSyncStatus('Профиль с таким кодом синхронизации не найден');
          return;
        }
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setCloudSyncStatus(
            `Профиль пилота ${data.profile.callsign} (Ур. ${data.profile.level}) успешно загружен!`
          );
          triggerToast(
            'Синхронизация завершена',
            `Загружен профиль ${data.profile.callsign}`
          );
        }
      } catch {
        setCloudSyncStatus('Ошибка соединения с облачным сервером');
      }
    },
    [triggerToast]
  );

  // Initial Cloud Sync & Leaderboard Fetch
  useEffect(() => {
    syncProfileToServer(profileRef.current, false);
  }, [syncProfileToServer]);

  // Connect to Real-Time WebSocket Server (/ws) with Auto-Reconnect
  useEffect(() => {
    let reconnectTimer = 0;
    let unmounted = false;

    function connectWs() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const p = profileRef.current;
        ws.send(
          JSON.stringify({
            type: 'pilot:join',
            pilot: {
              id: p.id,
              callsign: p.callsign,
              emblem: p.emblem,
              livery: p.livery,
              platform: p.platform,
              level: p.level,
              rating: p.rating,
              room: 'global',
              x: 0,
              y: 68,
              z: 60,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (!msg || typeof msg.type !== 'string') return;

          if (msg.type === 'init:state') {
            if (Array.isArray(msg.pilots)) {
              setRemotePilots(
                msg.pilots.filter(
                  (rp: RemotePilot) => rp.id !== profileRef.current.id
                )
              );
            }
            if (Array.isArray(msg.chatHistory)) {
              setChatMessages(msg.chatHistory);
            }
            if (Array.isArray(msg.leaderboard)) {
              setLeaderboard(msg.leaderboard);
            }
          } else if (msg.type === 'pilot:joined' || msg.type === 'pilot:updated') {
            const incoming = msg.pilot as RemotePilot;
            if (!incoming || incoming.id === profileRef.current.id) return;
            setRemotePilots((prev) => {
              const exists = prev.some((p) => p.id === incoming.id);
              if (exists) {
                return prev.map((p) => (p.id === incoming.id ? incoming : p));
              }
              return [...prev, incoming];
            });
          } else if (msg.type === 'pilot:left') {
            const leftId = msg.pilotId;
            setRemotePilots((prev) => prev.filter((p) => p.id !== leftId));
          } else if (msg.type === 'chat:message') {
            const chatMsg = msg.message as ChatMessage;
            if (!chatMsg) return;
            // Idempotent check by message ID
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === chatMsg.id)) return prev;
              return [...prev.slice(-49), chatMsg];
            });
          } else if (msg.type === 'invite:received') {
            const inv = msg.invite as GameInvite;
            if (!inv || inv.fromId === profileRef.current.id) return;
            if (inv.toId === 'all' || inv.toId === profileRef.current.id) {
              soundEngine.playInviteAlert();
              setPendingInvite(inv);
            }
          }
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connectWs, 3000);
        }
      };
    }

    connectWs();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Track active flight seconds for daily quest
  useEffect(() => {
    if (screenState !== 'playing') return;
    const timer = window.setInterval(() => {
      grantXpAndEvaluate(2, (draft) => {
        draft.totalFlightSeconds += 1;
        for (const q of draft.dailyQuests) {
          if (q.id === 'dq_flight_time' && !q.completed) {
            q.progress = Math.min(q.target, q.progress + 1);
            if (q.progress >= q.target) q.completed = true;
          }
        }
        return { unlockedTitles: [] };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screenState, grantXpAndEvaluate]);

  // Broadcast local aircraft telemetry to multiplayer WebSocket server
  const handleBroadcastLocalState = useCallback(
    (state: {
      x: number;
      y: number;
      z: number;
      pitch: number;
      yaw: number;
      roll: number;
      speed: number;
      platform: 'PC' | 'Gamepad' | 'Web';
    }) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'pilot:state',
            ...state,
            callsign: profileRef.current.callsign,
            livery: profileRef.current.livery,
            level: profileRef.current.level,
            room: currentRoom,
          })
        );
      }
    },
    [currentRoom]
  );

  // Telemetry handler that also updates speed/altitude achievements & quests
  const handleTelemetryUpdate = useCallback(
    (nextTel: FlightTelemetry) => {
      setTelemetry(nextTel);

      const p = profileRef.current;
      const needsHighScoreUpdate = nextTel.score > p.highScore;
      const needsSpeedUpdate = nextTel.speedKmh > p.maxSpeedReached;
      const needsAltAch =
        nextTel.altitudeM >= 220 &&
        !p.achievements.find((a) => a.id === 'high_altitude')?.unlocked;

      if (needsHighScoreUpdate || needsSpeedUpdate || needsAltAch) {
        grantXpAndEvaluate(0, (draft) => {
          const unlockedTitles: string[] = [];
          if (nextTel.score > draft.highScore) {
            draft.highScore = nextTel.score;
          }
          if (nextTel.speedKmh > draft.maxSpeedReached) {
            draft.maxSpeedReached = nextTel.speedKmh;
          }
          if (nextTel.gamepadConnected && draft.platform !== 'Gamepad') {
            draft.platform = 'Gamepad';
          }

          for (const ach of draft.achievements) {
            if (ach.id === 'first_takeoff' && !ach.unlocked) {
              ach.progress = Math.max(ach.progress, nextTel.speedKmh);
              if (ach.progress >= ach.maxProgress) {
                ach.unlocked = true;
                draft.xp += ach.xpReward;
                unlockedTitles.push(ach.title);
              }
            } else if (ach.id === 'supersonic_ace' && !ach.unlocked) {
              ach.progress = Math.max(ach.progress, nextTel.speedKmh);
              if (ach.progress >= ach.maxProgress) {
                ach.unlocked = true;
                draft.xp += ach.xpReward;
                unlockedTitles.push(ach.title);
              }
            } else if (ach.id === 'high_altitude' && !ach.unlocked) {
              ach.progress = Math.max(ach.progress, nextTel.altitudeM);
              if (ach.progress >= ach.maxProgress) {
                ach.unlocked = true;
                draft.xp += ach.xpReward;
                unlockedTitles.push(ach.title);
              }
            }
          }

          for (const q of draft.dailyQuests) {
            if (q.id === 'dq_speed_350' && !q.completed) {
              q.progress = Math.max(q.progress, nextTel.speedKmh);
              if (q.progress >= q.target) q.completed = true;
            }
          }

          return { unlockedTitles };
        });
      }
    },
    [grantXpAndEvaluate]
  );

  // Ring Checkpoint Collected Handler
  const handleRingCollected = useCallback(
    (
      newCombo: number,
      altitudeAboveGround: number,
      nightActive: boolean,
      wireframeActive: boolean
    ) => {
      const earnedXp = 45 + Math.min(newCombo, 6) * 15;
      grantXpAndEvaluate(earnedXp, (draft) => {
        const unlockedTitles: string[] = [];
        draft.totalRings += 1;

        for (const q of draft.dailyQuests) {
          if (q.id === 'dq_rings_5' && !q.completed) {
            q.progress = Math.min(q.target, q.progress + 1);
            if (q.progress >= q.target) q.completed = true;
          }
        }

        for (const ach of draft.achievements) {
          if (ach.id === 'ring_master_10' && !ach.unlocked) {
            ach.progress += 1;
            if (ach.progress >= ach.maxProgress) {
              ach.unlocked = true;
              draft.xp += ach.xpReward;
              unlockedTitles.push(ach.title);
            }
          } else if (
            ach.id === 'low_flyer' &&
            !ach.unlocked &&
            altitudeAboveGround < 45
          ) {
            ach.progress += 1;
            if (ach.progress >= ach.maxProgress) {
              ach.unlocked = true;
              draft.xp += ach.xpReward;
              unlockedTitles.push(ach.title);
            }
          } else if (ach.id === 'night_owl' && !ach.unlocked && nightActive) {
            ach.progress += 1;
            if (ach.progress >= ach.maxProgress) {
              ach.unlocked = true;
              draft.xp += ach.xpReward;
              unlockedTitles.push(ach.title);
            }
          } else if (
            ach.id === 'wireframe_architect' &&
            !ach.unlocked &&
            wireframeActive
          ) {
            ach.progress += 1;
            if (ach.progress >= ach.maxProgress) {
              ach.unlocked = true;
              draft.xp += ach.xpReward;
              unlockedTitles.push(ach.title);
            }
          }
        }

        return { unlockedTitles };
      });
    },
    [grantXpAndEvaluate]
  );

  const handleTutorialStep = useCallback(
    (flags: Partial<TutorialProgressFlags>) => {
      setTutorialFlags((prev) => {
        const next = { ...prev, ...flags };
        if (
          next.adjustedThrottle &&
          next.steeredAircraft &&
          next.toggledModeOrCamera &&
          next.passedFirstRing &&
          !profileRef.current.tutorialCompleted
        ) {
          setProfile((p) => ({ ...p, tutorialCompleted: true }));
          triggerToast(
            'Обучение пилота завершено!',
            '+100 XP за освоение всех систем управления'
          );
        }
        return next;
      });
    },
    [triggerToast]
  );

  const unlockSquadAchievement = useCallback(() => {
    grantXpAndEvaluate(25, (draft) => {
      const unlockedTitles: string[] = [];
      const ach = draft.achievements.find((a) => a.id === 'squad_comms');
      if (ach && !ach.unlocked) {
        ach.progress = 1;
        ach.unlocked = true;
        draft.xp += ach.xpReward;
        unlockedTitles.push(ach.title);
      }
      return { unlockedTitles };
    });
  }, [grantXpAndEvaluate]);

  const handleSendChat = useCallback(
    (text: string) => {
      const p = profileRef.current;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderId: p.id,
        callsign: p.callsign,
        emblem: p.emblem,
        room: currentRoom,
        text,
        timestamp: Date.now(),
      };
      // Optimistic local append (idempotent)
      setChatMessages((prev) => [...prev.slice(-49), msg]);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat:send', ...msg }));
      }
      unlockSquadAchievement();
    },
    [currentRoom, unlockSquadAchievement]
  );

  const handleSendInvite = useCallback(
    (targetPilotId: string) => {
      const p = profileRef.current;
      const roomCode =
        currentRoom === 'global'
          ? `wing-${p.callsign.slice(0, 4).toLowerCase()}`
          : currentRoom;
      setCurrentRoom(roomCode);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'invite:send',
            id: `inv-${Date.now()}`,
            fromId: p.id,
            fromCallsign: p.callsign,
            fromLevel: p.level,
            toId: targetPilotId,
            room: roomCode,
            difficulty: p.difficulty,
          })
        );
      }
      unlockSquadAchievement();
      triggerToast(
        'Приглашение отправлено',
        `Радиочастота звена ${roomCode} открыта`
      );
    },
    [currentRoom, triggerToast, unlockSquadAchievement]
  );

  const handleAcceptInvite = useCallback(
    (invite: GameInvite) => {
      setCurrentRoom(invite.room);
      setPendingInvite(null);
      handleSendChat(
        `Присоединился к звену ${invite.room} по приглашению ${invite.fromCallsign}!`
      );
      triggerToast(
        `Звено ${invite.room}`,
        `Вы в совместном вылете с ${invite.fromCallsign}`
      );
    },
    [handleSendChat, triggerToast]
  );

  const handleClaimDailyLogin = useCallback(() => {
    const rewardObj =
      DAILY_LOGIN_REWARDS[(profile.loginStreak - 1) % DAILY_LOGIN_REWARDS.length];
    grantXpAndEvaluate(rewardObj.xp, (draft) => {
      draft.claimedTodayReward = true;
      return { unlockedTitles: [] };
    });
    triggerToast('Ежедневная награда получена!', rewardObj.label);
  }, [profile.loginStreak, grantXpAndEvaluate, triggerToast]);

  const handleClaimQuest = useCallback(
    (questId: string) => {
      const targetQ = profile.dailyQuests.find((q) => q.id === questId);
      if (!targetQ || !targetQ.completed || targetQ.claimed) return;
      grantXpAndEvaluate(targetQ.rewardXp, (draft) => {
        const q = draft.dailyQuests.find((item) => item.id === questId);
        if (q) q.claimed = true;
        return { unlockedTitles: [] };
      });
      triggerToast(
        'Задание выполнено!',
        `+${targetQ.rewardXp} XP за «${targetQ.title}»`
      );
    },
    [profile.dailyQuests, grantXpAndEvaluate, triggerToast]
  );

  const handleUpdateProfile = useCallback(
    (updates: Partial<PilotProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...updates, updatedAt: Date.now() };
        syncProfileToServer(next, false);
        return next;
      });
    },
    [syncProfileToServer]
  );

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Persistent 60fps Three.js Low-Poly 3D Viewport */}
      <FlightCanvas
        screenState={screenState}
        cameraMode={cameraMode}
        weather={weather}
        wireframe={wireframe}
        isNight={isNight}
        difficulty={profile.difficulty}
        livery={profile.livery}
        remotePilots={remotePilots}
        resetSignal={resetSignal}
        onTelemetryUpdate={handleTelemetryUpdate}
        onRingCollected={handleRingCollected}
        onCrashGameOver={() => {
          syncProfileToServer(profileRef.current, false);
          setScreenState('gameover');
        }}
        onToggleCamera={() =>
          setCameraMode((prev) =>
            prev === 'chase'
              ? 'cockpit'
              : prev === 'cockpit'
                ? 'tactical'
                : prev === 'tactical'
                  ? 'cinematic'
                  : 'chase'
          )
        }
        onToggleWeather={() =>
          setWeather((prev) =>
            prev === 'clear'
              ? 'rain'
              : prev === 'rain'
                ? 'snow'
                : prev === 'snow'
                  ? 'fog'
                  : 'clear'
          )
        }
        onToggleWireframe={() => setWireframe((w) => !w)}
        onToggleNight={() => setIsNight((n) => !n)}
        onTogglePause={() =>
          setScreenState((s) =>
            s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s
          )
        }
        onTutorialStep={handleTutorialStep}
        onBroadcastLocalState={handleBroadcastLocalState}
      />

      {/* Title Screen Overlay */}
      {screenState === 'title' && (
        <TitleScreen
          profile={profile}
          hudTheme={hudTheme}
          onlineCount={remotePilots.length + 1}
          onStartFlight={() => {
            setActiveModal(null);
            setScreenState('playing');
          }}
          onOpenModal={(tab) => setActiveModal(tab)}
          onChangeDifficulty={(difficulty: DifficultyMode) =>
            handleUpdateProfile({ difficulty })
          }
          onToggleHudTheme={() =>
            setHudTheme((t) => (t === 'dark' ? 'light' : 'dark'))
          }
        />
      )}

      {/* Active Flight HUD & Collapsible Bottom Dock */}
      {screenState !== 'title' && (
        <HudOverlay
          profile={profile}
          telemetry={telemetry}
          cameraMode={cameraMode}
          weather={weather}
          wireframe={wireframe}
          isNight={isNight}
          isMuted={isMuted}
          hudTheme={hudTheme}
          tutorialFlags={tutorialFlags}
          showTutorial={!profile.tutorialCompleted}
          remotePilots={remotePilots}
          chatMessages={chatMessages}
          pendingInvite={pendingInvite}
          toastBanner={toastBanner}
          onToggleCamera={() => {
            setCameraMode((prev) =>
              prev === 'chase'
                ? 'cockpit'
                : prev === 'cockpit'
                  ? 'tactical'
                  : prev === 'tactical'
                    ? 'cinematic'
                    : 'chase'
            );
            handleTutorialStep({ toggledModeOrCamera: true });
          }}
          onToggleCinematic={() => {
            setCameraMode((prev) => (prev === 'cinematic' ? 'chase' : 'cinematic'));
            handleTutorialStep({ toggledModeOrCamera: true });
          }}
          onToggleWeather={() => {
            setWeather((prev) =>
              prev === 'clear'
                ? 'rain'
                : prev === 'rain'
                  ? 'snow'
                  : prev === 'snow'
                    ? 'fog'
                    : 'clear'
            );
            handleTutorialStep({ toggledModeOrCamera: true });
          }}
          onToggleWireframe={() => {
            setWireframe((w) => !w);
            handleTutorialStep({ toggledModeOrCamera: true });
          }}
          onToggleNight={() => {
            setIsNight((n) => !n);
            handleTutorialStep({ toggledModeOrCamera: true });
          }}
          onToggleMute={() => {
            const next = !isMuted;
            setIsMuted(next);
            soundEngine.setMuted(next);
          }}
          onToggleHudTheme={() =>
            setHudTheme((t) => (t === 'dark' ? 'light' : 'dark'))
          }
          onChangeDifficulty={(difficulty) => handleUpdateProfile({ difficulty })}
          onDismissTutorial={() =>
            handleUpdateProfile({ tutorialCompleted: true })
          }
          onOpenModal={(tab) => {
            if (screenState === 'playing') setScreenState('paused');
            setActiveModal(tab);
          }}
          onSendChat={handleSendChat}
          onSendInvite={handleSendInvite}
          onAcceptInvite={handleAcceptInvite}
          onDismissInvite={() => setPendingInvite(null)}
          onPauseGame={() =>
            setScreenState((s) => (s === 'playing' ? 'paused' : 'playing'))
          }
        />
      )}

      {/* Modals: Pause, Game Over, Leaderboard, Quests, Achievements, Profile, Cloud Sync */}
      <Modals
        screenState={screenState}
        activeModal={activeModal}
        hudTheme={hudTheme}
        profile={profile}
        leaderboard={leaderboard}
        cloudSyncStatus={cloudSyncStatus}
        onCloseModal={() => {
          setActiveModal(null);
          if (screenState === 'paused') {
            setScreenState('playing');
          }
        }}
        onSelectModalTab={(tab) => setActiveModal(tab)}
        onResumeGame={() => {
          setActiveModal(null);
          setScreenState('playing');
        }}
        onRestartFlight={() => {
          setActiveModal(null);
          setResetSignal((n) => n + 1);
          setScreenState('playing');
        }}
        onReturnToTitle={() => {
          syncProfileToServer(profileRef.current, false);
          setActiveModal(null);
          setResetSignal((n) => n + 1);
          setScreenState('title');
        }}
        onUpdateProfile={handleUpdateProfile}
        onClaimDailyLogin={handleClaimDailyLogin}
        onClaimQuest={handleClaimQuest}
        onSaveToCloud={async () => {
          await syncProfileToServer(profileRef.current, true);
        }}
        onLoadFromCloud={handleLoadFromCloud}
        onUnlockSocialAchievement={unlockSquadAchievement}
      />
    </main>
  );
}
