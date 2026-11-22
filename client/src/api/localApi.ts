// Modo demo sin servidor: replica el contrato del backend sobre localStorage.
// Pensado para probar la app en una sola tablet/navegador; NO es seguro para datos reales.

import { rankPlayers, type GameState, type SeedData } from '@roampass/shared';
import seed from '@roampass/shared/seedData.json';
import { ApiError, type PlayerStatsSummary, type RecentGame, type RoamPassApi, type User } from './types';

interface StoredUser extends User {
  salt: string;
  passwordHash: string;
  /** Foto del pasaporte como data: URL (ya achicada en el navegador, ~30 KB). */
  photo?: string;
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
const strip = ({ salt: _s, passwordHash: _p, photo: _f, ...user }: StoredUser): User => user;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function makeUser(username: string, password: string, role: User['role'], email?: string): Promise<StoredUser> {
  const salt = newId();
  return {
    id: newId(),
    username,
    role,
    isActive: true,
    // Modo demo: no se envian correos, asi que el correo cuenta como confirmado (CO-11).
    email: email ?? null,
    emailVerifiedAt: email ? new Date().toISOString() : null,
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

const demoUnavailable = () =>
  new ApiError('No disponible en el modo demo (no se envían correos).', 400, 'DEMO_UNAVAILABLE');

function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ApiError('Correo no válido', 400, 'INVALID_EMAIL');
  return value;
}

/** Usuario o correo (los usuarios no pueden tener "@"). */
function findByIdentifier(db: LocalDb, identifier: string) {
  const value = identifier.trim();
  return value.includes('@') ? db.users.find((u) => u.email === value.toLowerCase()) : db.users.find((u) => u.username === value);
}

function validateCredentials(username: string, password: string) {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username.trim())) {
    throw new ApiError('Usuario: 3-24 caracteres (letras, numeros, . _ -)', 400, 'INVALID_USERNAME');
  }
  if (password.length < 6) throw new ApiError('La contraseña debe tener al menos 6 caracteres', 400, 'PASSWORD_TOO_SHORT');
}

