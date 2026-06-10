import { useState, useCallback, useEffect } from 'react';

export interface SessionStats {
  handsPlayed: number;
  decisionsTotal: number;
  decisionsCorrect: number;
  currentStreak: number;
  longestStreak: number;
  handsWon: number;
  handsLost: number;
  totalChipsWon: number;
  totalChipsLost: number;
}

const STORAGE_KEY = 'poker-trainer-stats';

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultStats();
}

function defaultStats(): SessionStats {
  return {
    handsPlayed: 0,
    decisionsTotal: 0,
    decisionsCorrect: 0,
    currentStreak: 0,
    longestStreak: 0,
    handsWon: 0,
    handsLost: 0,
    totalChipsWon: 0,
    totalChipsLost: 0,
  };
}

export function useStats() {
  const [stats, setStats] = useState<SessionStats>(loadStats);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  const recordDecision = useCallback((wasCorrect: boolean) => {
    setStats(prev => {
      const newStreak = wasCorrect ? prev.currentStreak + 1 : 0;
      return {
        ...prev,
        decisionsTotal: prev.decisionsTotal + 1,
        decisionsCorrect: prev.decisionsCorrect + (wasCorrect ? 1 : 0),
        currentStreak: newStreak,
        longestStreak: Math.max(prev.longestStreak, newStreak),
      };
    });
  }, []);

  const recordHandResult = useCallback((won: boolean, chipDelta: number) => {
    setStats(prev => ({
      ...prev,
      handsPlayed: prev.handsPlayed + 1,
      handsWon: prev.handsWon + (won ? 1 : 0),
      handsLost: prev.handsLost + (won ? 0 : 1),
      totalChipsWon: prev.totalChipsWon + (won ? chipDelta : 0),
      totalChipsLost: prev.totalChipsLost + (won ? 0 : Math.abs(chipDelta)),
    }));
  }, []);

  const resetStats = useCallback(() => {
    setStats(defaultStats());
  }, []);

  return { stats, recordDecision, recordHandResult, resetStats };
}
