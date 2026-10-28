export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'chase' | 'cockpit' | 'tactical' | 'cinematic';

export type WeatherMode = 'clear' | 'rain' | 'snow' | 'fog';

export type DifficultyMode = 'arcade' | 'normal' | 'simulation';

export type LiveryId = 'amber' | 'cobalt' | 'emerald' | 'crimson';

export type HudTheme = 'dark' | 'light';

export type ModalTab =
  | null
  | 'leaderboard'
  | 'quests'
  | 'achievements'
  | 'profile'
  | 'cloud'
  | 'multiplayer';

export interface LiverySpec {
  id: LiveryId;
  name: string;
  primaryHex: number;
  secondaryHex: number;
  accentHex: number;
  cssColor: string;
}

export const LIVERIES: Record<LiveryId, LiverySpec> = {
  amber: {
    id: 'amber',
    name: 'Солнечный Зенит',
    primaryHex: 0xf59e0b,
    secondaryHex: 0x1e293b,
    accentHex: 0x38bdf8,
    cssColor: '#f59e0b',
  },
  cobalt: {
    id: 'cobalt',
    name: 'Кобальт Вектор',
    primaryHex: 0x0ea5e9,
    secondaryHex: 0x0f172a,
    accentHex: 0xf43f5e,
    cssColor: '#0ea5e9',
  },
  emerald: {
    id: 'emerald',
    name: 'Изумрудный Стелс',
    primaryHex: 0x10b981,
    secondaryHex: 0x111827,
    accentHex: 0xfacc15,
    cssColor: '#10b981',
  },
  crimson: {
    id: 'crimson',
    name: 'Багровый Ас',
    primaryHex: 0xef4444,
    secondaryHex: 0x18181b,
    accentHex: 0xfbbf24,
    cssColor: '#ef4444',
  },
};

export interface Achievement {
  id: string;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export interface PilotProfile {
  id: string;
  syncCode: string;
  callsign: string;
  emblem: string;
  bio: string;
  livery: LiveryId;
  platform: 'PC' | 'Gamepad' | 'Web';
  level: number;
  xp: number;
  score: number;
  highScore: number;
  rating: number;
  totalRings: number;
  totalFlightSeconds: number;
  maxSpeedReached: number;
  loginStreak: number;
  lastLoginDate: string;
  claimedTodayReward: boolean;
  tutorialCompleted: boolean;
  difficulty: DifficultyMode;
  achievements: Achievement[];
  dailyQuests: DailyQuest[];
  updatedAt: number;
}

export interface FlightTelemetry {
  speedKmh: number;
  altitudeM: number;
  groundClearanceM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  throttlePct: number;
  hullPct: number;
  boostPct: number;
  score: number;
  combo: number;
  ringsCollected: number;
  nextRingDistanceM: number;
  nextRingBearingDeg: number;
  gamepadConnected: boolean;
  gamepadName: string;
  biomeName: string;
  weather: WeatherMode;
  windDriftKmh: number;
}

export interface RemotePilot {
  id: string;
  callsign: string;
  emblem: string;
  livery: LiveryId;
  platform: string;
  level: number;
  rating: number;
  room: string;
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
  speed: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  callsign: string;
  emblem: string;
  room: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface GameInvite {
  id: string;
  fromId: string;
  fromCallsign: string;
  fromLevel: number;
  toId: string; // 'all' or specific pilot id
  room: string;
  difficulty: DifficultyMode;
  timestamp: number;
}

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  emblem: string;
  level: number;
  highScore: number;
  rating: number;
  totalRings: number;
  difficulty: DifficultyMode;
  platform: string;
  updatedAt: number;
}

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_takeoff',
    title: 'Первый взлёт',
    description: 'Наберите скорость свыше 200 км/ч и поднимитесь в небо',
    progress: 0,
    maxProgress: 200,
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'ring_master_10',
    title: 'Навигатор каньонов',
    description: 'Пролетите сквозь 10 навигационных колец',
    progress: 0,
    maxProgress: 10,
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'supersonic_ace',
    title: 'Сверхзвуковой рубеж',
    description: 'Разгонитесь до 420 км/ч на форсаже',
    progress: 0,
    maxProgress: 420,
    unlocked: false,
    xpReward: 400,
  },
  {
    id: 'low_flyer',
    title: 'Бреющий полёт',
    description: 'Пройдите 3 кольца на высоте менее 45 метров над рельефом',
    progress: 0,
    maxProgress: 3,
    unlocked: false,
    xpReward: 350,
  },
  {
    id: 'night_owl',
    title: 'Ночной перехватчик',
    description: 'Пройдите 5 колец в режиме ночного освещения',
    progress: 0,
    maxProgress: 5,
    unlocked: false,
    xpReward: 250,
  },
  {
    id: 'wireframe_architect',
    title: 'Цифровой картограф',
    description: 'Пролетите через 3 кольца в каркасном режиме рельефа',
    progress: 0,
    maxProgress: 3,
    unlocked: false,
    xpReward: 250,
  },
  {
    id: 'high_altitude',
    title: 'Покоритель стратосферы',
    description: 'Поднимитесь на высоту 220 метров над уровнем долины',
    progress: 0,
    maxProgress: 220,
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'squad_comms',
    title: 'Связь в эфире',
    description: 'Отправьте сообщение в лётный чат или пригласите пилота',
    progress: 0,
    maxProgress: 1,
    unlocked: false,
    xpReward: 200,
  },
];

export const INITIAL_DAILY_QUESTS: DailyQuest[] = [
  {
    id: 'dq_rings_5',
    title: 'Патруль маршрута',
    description: 'Пролетите через 5 контрольных колец за сессию',
    progress: 0,
    target: 5,
    rewardXp: 250,
    completed: false,
    claimed: false,
  },
  {
    id: 'dq_speed_350',
    title: 'Испытание тяги',
    description: 'Развейте скорость не менее 350 км/ч',
    progress: 0,
    target: 350,
    rewardXp: 200,
    completed: false,
    claimed: false,
  },
  {
    id: 'dq_flight_time',
    title: 'Налёт часов',
    description: 'Проведите в активном полёте 60 секунд без крушений',
    progress: 0,
    target: 60,
    rewardXp: 300,
    completed: false,
    claimed: false,
  },
];

export const DAILY_LOGIN_REWARDS = [
  { day: 1, xp: 150, label: '+150 XP Набор курсанта' },
  { day: 2, xp: 250, label: '+250 XP Топливный буст' },
  { day: 3, xp: 350, label: '+350 XP Ливрея Кобальт' },
  { day: 4, xp: 450, label: '+450 XP Радарные сигнатуры' },
  { day: 5, xp: 600, label: '+600 XP Титул Навигатора' },
  { day: 6, xp: 800, label: '+800 XP Форсажный модуль' },
  { day: 7, xp: 1200, label: '+1200 XP Элита Горизонта' },
];

export function xpRequiredForLevel(level: number): number {
  return Math.floor(400 * Math.pow(1.22, level - 1));
}