export function createLocalApi(getToken: () => string | null): RoamPassApi {
  async function currentUser(db: LocalDb): Promise<StoredUser> {
    const id = getToken()?.replace(/^local:/, '');
    const user = db.users.find((u) => u.id === id);
    if (!user || !user.isActive) throw new ApiError('Sesion invalida o cuenta desactivada', 401, 'SESSION_INVALID');
    return user;
  }
  async function requireAdmin(db: LocalDb) {
    const user = await currentUser(db);
    if (user.role !== 'ADMIN') throw new ApiError('Solo administradores', 403, 'FORBIDDEN');
    return user;
  }
  const session = (u: StoredUser) => ({ token: `local:${u.id}`, user: strip(u) });

  return {
    mode: 'local',

    async login(identifier, password) {
      const db = await load();
      const user = findByIdentifier(db, identifier);
      if (!user || (await hash(password, user.salt)) !== user.passwordHash) {
        throw new ApiError('Usuario o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
      }
      if (!user.isActive) throw new ApiError('Cuenta desactivada. Contacta a un administrador.', 403, 'ACCOUNT_INACTIVE');
      return session(user);
    },

    async register({ username, email, password, locale }) {
      validateCredentials(username, password);
      const mail = normalizeEmail(email);
      const db = await load();
      if (db.users.some((u) => u.username === username.trim())) {
        throw new ApiError('Ese nombre de usuario ya está en uso', 409, 'USERNAME_TAKEN');
      }
      if (db.users.some((u) => u.email === mail)) throw new ApiError('Ese correo ya está registrado', 409, 'EMAIL_TAKEN');
      const user = await makeUser(username.trim(), password, 'PLAYER', mail);
      if (locale) user.locale = locale;
      db.users.push(user);
      save(db);
      return session(user);
    },

    async verifyEmail() {
      throw demoUnavailable();
    },
    async resendVerification() {
      throw demoUnavailable();
    },
    async forgotPassword() {
      throw demoUnavailable();
    },
    async resetPassword() {
      throw demoUnavailable();
    },

    async me() {
      return strip(await currentUser(await load()));
    },

    async updateMe({ theme, locale, currentPassword, newPassword, email }) {
      const db = await load();
      const user = await currentUser(db);
      const mail = email === undefined ? undefined : normalizeEmail(email);
      const changingEmail = mail !== undefined && mail !== user.email;
      if (newPassword || changingEmail) {
        if (!currentPassword || (await hash(currentPassword, user.salt)) !== user.passwordHash) {
          throw new ApiError('La contraseña actual no es correcta', 400, 'WRONG_PASSWORD');
        }
      }
      if (changingEmail) {
        if (db.users.some((u) => u.id !== user.id && u.email === mail)) {
          throw new ApiError('Ese correo ya está registrado', 409, 'EMAIL_TAKEN');
        }
        // Sin correos en el modo demo: el cambio se aplica directo.
        user.email = mail;
        user.emailVerifiedAt = new Date().toISOString();
      }
      if (newPassword) {
        validateCredentials(user.username, newPassword);
        user.passwordHash = await hash(newPassword, user.salt);
      }
      if (theme) user.theme = theme;
      if (locale) user.locale = locale;
      save(db);
      return strip(user);
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
      if (db.users.some((u) => u.username === username.trim())) throw new ApiError('El usuario ya existe', 409, 'USERNAME_TAKEN');
      const user = await makeUser(username.trim(), password, role);
      db.users.push(user);
      save(db);
      return strip(user);
    },

    async updateUser(id, data) {
      const db = await load();
      const admin = await requireAdmin(db);
      if (id === admin.id && (data.isActive === false || data.role === 'PLAYER')) {
        throw new ApiError('No puedes desactivarte ni quitarte el rol ADMIN a ti mismo', 400, 'CANNOT_CHANGE_SELF');
      }
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new ApiError('No encontrado', 404, 'NOT_FOUND');
      if (data.username !== undefined) {
        validateCredentials(data.username, data.password ?? 'xxxxxx');
        if (db.users.some((u) => u.id !== id && u.username === data.username)) {
          throw new ApiError('El usuario ya existe', 409, 'USERNAME_TAKEN');
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
      if (id === admin.id) throw new ApiError('No puedes eliminar tu propia cuenta', 400, 'CANNOT_DELETE_SELF');
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

    async deleteGame(id) {
      const db = await load();
      const user = await currentUser(db);
      const game = db.games[id];
      if (!game) throw new ApiError('La partida no existe', 404, 'GAME_NOT_FOUND');
      if (user.role !== 'ADMIN' && game.hostId !== user.id) throw new ApiError('Solo quien creó la partida puede eliminarla', 403, 'GAME_FORBIDDEN');
      delete db.games[id];
      save(db);
    },

    async getRecentGames(limit = 12): Promise<RecentGame[]> {
      const db = await load();
      const user = await currentUser(db);
      const names = new Map(db.users.map((u) => [u.id, u.username]));
      return Object.values(db.games)
        .filter((g) => user.role === 'ADMIN' || g.hostId === user.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map(({ hostId, selfPlayerId, state }) => {
          const winners = new Set(state.winnerIds ?? []);
          return {
            id: state.id,
            host: names.get(hostId) ?? '—',
            status: state.status,
            mode: state.config.mode,
            target: state.config.target,
            board: state.config.board ?? 'PHYSICAL',
            round: state.round,
            startedAt: state.createdAt,
            finishedAt: state.finishedAt ?? null,
            canDelete: user.role === 'ADMIN' || hostId === user.id,
            players: rankPlayers(state.players).map(({ player: p }) => ({
              name: p.name,
              color: p.color,
              avatar: p.avatar,
              score: p.score,
              isWinner: winners.has(p.id),
              username: p.id === selfPlayerId ? (names.get(hostId) ?? null) : null,
            })),
          };
        });
    },

    async uploadPhoto(image) {
      const db = await load();
      const user = await currentUser(db);
      user.photo = await toDataUrl(image);
      user.photoUpdatedAt = new Date().toISOString();
      save(db);
      return strip(user);
    },

    async deleteMyPhoto() {
      const db = await load();
      const user = await currentUser(db);
      delete user.photo;
      user.photoUpdatedAt = null;
      save(db);
      return strip(user);
    },

    async deleteMyAccount(password) {
      const db = await load();
      const user = await currentUser(db);
      if ((await hash(password, user.salt)) !== user.passwordHash) {
        throw new ApiError('La contraseña no es correcta', 400, 'WRONG_PASSWORD');
      }
      if (user.role === 'ADMIN' && db.users.filter((u) => u.role === 'ADMIN' && u.isActive).length <= 1) {
        throw new ApiError('Eres el único administrador', 409, 'LAST_ADMIN');
      }
      db.users = db.users.filter((u) => u.id !== user.id);
      save(db);
    },

    getAppConfig: async () => null,

    async deleteUserPhoto(userId) {
      const db = await load();
      await requireAdmin(db);
      const user = db.users.find((u) => u.id === userId);
      if (!user) throw new ApiError('No encontrado', 404, 'NOT_FOUND');
      delete user.photo;
      user.photoUpdatedAt = null;
      save(db);
      return strip(user);
    },

    // El modo online necesita el servidor (sockets, timers): en el modo demo no esta disponible.
    searchUsers: async () => [],
    createOnlineGame: async () => {
      throw demoUnavailable();
    },
    getCurrentOnline: async () => null,
    cancelOnlineGame: async () => {
      throw demoUnavailable();
    },
    leaveOnlineLobby: async () => {
      throw demoUnavailable();
    },
    inviteToOnline: async () => {
      throw demoUnavailable();
    },
    inviteToOnlineByEmail: async () => {
      throw demoUnavailable();
    },
    listSentInvites: async () => ({ users: [], emails: [] }),
    listInvites: async () => [],
    acceptInvite: async () => {
      throw demoUnavailable();
    },
    declineInvite: async () => {
      throw demoUnavailable();
    },
    cancelInvite: async () => {
      throw demoUnavailable();
    },
    rejoinOnline: async () => {
      throw demoUnavailable();
    },
    hideOnline: async () => {
      throw demoUnavailable();
    },
    getStreetViewPhoto: async () => null,

    // Las invitaciones por correo necesitan el servidor (envio de correos).
    inviteFriend: async () => {
      throw demoUnavailable();
    },
    listMyEmailInvites: async () => [],
    getEmailInvite: async () => {
      throw demoUnavailable();
    },
    optOutInvites: async () => {
      throw demoUnavailable();
    },
    listEmailInvites: async () => [],
    getEmailInviteStats: async () => {
      throw demoUnavailable();
    },

    async getPhotoUrl(userId) {
      const db = await load();
      await currentUser(db);
      return db.users.find((u) => u.id === userId)?.photo ?? null;
    },
  };
}
