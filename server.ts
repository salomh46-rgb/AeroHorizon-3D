import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_FILE = path.join(__dirname, '.aerohorizon_store.json');

interface StoredLeaderboardEntry {
  id: string;
  callsign: string;
  emblem: string;
  level: number;
  highScore: number;
  rating: number;
  totalRings: number;
  difficulty: 'arcade' | 'normal' | 'simulation';
  platform: string;
  updatedAt: number;
}

interface StoredChatMessage {
  id: string;
  senderId: string;
  callsign: string;
  emblem: string;
  room: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface ServerStore {
  cloudSaves: Record<string, any>;
  leaderboard: Record<string, StoredLeaderboardEntry>;
  chatHistory: StoredChatMessage[];
}

// Initial competitive leaderboard entries from real format
const SEED_LEADERBOARD: Record<string, StoredLeaderboardEntry> = {
  'pilot-vortex': {
    id: 'pilot-vortex',
    callsign: 'VORTEX-01',
    emblem: '🦅',
    level: 9,
    highScore: 18450,
    rating: 2140,
    totalRings: 142,
    difficulty: 'simulation',
    platform: 'Gamepad',
    updatedAt: Date.now() - 3600_000 * 3,
  },
  'pilot-astra': {
    id: 'pilot-astra',
    callsign: 'ASTRA_SKY',
    emblem: '⚡',
    level: 7,
    highScore: 14200,
    rating: 1890,
    totalRings: 98,
    difficulty: 'normal',
    platform: 'PC',
    updatedAt: Date.now() - 3600_000 * 5,
  },
  'pilot-kestrel': {
    id: 'pilot-kestrel',
    callsign: 'KESTREL_RU',
    emblem: '🛰️',
    level: 6,
    highScore: 11850,
    rating: 1725,
    totalRings: 84,
    difficulty: 'normal',
    platform: 'PC',
    updatedAt: Date.now() - 3600_000 * 8,
  },
  'pilot-helios': {
    id: 'pilot-helios',
    callsign: 'HELIOS_7',
    emblem: '🔥',
    level: 5,
    highScore: 9300,
    rating: 1560,
    totalRings: 63,
    difficulty: 'arcade',
    platform: 'Web',
    updatedAt: Date.now() - 3600_000 * 12,
  },
};

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        cloudSaves: parsed.cloudSaves || {},
        leaderboard: { ...SEED_LEADERBOARD, ...(parsed.leaderboard || {}) },
        chatHistory: parsed.chatHistory || [],
      };
    }
  } catch (err) {
    console.error('Failed to read store file, initializing default:', err);
  }
  return {
    cloudSaves: {},
    leaderboard: { ...SEED_LEADERBOARD },
    chatHistory: [
      {
        id: 'sys-welcome-1',
        senderId: 'system',
        callsign: 'ДИСПЕТЧЕР',
        emblem: '📡',
        room: 'global',
        text: 'Добро пожаловать в воздушное пространство AeroHorizon! Частота открыта для всех пилотов.',
        timestamp: Date.now() - 60000,
        isSystem: true,
      },
    ],
  };
}

const store: ServerStore = loadStore();

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

