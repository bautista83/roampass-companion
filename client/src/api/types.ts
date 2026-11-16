import type { BoardMode, Card, GameState, PawnColor, Role, UiTheme, VictoryMode } from '@roampass/shared';

export interface User {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
  /** Estilo visual del perfil. Los usuarios anteriores a esta opcion no lo tienen: COMIC. */
  theme?: UiTheme;
  createdAt: string;
  gamesHosted?: number;
}

/** Lo que cada usuario puede cambiar de su propio perfil. */
export interface ProfileUpdate {
  theme?: UiTheme;
  currentPassword?: string;
  newPassword?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

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
  /** Puede eliminarla: quien la creo o un admin. */
  canDelete: boolean;
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

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * Contrato del backend. Hay dos implementaciones intercambiables:
 * - httpApi: Express + Prisma + PostgreSQL (server/)
 * - localApi: modo demo sin servidor, persiste en localStorage
 */
export interface RoamPassApi {
  readonly mode: 'remote' | 'local';
  login(username: string, password: string): Promise<AuthSession>;
  register(username: string, password: string): Promise<AuthSession>;
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
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
