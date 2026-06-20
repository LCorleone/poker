import { useState, useRef, useCallback } from 'react';
import { GameState, Player, HandRank } from '../engine/types';
import {
  createCompetitionGameState,
  startNewHand,
  performAction,
  getWinners,
  getBlindInfo,
  HandResult,
} from '../engine/game';
import { evaluateHand } from '../engine/evaluate';
import {
  makeLLMDecision,
  getLastError,
  AIDecision,
  LLMConfig,
  updatePlayerMemory,
  resetPlayerMemories,
  clearTableChats,
  clearChatHistory,
  exportMemorySnapshot,
  importMemorySnapshot,
} from '../ai/llmStrategy';
import {
  Competitor,
  CompetitionSave,
  LeaderboardEntry,
  HandHistoryEntry,
  listCompetitions,
  saveCompetition,
  deleteCompetition,
  newCompetitionId,
} from '../ai/competitionStore';
import { POKER_PROS } from '../engine/pros';

export interface CompetitionConfig {
  startingChips: number;
  handsPerLevel: number;
}

// Model failure info surfaced to the UI so it can show the ModelFailDialog.
// When set, the autoplay loop has stopped and an auto-save was performed.
export interface ModelFailure {
  competitorId: string;
  competitorName: string;
  error: string; // human-readable error message
  atHand: number;
}

export interface CompetitionHookState {
  gameState: GameState;
  handResult: HandResult | null;
  replayPlayers: Player[] | null; // snapshot at end of hand
  competitors: Competitor[]; // index-aligned with gameState.players
  leaderboard: LeaderboardEntry[];
  history: HandHistoryEntry[];
  saveName: string;
  saveId: string | null; // null = unsaved new competition
  config: CompetitionConfig;

  isRunning: boolean; // true while autoplay loop active
  pauseAfterHand: boolean; // user toggle: stop after each hand resolves
  isFinished: boolean; // true when only one competitor remains
  winnerId: string | null;
  modelFailure: ModelFailure | null; // set when a model call fails → loop stops
}

const DEFAULT_CONFIG: CompetitionConfig = { startingChips: 5000, handsPerLevel: 10 };

// How long the finished-hand result stays visible before the next hand auto-deals.
const RESULT_DISPLAY_MS = 10000;

function initialEmptyState(): CompetitionHookState {
  return {
    gameState: createCompetitionGameState([], DEFAULT_CONFIG),
    handResult: null,
    replayPlayers: null,
    competitors: [],
    leaderboard: [],
    history: [],
    saveName: '',
    saveId: null,
    config: DEFAULT_CONFIG,
    isRunning: false,
    pauseAfterHand: false,
    isFinished: false,
    winnerId: null,
    modelFailure: null,
  };
}