interface ConnectedPilot {
  ws: WebSocket;
  id: string;
  callsign: string;
  emblem: string;
  livery: string;
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

const activePilots = new Map<string, ConnectedPilot>();

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '1mb' }));

  // --- REST API: Cloud Saves & Cross-Platform Sync ---
  app.get('/api/cloud-save/:syncCode', (req, res) => {
    const code = String(req.params.syncCode || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Sync code is required' });
      return;
    }
    const profile = store.cloudSaves[code];
    if (!profile) {
      res.status(404).json({ error: 'Облачное сохранение с таким кодом не найдено' });
      return;
    }
    res.json({ ok: true, profile });
  });

  app.post('/api/cloud-save', (req, res) => {
    const profile = req.body?.profile;
    if (!profile || !profile.syncCode) {
      res.status(400).json({ error: 'Invalid profile payload' });
      return;
    }
    const code = String(profile.syncCode).trim().toUpperCase();
    const savedProfile = {
      ...profile,
      syncCode: code,
      updatedAt: Date.now(),
    };
    store.cloudSaves[code] = savedProfile;

    // Also update leaderboard automatically when saving profile
    const diffMult =
      savedProfile.difficulty === 'simulation'
        ? 1.35
        : savedProfile.difficulty === 'normal'
          ? 1.15
          : 1.0;
    const computedRating = Math.max(
      1000,
      Math.round(
        1000 +
          (savedProfile.highScore || 0) * 0.045 * diffMult +
          (savedProfile.totalRings || 0) * 4 +
          (savedProfile.level || 1) * 45
      )
    );
    savedProfile.rating = computedRating;

    store.leaderboard[savedProfile.id] = {
      id: savedProfile.id,
      callsign: savedProfile.callsign || 'ПИЛОТ',
      emblem: savedProfile.emblem || '✈️',
      level: savedProfile.level || 1,
      highScore: savedProfile.highScore || 0,
      rating: computedRating,
      totalRings: savedProfile.totalRings || 0,
      difficulty: savedProfile.difficulty || 'normal',
      platform: savedProfile.platform || 'PC',
      updatedAt: Date.now(),
    };

    saveStore();
    res.json({
      ok: true,
      syncCode: code,
      rating: computedRating,
      updatedAt: savedProfile.updatedAt,
    });
  });

  // --- REST API: Global Leaderboard ---
  app.get('/api/leaderboard', (_req, res) => {
    const list = Object.values(store.leaderboard)
      .sort((a, b) => b.rating - a.rating || b.highScore - a.highScore)
      .slice(0, 30);
    res.json({ ok: true, entries: list });
  });

  app.post('/api/leaderboard', (req, res) => {
    const entry = req.body;
    if (!entry || !entry.id) {
      res.status(400).json({ error: 'Invalid leaderboard payload' });
      return;
    }
    const existing = store.leaderboard[entry.id];
    const highScore = Math.max(existing?.highScore || 0, Number(entry.highScore) || 0);
    const totalRings = Math.max(existing?.totalRings || 0, Number(entry.totalRings) || 0);
    const level = Math.max(existing?.level || 1, Number(entry.level) || 1);
    const difficulty = entry.difficulty || existing?.difficulty || 'normal';
    const diffMult =
      difficulty === 'simulation' ? 1.35 : difficulty === 'normal' ? 1.15 : 1.0;
    const rating = Math.max(
      existing?.rating || 1000,
      Math.round(1000 + highScore * 0.045 * diffMult + totalRings * 4 + level * 45)
    );

    store.leaderboard[entry.id] = {
      id: entry.id,
      callsign: String(entry.callsign || 'ПИЛОТ').slice(0, 18),
      emblem: String(entry.emblem || '✈️'),
      level,
      highScore,
      rating,
      totalRings,
      difficulty,
      platform: String(entry.platform || 'PC'),
      updatedAt: Date.now(),
    };

    saveStore();
    const list = Object.values(store.leaderboard)
      .sort((a, b) => b.rating - a.rating || b.highScore - a.highScore)
      .slice(0, 30);
    res.json({ ok: true, rating, entries: list });
  });

  // --- WebSocket Server for Real-Time Multiplayer, Chat & Invites ---
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastAll(payload: unknown, excludeWs?: WebSocket) {
    const raw = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  function getSerializablePilots() {
    return Array.from(activePilots.values()).map((p) => ({
      id: p.id,
      callsign: p.callsign,
      emblem: p.emblem,
      livery: p.livery,
      platform: p.platform,
      level: p.level,
      rating: p.rating,
      room: p.room,
      x: p.x,
      y: p.y,
      z: p.z,
      pitch: p.pitch,
      yaw: p.yaw,
      roll: p.roll,
      speed: p.speed,
      updatedAt: p.updatedAt,
    }));
  }

  wss.on('connection', (ws) => {
    let currentPilotId: string | null = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'pilot:join') {
          const p = msg.pilot || {};
          const id = String(p.id || `pilot-${Math.random().toString(36).slice(2, 8)}`);
          currentPilotId = id;

          const pilotRecord: ConnectedPilot = {
            ws,
            id,
            callsign: String(p.callsign || 'СОКОЛ-1').slice(0, 18),
            emblem: String(p.emblem || '✈️'),
            livery: String(p.livery || 'amber'),
            platform: String(p.platform || 'PC'),
            level: Number(p.level) || 1,
            rating: Number(p.rating) || 1200,
            room: String(p.room || 'global'),
            x: Number(p.x) || 0,
            y: Number(p.y) || 65,
            z: Number(p.z) || 0,
            pitch: Number(p.pitch) || 0,
            yaw: Number(p.yaw) || 0,
            roll: Number(p.roll) || 0,
            speed: Number(p.speed) || 180,
            updatedAt: Date.now(),
          };
          activePilots.set(id, pilotRecord);

          // Send initial authoritative state to newly connected client
          ws.send(
            JSON.stringify({
              type: 'init:state',
              pilots: getSerializablePilots(),
              chatHistory: store.chatHistory.slice(-40),
              leaderboard: Object.values(store.leaderboard)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 20),
            })
          );

          // Notify everyone of pilot join
          broadcastAll(
            {
              type: 'pilot:joined',
              pilot: {
                id: pilotRecord.id,
                callsign: pilotRecord.callsign,
                emblem: pilotRecord.emblem,
                livery: pilotRecord.livery,
                platform: pilotRecord.platform,
                level: pilotRecord.level,
                rating: pilotRecord.rating,
                room: pilotRecord.room,
                x: pilotRecord.x,
                y: pilotRecord.y,
                z: pilotRecord.z,
                pitch: pilotRecord.pitch,
                yaw: pilotRecord.yaw,
                roll: pilotRecord.roll,
                speed: pilotRecord.speed,
                updatedAt: pilotRecord.updatedAt,
              },
            },
            ws
          );
        } else if (msg.type === 'pilot:state' && currentPilotId) {
          const existing = activePilots.get(currentPilotId);
          if (existing) {
            existing.x = Number(msg.x) || 0;
            existing.y = Number(msg.y) || 60;
            existing.z = Number(msg.z) || 0;
            existing.pitch = Number(msg.pitch) || 0;
            existing.yaw = Number(msg.yaw) || 0;
            existing.roll = Number(msg.roll) || 0;
            existing.speed = Number(msg.speed) || 0;
            if (msg.callsign) existing.callsign = String(msg.callsign).slice(0, 18);
            if (msg.livery) existing.livery = String(msg.livery);
            if (msg.level) existing.level = Number(msg.level);
            if (msg.platform) existing.platform = String(msg.platform);
            if (msg.room) existing.room = String(msg.room);
            existing.updatedAt = Date.now();

            broadcastAll(
              {
                type: 'pilot:updated',
                pilot: {
                  id: existing.id,
                  callsign: existing.callsign,
                  emblem: existing.emblem,
                  livery: existing.livery,
                  platform: existing.platform,
                  level: existing.level,
                  rating: existing.rating,
                  room: existing.room,
                  x: existing.x,
                  y: existing.y,
                  z: existing.z,
                  pitch: existing.pitch,
                  yaw: existing.yaw,
                  roll: existing.roll,
                  speed: existing.speed,
                  updatedAt: existing.updatedAt,
                },
              },
              ws
            );
          }
        } else if (msg.type === 'chat:send') {
          const chatItem: StoredChatMessage = {
            id: String(msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
            senderId: String(msg.senderId || currentPilotId || 'anon'),
            callsign: String(msg.callsign || 'ПИЛОТ').slice(0, 18),
            emblem: String(msg.emblem || '✈️'),
            room: String(msg.room || 'global'),
            text: String(msg.text || '').trim().slice(0, 240),
            timestamp: Date.now(),
            isSystem: Boolean(msg.isSystem),
          };
          if (!chatItem.text) return;

          // Idempotency guard
          if (!store.chatHistory.some((m) => m.id === chatItem.id)) {
            store.chatHistory.push(chatItem);
            if (store.chatHistory.length > 60) {
              store.chatHistory = store.chatHistory.slice(-60);
            }
            saveStore();
          }

          broadcastAll({
            type: 'chat:message',
            message: chatItem,
          });
        } else if (msg.type === 'invite:send') {
          const invitePayload = {
            id: String(msg.id || `inv-${Date.now()}`),
            fromId: String(msg.fromId || currentPilotId || ''),
            fromCallsign: String(msg.fromCallsign || 'ПИЛОТ'),
            fromLevel: Number(msg.fromLevel) || 1,
            toId: String(msg.toId || 'all'),
            room: String(msg.room || 'alpha-wing'),
            difficulty: msg.difficulty || 'normal',
            timestamp: Date.now(),
          };

          broadcastAll({
            type: 'invite:received',
            invite: invitePayload,
          });
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (currentPilotId && activePilots.has(currentPilotId)) {
        activePilots.delete(currentPilotId);
        broadcastAll({
          type: 'pilot:left',
          pilotId: currentPilotId,
        });
      }
    });
  });

  // Periodic stale pilot cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [id, pilot] of activePilots.entries()) {
      if (now - pilot.updatedAt > 45000) {
        activePilots.delete(id);
        broadcastAll({ type: 'pilot:left', pilotId: id });
      }
    }
  }, 15000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AeroHorizon 3D Server + WebSocket listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
