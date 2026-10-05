// Modo demo sin servidor: replica el contrato del backend sobre localStorage.
// Pensado para probar la app en una sola tablet/navegador; NO es seguro para datos reales.

import { rankPlayers, type GameState, type SeedData } from '@roampass/shared';
import seed from '@roampass/shared/seedData.json';
import { ApiError, type PlayerStatsSummary, type RoamPassApi, type User } from './types';

interface StoredUser extends User {
  salt: string;
  passwordHash: string;
}
interface StoredGame {
  hostId: string;
  selfPlayerId: string | null;
  state: GameState;
  updatedAt: string;
}
interface LocalDb {
  users: StoredUser[];
  games: Record<string, StoredGame>;
}

const DB_KEY = 'roampass-local-db';
export const DEMO_ADMIN = { username: 'admin', password: 'roampass' };

async function hash(password: string, salt: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const newId = () => crypto.randomUUID();
const strip = ({ salt: _s, passwordHash: _p, ...user }: StoredUser): User => user;

async function makeUser(username: string, password: string, role: User['role']): Promise<StoredUser> {
  const salt = newId();
  return {
    id: newId(),
    username,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hash(password, salt),
  };
}

async function load(): Promise<LocalDb> {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as LocalDb;
  } catch {
    // localStorage corrupto o bloqueado: se reinicia la base demo
  }
  const db: LocalDb = { users: [await makeUser(DEMO_ADMIN.username, DEMO_ADMIN.password, 'ADMIN')], games: {} };
  save(db);
  return db;
}

function save(db: LocalDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function validateCredentials(username: string, password: string) {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username.trim())) {
    throw new ApiError('Usuario: 3-24 caracteres (letras, numeros, . _ -)', 400);
  }
  if (password.length < 6) throw new ApiError('La contraseña debe tener al menos 6 caracteres', 400);
}

export function createLocalApi(getToken: () => string | null): RoamPassApi {
  async function currentUser(db: LocalDb): Promise<StoredUser> {
    const id = getToken()?.replace(/^local:/, '');
    const user = db.users.find((u) => u.id === id);
    if (!user || !user.isActive) throw new ApiError('Sesion invalida o cuenta desactivada', 401);
    return user;
  }
  async function requireAdmin(db: LocalDb) {
    const user = await currentUser(db);
    if (user.role !== 'ADMIN') throw new ApiError('Solo administradores', 403);
    return user;
  }
  const session = (u: StoredUser) => ({ token: `local:${u.id}`, user: strip(u) });

  return {
    mode: 'local',

    async login(username, password) {
      const db = await load();
      const user = db.users.find((u) => u.username === username.trim());
      if (!user || (await hash(password, user.salt)) !== user.passwordHash) {
        throw new ApiError('Usuario o contraseña incorrectos', 401);
      }
      if (!user.isActive) throw new ApiError('Cuenta desactivada. Contacta a un administrador.', 403);
      return session(user);
    },

    async register(username, password) {
      validateCredentials(username, password);
      const db = await load();
      if (db.users.some((u) => u.username === username.trim())) throw new ApiError('El usuario ya existe', 409);
      const user = await makeUser(username.trim(), password, 'PLAYER');
      db.users.push(user);
      save(db);
      return session(user);
    },

    async me() {
      return strip(await currentUser(await load()));
    },

    async listUsers() {
      const db = await load();
      await requireAdmin(db);
      const hosted = (id: string) => Object.values(db.games).filter((g) => g.hostId === id).length;
      return db.users.map((u) => ({ ...strip(u), gamesHosted: hosted(u.id) }));
    },

    async createUser({ username, password, role }) {
      validateCredentials(username, password);
      const db = await load();
      await requireAdmin(db);
      if (db.users.some((u) => u.username === username.trim())) throw new ApiError('El usuario ya existe', 409);
      const user = await makeUser(username.trim(), password, role);
      db.users.push(user);
      save(db);
      return strip(user);
    },

    async updateUser(id, data) {
      const db = await load();
      const admin = await requireAdmin(db);
      if (id === admin.id && (data.isActive === false || data.role === 'PLAYER')) {
        throw new ApiError('No puedes desactivarte ni quitarte el rol ADMIN a ti mismo', 400);
      }
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new ApiError('No encontrado', 404);
      if (data.username !== undefined) {
        validateCredentials(data.username, data.password ?? 'xxxxxx');
        if (db.users.some((u) => u.id !== id && u.username === data.username)) {
          throw new ApiError('El usuario ya existe', 409);
        }
        user.username = data.username.trim();
      }
      if (data.password) {
        validateCredentials(user.username, data.password);
        user.passwordHash = await hash(data.password, user.salt);
      }
      if (data.role) user.role = data.role;
      if (data.isActive !== undefined) user.isActive = data.isActive;
      save(db);
      return strip(user);
    },

    async deleteUser(id) {
      const db = await load();
      const admin = await requireAdmin(db);
      if (id === admin.id) throw new ApiError('No puedes eliminar tu propia cuenta', 400);
      db.users = db.users.filter((u) => u.id !== id);
      save(db);
    },

    async getCards() {
      return (seed as SeedData).cards;
    },

    async saveGame(state, selfPlayerId) {
      const db = await load();
      const user = await currentUser(db);
      db.games[state.id] = { hostId: user.id, selfPlayerId, state, updatedAt: new Date().toISOString() };
      save(db);
    },

    async getActiveGame() {
      const db = await load();
      const user = await currentUser(db);
      const active = Object.values(db.games)
        .filter((g) => g.hostId === user.id && g.state.status === 'PLAYING')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return active[0]?.state ?? null;
    },

    async getMyStats(): Promise<PlayerStatsSummary> {
      const db = await load();
      const user = await currentUser(db);
      const mine = Object.values(db.games).filter((g) => g.hostId === user.id && g.state.status === 'FINISHED');
      let gamesWon = 0;
      let bestScore = 0;
      for (const g of mine) {
        const me = g.state.players.find((p) => p.id === g.selfPlayerId);
        if (!me) continue;
        bestScore = Math.max(bestScore, me.score);
        if (rankPlayers(g.state.players).some((r) => r.position === 1 && r.player.id === me.id)) gamesWon++;
      }
      return { gamesPlayed: mine.length, gamesWon, bestScore };
    },
  };
}