export function useCompetition() {
  const [state, setState] = useState<CompetitionHookState>(() => initialEmptyState());

  // ----- refs used inside the setTimeout loop (avoid stale closures) -----
  const processingRef = useRef(false); // loop actively running (guards re-entry)
  const runningRef = useRef(false); // user wants autoplay to continue
  const pauseAfterHandRef = useRef(false);
  const competitorsRef = useRef<Competitor[]>([]);
  const leaderboardRef = useRef<LeaderboardEntry[]>([]);
  const historyRef = useRef<HandHistoryEntry[]>([]);
  const saveIdRef = useRef<string | null>(null);
  const winnerIdRef = useRef<string | null>(null);
  const modelFailureRef = useRef<ModelFailure | null>(null);
  // Generation counter: bumped whenever the session identity changes (init/load)
  // or a fresh play starts. Stale setTimeout closures capture a generation and
  // bail if it no longer matches — prevents a result-window timeout from a
  // previous competition firing against a new one.
  const playGenRef = useRef(0);
  // Handle of the in-flight result-window timer (the 10s hold before the next
  // hand). Cleared on pause so a pause→play during the window resumes immediately.
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Build a CompetitionSave from the live refs + the supplied gameState and
   * persist it. Reading competitors/leaderboard/saveId/winnerId from refs
   * (which are updated synchronously in init/load/finishHand) avoids the
   * "setState hasn't flushed yet" timing problem when persist() is called
   * mid-loop (model failure / finish).
   */
  const persist = (gs: GameState, status: CompetitionSave['status']): CompetitionSave => {
    const st = stateRef.current;
    let id = saveIdRef.current;
    if (!id) {
      id = newCompetitionId();
      saveIdRef.current = id;
    }
    const save: CompetitionSave = {
      id,
      name: st.saveName,
      status,
      competitors: competitorsRef.current,
      config: st.config,
      gameState: gs,
      memory: exportMemorySnapshot(),
      leaderboard: leaderboardRef.current,
      history: historyRef.current,
      currentHand: gs.handNumber,
      winnerId: winnerIdRef.current ?? undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const saved = saveCompetition(save);
    // Reflect a newly-generated save id back into state so the UI can show it.
    if (st.saveId !== id) {
      setState(prev => (prev.saveId === id ? prev : { ...prev, saveId: id }));
    }
    return saved;
  };

  /**
   * Update cross-hand memory + leaderboard for a finished hand.
   * Mirrors useGame's finishHand, minus the human-specific stats.
   * Returns the post-elimination GameState so the loop can decide next steps.
   */
  const finishHand = (gs: GameState): GameState => {
    const { result, updatedPlayers } = getWinners(gs);

    // Cross-hand memory for every non-eliminated player (no human in a competition)
    const winnerIds = new Set(result.winners.map(w => w.playerId));
    const bestWinnerRank =
      result.winners.length > 0 ? Math.max(...result.winners.map(w => w.hand.rank)) : 0;

    for (const p of gs.players) {
      if (p.isEliminated) continue;
      const isWinner = winnerIds.has(p.id);
      const wentToShowdown = !p.isFolded && gs.communityCards.length >= 3;

      let resultType: 'win' | 'loss' | 'fold';
      let hadStrongHand = false;

      if (p.isFolded) {
        resultType = 'fold';
      } else if (isWinner) {
        resultType = 'win';
      } else {
        resultType = 'loss';
        // Bad beat: two pair or better but still lost at showdown
        if (wentToShowdown) {
          const hand = evaluateHand([...p.holeCards, ...gs.communityCards]);
          if (hand.rank >= HandRank.TWO_PAIR && hand.rank < bestWinnerRank) {
            hadStrongHand = true;
          }
        }
      }

      updatePlayerMemory(p.id, gs.handNumber, resultType, hadStrongHand);
    }

    const finalState: GameState = { ...gs, players: updatedPlayers };

    // Snapshot hole cards for replay before the next hand clears them
    const snapshot = JSON.parse(JSON.stringify(updatedPlayers)) as Player[];

    // Leaderboard is index-aligned with competitors/players (player.id === seat === index)
    const newLeaderboard: LeaderboardEntry[] = competitorsRef.current.map((comp, i) => {
      const prev =
        leaderboardRef.current[i] ?? { competitorId: comp.id, wins: 0, chips: 0, handsPlayed: 0 };
      const player = updatedPlayers[i];
      const won = result.winners.some(w => w.playerId === player.id);
      return {
        competitorId: comp.id,
        wins: prev.wins + (won ? 1 : 0),
        chips: player.chips,
        handsPlayed: prev.handsPlayed + (player.isEliminated ? 0 : 1),
      };
    });
    leaderboardRef.current = newLeaderboard;

    // Capture a history entry for this finished hand.
    // `updatedPlayers` still holds the hole cards (the next hand clears them),
    // so we snapshot from it. All fields are deep-copied so later hands can't
    // mutate the captured record.
    // Derive the REAL ending phase. The engine sets gs.phase='showdown' the
    // moment a hand completes (even a preflop walkover win), so reading
    // gs.phase directly would always show '搅牌'. The last recorded action's
    // phase is where the hand actually ended (e.g. 'preflop' when everyone
    // folded preflop). Fall back to gs.phase if actionHistory is empty.
    const endingPhase = gs.actionHistory.length > 0
      ? gs.actionHistory[gs.actionHistory.length - 1].phase
      : gs.phase;
    const historyEntry: HandHistoryEntry = {
      handNumber: gs.handNumber,
      phase: endingPhase,
      pot: gs.pot,
      communityCards: gs.communityCards.map(c => ({ suit: c.suit, rank: c.rank })),
      winners: result.winners.map(w => ({
        playerId: w.playerId,
        amount: w.amount,
        handName: w.hand.name,
      })),
      players: updatedPlayers.map(p => ({
        playerId: p.id,
        name: p.name,
        holeCards: p.holeCards.map(c => ({ suit: c.suit, rank: c.rank })),
        isFolded: p.isFolded,
        isEliminated: p.isEliminated,
        chipsAfter: p.chips,
        finalHandName:
          gs.communityCards.length >= 3 && p.holeCards.length === 2
            ? evaluateHand([...p.holeCards, ...gs.communityCards]).name
            : undefined,
      })),
      actionHistory: gs.actionHistory.map(r => {
        const pl = updatedPlayers.find(pp => pp.id === r.playerId);
        return {
          playerId: r.playerId,
          playerName: pl?.name ?? `#${r.playerId}`,
          actionType: r.action.type,
          amount: r.action.amount,
          phase: r.phase,
          thought: r.thought,
        };
      }),
    };
    const newHistory = [...historyRef.current, historyEntry];
    // Cap at most recent 50 to bound save size
    if (newHistory.length > 50) newHistory.splice(0, newHistory.length - 50);
    historyRef.current = newHistory;

    setState(prev => ({
      ...prev,
      gameState: finalState,
      handResult: result,
      replayPlayers: snapshot,
      leaderboard: newLeaderboard,
      history: newHistory,
    }));

    return finalState;
  };

  /**
   * Record a model failure, auto-save (status 'paused'), and stop the loop.
   * NOTE: makeLLMDecision swallows errors and returns a fallback while setting
   * an internal lastError (read via getLastError()). We therefore treat a
   * non-null getLastError() right after the call as a genuine model failure —
   * in a competition a model that is down must NOT silently keep "playing".
   */
  const handleModelFailure = (gs: GameState, competitor: Competitor, error: string) => {
    const failure: ModelFailure = {
      competitorId: competitor.id,
      competitorName: competitor.name,
      error,
      atHand: gs.handNumber,
    };
    persist(gs, 'paused');
    setState(prev => ({ ...prev, modelFailure: failure, isRunning: false }));
    modelFailureRef.current = failure;
    runningRef.current = false;
    processingRef.current = false;
  };

  // THE CORE AUTOPLAY LOOP. Async, recurses via setTimeout.
  const processLoop = (gs: GameState) => {
    if (processingRef.current) return;
    processingRef.current = true;

    const run = async (current: GameState) => {
      try {
        // ---- stop checks at the top of each iteration ----
        if (!runningRef.current) {
          processingRef.current = false;
          return;
        }
        if (modelFailureRef.current) {
          processingRef.current = false;
          return;
        }

        // ---- hand complete? ----
        if (current.isHandComplete || current.phase === 'showdown') {
          const finalState = finishHand(current);
          const activeCount = finalState.players.filter(p => !p.isEliminated).length;

          // Competition over: only one competitor remains
          if (activeCount <= 1) {
            const winnerIdx = finalState.players.findIndex(p => !p.isEliminated);
            const winnerId =
              winnerIdx >= 0 ? competitorsRef.current[winnerIdx]?.id ?? null : null;
            winnerIdRef.current = winnerId;
            persist(finalState, 'finished');
            setState(prev => ({
              ...prev,
              isFinished: true,
              isRunning: false,
              winnerId,
            }));
            runningRef.current = false;
            processingRef.current = false;
            return;
          }

          // Pause-after-hand: stop and wait for the user
          if (pauseAfterHandRef.current) {
            runningRef.current = false;
            processingRef.current = false;
            setState(prev => ({ ...prev, isRunning: false }));
            return;
          }

          // Otherwise: hold the result visible for a moment so the spectator
          // can see who won, then deal the next hand and keep going.
          // finalState + handResult (set by finishHand) stay on screen during the delay.
          const gen = playGenRef.current;
          resultTimerRef.current = setTimeout(() => {
            resultTimerRef.current = null;
            // Stale timer from a prior session/play — bail without touching state.
            if (gen !== playGenRef.current) return;
            // The user may have paused, or a failure occurred, during the delay.
            if (!runningRef.current || modelFailureRef.current) {
              processingRef.current = false;
              return;
            }
            const nextGs = startNewHand(finalState);
            setState(prev => ({ ...prev, gameState: nextGs, handResult: null, replayPlayers: null }));
            setTimeout(() => run(nextGs), 600);
          }, RESULT_DISPLAY_MS);
          return;
        }

        // ---- it is an AI competitor's turn to act ----
        const competitor = competitorsRef.current[current.currentPlayerIndex];
        if (!competitor) {
          // Defensive: no competitor for this seat — bail safely.
          console.error('useCompetition: no competitor for currentPlayerIndex', current.currentPlayerIndex);
          processingRef.current = false;
          runningRef.current = false;
          setState(prev => ({ ...prev, isRunning: false }));
          return;
        }

        // Per-player model config: each competitor drives its own provider/key/model.
        // 'pro' → persona prompt; 'human'/'custom' → human strategy; custom text
        // (if provided) overrides the persona with the user's custom prompt.
        const cfg: LLMConfig = {
          ...competitor.llm,
          enabled: true,
          strategy: competitor.prompt.type === 'pro' ? 'pro' : 'human',
          startingChips: stateRef.current.config.startingChips,
        };
        const customText = competitor.prompt.type === 'custom'
          ? competitor.prompt.customText
          : undefined;

        let decision: AIDecision;
        try {
          decision = await makeLLMDecision(current, current.currentPlayerIndex, cfg, customText);
        } catch (err) {
          // Defensive: makeLLMDecision catches internally, but stay safe.
          handleModelFailure(current, competitor, String(err));
          return;
        }

        // The user may have paused while we were awaiting the network call.
        if (!runningRef.current) {
          processingRef.current = false;
          return;
        }
        if (modelFailureRef.current) {
          processingRef.current = false;
          return;
        }

        // makeLLMDecision returns a fallback on API/parse errors instead of
        // throwing; getLastError() tells us whether THIS call actually failed.
        const lastError = getLastError();
        if (lastError) {
          handleModelFailure(current, competitor, lastError);
          return;
        }

        const next = performAction(current, decision.action);
        if (decision.thought && next.actionHistory.length > 0) {
          next.actionHistory[next.actionHistory.length - 1].thought = decision.thought;
        }

        setState(prev => ({ ...prev, gameState: { ...next } }));
        setTimeout(() => run(next), 700);
      } catch (err) {
        console.error('useCompetition processLoop fatal:', err);
        processingRef.current = false;
        runningRef.current = false;
        setState(prev => ({ ...prev, isRunning: false }));
      }
    };

    run(gs);
  };

  // ----- public actions -----

  /** Create a brand-new competition. Does NOT auto-start; caller calls play(). */
  const init = (competitors: Competitor[], config: CompetitionConfig, saveName: string) => {
    // Fresh memory + chat state for a new competition
    resetPlayerMemories();
    clearTableChats();
    clearChatHistory();

    // New session: invalidate any pending result-window timer from a prior game.
    playGenRef.current++;
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    const gs = createCompetitionGameState(competitors.map(c => c.name), config);

    // Attach pro personas. Competition players have no proInfo by default, so a
    // competitor that picked a 'pro' prompt needs it set on its player object.
    // An invalid proId simply yields no match → falls back to the human prompt.
    competitors.forEach((comp, i) => {
      if (comp.prompt.type === 'pro' && comp.prompt.proId && gs.players[i]) {
        const pro = POKER_PROS.find(p => p.id === comp.prompt.proId);
        if (pro) gs.players[i].proInfo = pro;
      }
    });

    competitorsRef.current = competitors;
    saveIdRef.current = null;
    winnerIdRef.current = null;
    modelFailureRef.current = null;
    const leaderboard: LeaderboardEntry[] = competitors.map(c => ({
      competitorId: c.id,
      wins: 0,
      chips: config.startingChips,
      handsPlayed: 0,
    }));
    leaderboardRef.current = leaderboard;
    historyRef.current = [];

    setState({
      gameState: gs,
      handResult: null,
      replayPlayers: null,
      competitors,
      leaderboard,
      history: [],
      saveName,
      saveId: null,
      config,
      isRunning: false,
      pauseAfterHand: false,
      isFinished: false,
      winnerId: null,
      modelFailure: null,
    });
    // Mirror the toggle ref to its default.
    pauseAfterHandRef.current = false;
    processingRef.current = false;
    runningRef.current = false;
  };

  /** Start (or resume) the autoplay loop. Clears any prior model failure. */
  const play = () => {
    const st = stateRef.current;
    if (st.isFinished) return;
    if (!competitorsRef.current.length) return;
    if (processingRef.current) return; // already running

    // User chose to start/resume — clear any prior model failure so the loop
    // proceeds (Retry path). The ref is cleared synchronously so the loop's
    // first-iteration check sees null even before this setState flushes.
    modelFailureRef.current = null;
    runningRef.current = true;

    let gs = st.gameState;
    // Resume from a fresh deal when idle or after a completed hand.
    if (gs.phase === 'waiting' || gs.isHandComplete) {
      gs = startNewHand(gs);
      setState(prev => ({ ...prev, gameState: gs }));
    }
    setState(prev => ({ ...prev, isRunning: true, modelFailure: null }));
    processLoop(gs);
  };

  /** Pause the autoplay loop. The in-flight call finishes gracefully. */
  const pause = () => {
    runningRef.current = false;
    // Cancel the in-flight result-window timer so a pause→play during the
    // window resumes immediately instead of waiting up to 10s for the timer
    // to bail. The timer's own callback re-checks runningRef, so even if a
    // stale reference fires it will no-op.
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    processingRef.current = false;
    setState(prev => ({ ...prev, isRunning: false }));
  };

  const setPauseAfterHand = (v: boolean) => {
    pauseAfterHandRef.current = v;
    setState(prev => ({ ...prev, pauseAfterHand: v }));
  };

  /** Used when paused after a hand: deal a new hand and resume the loop. */
  const dealNextHand = () => {
    const st = stateRef.current;
    if (st.isFinished || st.modelFailure) return;
    if (!competitorsRef.current.length) return;
    const gs = startNewHand(st.gameState);
    runningRef.current = true;
    setState(prev => ({ ...prev, gameState: gs, isRunning: true }));
    processLoop(gs);
  };

  /** Manually save the current competition. Generates a save id on first save. */
  const manualSave = (): CompetitionSave => {
    const st = stateRef.current;
    return persist(st.gameState, st.isFinished ? 'finished' : 'paused');
  };

  /**
   * Update a competitor's llm config mid-run (e.g. fix a wrong API key/model
   * from the model-failure dialog) and clear the model failure so the loop
   * can resume. Updates both the ref (read by the loop) and the state (UI).
   */
  const updateCompetitorConfig = useCallback(
    (competitorId: string, newLlm: LLMConfig) => {
      // Update the ref (used by the loop) and the state (used by the UI).
      // Clear the model failure ref synchronously so a subsequent play() in the
      // same event handler (Save-and-Continue) proceeds past the failure guard
      // even before React has flushed this setState.
      competitorsRef.current = competitorsRef.current.map(c =>
        c.id === competitorId ? { ...c, llm: newLlm } : c
      );
      modelFailureRef.current = null;
      setState(prev => ({
        ...prev,
        competitors: prev.competitors.map(c =>
          c.id === competitorId ? { ...c, llm: newLlm } : c
        ),
        modelFailure: null,
      }));
    },
    []
  );

  /** Restore a competition from a saved snapshot. */
  const load = (save: CompetitionSave) => {
    importMemorySnapshot(save.memory);

    const gs = save.gameState;
    // Rehydrate actedThisRound: JSON.stringify turns a Set into "{}", so a saved
    // mid-hand state would crash performAction (.add is not a function) on resume.
    (gs as GameState).actedThisRound = new Set(
      Array.isArray(gs.actedThisRound) ? gs.actedThisRound : []
    );
    // Re-attach pro personas (proInfo is not part of the serialised player in saves).
    save.competitors.forEach((comp, i) => {
      if (comp.prompt.type === 'pro' && comp.prompt.proId && gs.players[i]) {
        const pro = POKER_PROS.find(p => p.id === comp.prompt.proId);
        if (pro) gs.players[i].proInfo = pro;
      }
    });

    competitorsRef.current = save.competitors;
    leaderboardRef.current = save.leaderboard;
    // `?? []` guards older saves persisted before the history field existed.
    historyRef.current = save.history ?? [];
    saveIdRef.current = save.id;
    winnerIdRef.current = save.winnerId ?? null;
    modelFailureRef.current = null;
    // New session: invalidate any pending result-window timer from a prior game.
    playGenRef.current++;
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    pauseAfterHandRef.current = false;
    processingRef.current = false;
    runningRef.current = false;

    setState({
      gameState: gs,
      handResult: null,
      replayPlayers: null,
      competitors: save.competitors,
      leaderboard: save.leaderboard,
      history: save.history ?? [],
      saveName: save.name,
      saveId: save.id,
      config: save.config,
      isRunning: false,
      pauseAfterHand: false,
      isFinished: save.status === 'finished',
      winnerId: save.winnerId ?? null,
      modelFailure: null,
    });
  };

  const blindInfo = getBlindInfo(state.gameState);

  return {
    // state
    gameState: state.gameState,
    handResult: state.handResult,
    replayPlayers: state.replayPlayers,
    competitors: state.competitors,
    leaderboard: state.leaderboard,
    history: state.history,
    saveName: state.saveName,
    saveId: state.saveId,
    config: state.config,
    isRunning: state.isRunning,
    pauseAfterHand: state.pauseAfterHand,
    isFinished: state.isFinished,
    winnerId: state.winnerId,
    modelFailure: state.modelFailure,
    blindInfo,
    // actions
    init,
    play,
    pause,
    setPauseAfterHand,
    dealNextHand,
    manualSave,
    updateCompetitorConfig,
    load,
    deleteSave: (id: string) => {
      deleteCompetition(id);
    },
    getSavesList: listCompetitions,
  };
}
