import { LLMConfig, MemorySnapshot } from './llmStrategy';
import { GameState } from '../engine/types';

// ===================== Types =====================

export interface Competitor {
  id: string;
  name: string;                 // seat display name, e.g. "DeepSeek-V3"
  llm: LLMConfig;               // per-player model/provider/key
  prompt: {
    type: 'human' | 'pro' | 'custom';
    proId?: string;             // when type === 'pro'
    customText?: string;        // when type === 'custom'
  };
}

export interface LeaderboardEntry {
  competitorId: string;
  wins: number;
  chips: number;
  handsPlayed: number;
}

export interface CompetitionSave {
  id: string;
  name: string;                 // user-given save name
  status: 'running' | 'paused' | 'finished';
  competitors: Competitor[];
  config: {
    startingChips: number;
    handsPerLevel: number;
  };
  gameState: GameState;
  memory: MemorySnapshot;
  leaderboard: LeaderboardEntry[];
  currentHand: number;          // = gameState.handNumber, denormalized for the save list display
  winnerId?: string;            // set when status === 'finished'
  createdAt: number;
  updatedAt: number;
}

// ===================== Storage =====================

const STORAGE_KEY = 'poker-competitions';
const MAX_SAVES = 5;

function loadAll(): CompetitionSave[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CompetitionSave[];
  } catch {
    return [];
  }
}

function saveAll(saves: CompetitionSave[]): void {
  // Wrap in try/catch: localStorage.setItem can throw QuotaExceededError on
  // large saves. We must NOT propagate — persist() is called from inside the
  // autoplay loop's try/catch, where an uncaught throw would be swallowed and
  // the modelFailure dialog would never show. Log a warning instead.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch (err) {
    console.warn('competitionStore: failed to persist saves (storage quota?)', err);
  }
}

export function listCompetitions(): CompetitionSave[] {
  // Return sorted by updatedAt desc (most recent first)
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCompetition(id: string): CompetitionSave | null {
  return loadAll().find(c => c.id === id) ?? null;
}

export function saveCompetition(save: CompetitionSave): CompetitionSave {
  const all = loadAll();
  const existingIndex = all.findIndex(c => c.id === save.id);
  const now = Date.now();
  const toStore: CompetitionSave = { ...save, updatedAt: now };

  if (existingIndex >= 0) {
    // Update existing (preserve original createdAt)
    toStore.createdAt = all[existingIndex].createdAt;
    all[existingIndex] = toStore;
  } else {
    toStore.createdAt = now;
    all.push(toStore);
    // Enforce cap: if over limit, remove the OLDEST (by updatedAt) until within cap
    if (all.length > MAX_SAVES) {
      all.sort((a, b) => a.updatedAt - b.updatedAt);
      const toRemove = all.splice(0, all.length - MAX_SAVES);
      console.warn(`Competition save cap (${MAX_SAVES}) reached. Removed ${toRemove.length} oldest save(s).`, toRemove.map(c => c.name));
    }
  }

  saveAll(all);
  return toStore;
}

export function deleteCompetition(id: string): void {
  const all = loadAll().filter(c => c.id !== id);
  saveAll(all);
}

// Generate a unique id for a new competition
export function newCompetitionId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
