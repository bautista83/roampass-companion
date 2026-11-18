import type { BoardMode, Card, GameState, InviteSummary, Locale, OnlinePhase, PawnColor, Role, UiTheme, VictoryMode } from '@roampass/shared';
import { translateError } from '../i18n';

export interface User {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
  /** Estilo visual del perfil. Los usuarios anteriores a esta opcion no lo tienen: COMIC. */
  theme?: UiTheme;
  /** Idioma de la app y de los correos. */
  locale?: Locale;
  /** Fecha de la foto del pasaporte (cambia con cada foto nueva). null/undefined = sin foto. */
  photoUpdatedAt?: string | null;
  /** Correo (minusculas). null en cuentas anteriores al registro con correo o creadas por el admin. */
  email?: string | null;
  /** null con correo = registro sin confirmar. */
  emailVerifiedAt?: string | null;
  /** Correo nuevo pedido en Mi perfil, hasta confirmarlo con el enlace. */
  pendingEmail?: string | null;
  createdAt: string;
  gamesHosted?: number;
}

/** Lo que cada usuario puede cambiar de su propio perfil. */
export interface ProfileUpdate {
  theme?: UiTheme;
  locale?: Locale;
  /** Obligatoria para cambiar la contraseña o el correo. */
  currentPassword?: string;
  newPassword?: string;
  /** Correo nuevo: queda pendiente hasta abrir el enlace que le llega. */
  email?: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  /** Token de Turnstile (solo si el captcha esta activo). */
  captchaToken?: string;
  /** Idioma de la app al registrarse (para los correos). */
  locale?: Locale;
}

export interface AuthSession {
  token: string;
  user: User;
}

/** Registro con backend: la cuenta queda pendiente hasta confirmar el correo. */
export interface PendingRegistration {
  pending: true;
  message: string;
}

/** El modo demo inicia sesion directo; el backend devuelve una solicitud pendiente. */
export type RegisterResult = AuthSession | PendingRegistration;

export interface PlayerStatsSummary {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number;
}

/** Resumen de una partida para la grilla de "Ultimas partidas" del panel. */
export interface RecentGame {
  id: string;
  /** Usuario que creo la partida (el admin ve las de todos). */
  host: string;
  status: 'PLAYING' | 'FINISHED';
  mode: VictoryMode;
  target: number;
  board: BoardMode;
  round: number;
  startedAt: string;
  finishedAt: string | null;
  /** Partida online multijugador. */
  online?: boolean;
  /** Puede eliminarla: quien la creo (locales) o un admin. */
  canDelete: boolean;
  /** Online: cada participante la puede ocultar de su panel. */
  canHide?: boolean;
  /** Ordenados por millas (de mayor a menor). */
  players: {
    name: string;
    color: PawnColor;
    avatar: string;
    score: number;
    isWinner: boolean;
    /** Usuario registrado que jugo con este peon, si lo hay. */
    username: string | null;
  }[];
}

/** Configuracion de una sala online nueva. */
export interface OnlineGameSetup {
  mode: VictoryMode;
  target: number;
  timerSeconds: number;
  dieTimeoutSeconds: number;
  color: PawnColor;
  avatar: string;
}

export interface SentInvite {
  id: string;
  username: string;
  initialMiles: number;
  expiresAt: string;
}

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
  /** Confirmar el correo a mano (si el mensaje no llego). */
  emailVerified?: true;
}

/**
 * Contrato del backend. Hay dos implementaciones intercambiables:
 * - httpApi: Express + Prisma + PostgreSQL (server/)
 * - localApi: modo demo sin servidor, persiste en localStorage
 */
export interface RoamPassApi {
  readonly mode: 'remote' | 'local';
  /** `identifier`: usuario o correo. */
  login(identifier: string, password: string): Promise<AuthSession>;
  register(data: RegisterData): Promise<RegisterResult>;
  /** Abre el enlace del correo (registro o cambio de correo). */
  verifyEmail(token: string): Promise<{ purpose: 'VERIFY_EMAIL' | 'CHANGE_EMAIL' }>;
  /** Respuestas genericas: no revelan si la cuenta existe. */
  resendVerification(identifier: string): Promise<{ message: string }>;
  forgotPassword(identifier: string): Promise<{ message: string }>;
  resetPassword(token: string, password: string): Promise<void>;
  me(): Promise<User>;
  updateMe(data: ProfileUpdate): Promise<User>;

  listUsers(): Promise<User[]>;
  createUser(data: { username: string; password: string; role: Role }): Promise<User>;
  updateUser(id: string, data: UserUpdate): Promise<User>;
  deleteUser(id: string): Promise<void>;

  getCards(): Promise<Card[]>;
  saveGame(state: GameState, selfPlayerId: string | null): Promise<void>;
  getActiveGame(): Promise<GameState | null>;
  getMyStats(): Promise<PlayerStatsSummary>;
  /** Ultimas partidas: el admin ve las de todos; cada usuario, las que creo o jugo. */
  getRecentGames(limit?: number): Promise<RecentGame[]>;
  /** Elimina una partida (solo quien la creo o un admin). */
  deleteGame(id: string): Promise<void>;

  /** Foto del pasaporte: se manda ya achicada (ver lib/photo.ts); el servidor la normaliza. */
  uploadPhoto(image: Blob): Promise<User>;
  deleteMyPhoto(): Promise<User>;
  /** Moderacion (ADMIN): quita la foto de otro usuario. */
  deleteUserPhoto(userId: string): Promise<User>;
  /** URL lista para <img> (blob: o data:), o null si no tiene foto. */
  getPhotoUrl(userId: string, version: string): Promise<string | null>;

  // ── Online (solo con backend; en el modo demo lanzan DEMO_UNAVAILABLE) ──
  searchUsers(q: string): Promise<{ id: string; username: string }[]>;
  createOnlineGame(setup: OnlineGameSetup): Promise<{ sessionId: string }>;
  getCurrentOnline(): Promise<{ sessionId: string; phase: OnlinePhase; round: number } | null>;
  cancelOnlineGame(sessionId: string): Promise<void>;
  leaveOnlineLobby(sessionId: string): Promise<void>;
  inviteToOnline(sessionId: string, toUserId: string, initialMiles?: number): Promise<void>;
  listSentInvites(sessionId: string): Promise<SentInvite[]>;
  listInvites(): Promise<InviteSummary[]>;
  acceptInvite(inviteId: string, pawn: { color: PawnColor; avatar: string }): Promise<{ sessionId: string }>;
  declineInvite(inviteId: string): Promise<void>;
  cancelInvite(inviteId: string): Promise<void>;
  rejoinOnline(sessionId: string): Promise<void>;
  hideOnline(sessionId: string): Promise<void>;
  /** Foto fija de Street View para quien no tiene el turno (blob:), o null. */
  getStreetViewPhoto(sessionId: string): Promise<string | null>;
}

/** Error de la API. El mensaje ya viene traducido por su codigo (errors.<CODE>) si el diccionario lo tiene. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Codigo estable del servidor (p. ej. EMAIL_NOT_VERIFIED) para reaccionar o traducir. */
    public readonly code?: string,
    public readonly params?: Record<string, unknown>,
  ) {
    super(translateError(code, message, params));
  }
}
