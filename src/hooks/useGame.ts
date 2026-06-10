import { useState, useCallback, useRef, useMemo } from 'react';
import {
  GameState,
  GameAction,
  GamePhase,
  DecisionFeedback,
  ActionRecord,
} from '../engine/types';
import {
  createGameState,
  startNewHand,
  performAction,
  getWinners,
  getAvailableActions,
  getRaiseRange,
  generateFeedback,
  getBlindInfo,
  HandResult,
  advancePhase,
} from '../engine/game';
import { makeAIDecision } from '../ai/strategy';
import { makeLLMDecision, loadLLMConfig } from '../ai/llmStrategy';
import { getGTOAdvice, calculatePosition, getPostFlopAdvice, GTOAdvice, Position, PostFlopAdvice } from '../engine/gto';
import { useStats } from './useStats';

export interface GameHookState {
  gameState: GameState;
  feedback: DecisionFeedback | null;
  handResult: HandResult | null;
  lastHumanAction: GameAction | null;
  lastHumanPhase: GamePhase | null;
  isProcessing: boolean;
  gtoAdvice: GTOAdvice | null;
  humanPosition: Position | null;
  postFlopAdvice: PostFlopAdvice | null;
}

export function useGame() {
  const [state, setState] = useState<GameHookState>(() => ({
    gameState: createGameState(),
    feedback: null,
    handResult: null,
    lastHumanAction: null,
    lastHumanPhase: null,
    isProcessing: false,
    gtoAdvice: null,
    humanPosition: null,
    postFlopAdvice: null,
  }));

  const { stats, recordDecision, recordHandResult, resetStats } = useStats();

  const processingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const finishHand = useCallback((gs: GameState) => {
    const { result, updatedPlayers } = getWinners(gs);
    const human = updatedPlayers.find(p => p.isHuman);
    if (human) {
      const isWinner = result.winners.some(w => w.playerId === human.id);
      const chipDelta = isWinner
        ? result.winners.find(w => w.playerId === human.id)!.amount - human.totalBetThisHand
        : -human.totalBetThisHand;
      recordHandResult(isWinner, chipDelta);
    }
    const finalState = { ...gs, players: updatedPlayers };
    setState(prev => ({
      ...prev,
      gameState: finalState,
      handResult: result,
      isProcessing: false,
    }));
    processingRef.current = false;
  }, []);

  // Helper: advance to next player who can act (skipping folded/all-in/eliminated)
  const advanceToNextActor = (gs: GameState): GameState | null => {
    const n = gs.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (gs.currentPlayerIndex + i) % n;
      const p = gs.players[idx];
      if (!p.isEliminated && !p.isFolded && !p.isAllIn) {
        return { ...gs, currentPlayerIndex: idx };
      }
    }
    return null; // no one can act
  };

  const getAIDecision = async (state: GameState, playerIndex: number) => {
    const llmConfig = loadLLMConfig();
    if (llmConfig.enabled && llmConfig.apiKey) {
      return makeLLMDecision(state, playerIndex, llmConfig);
    }
    return makeAIDecision(state, playerIndex);
  };

  const processAIActions = useCallback((gs: GameState) => {
    if (processingRef.current) return;
    processingRef.current = true;

    const process = async (current: GameState) => {
      // Check if hand is over
      if (current.isHandComplete || current.phase === 'showdown') {
        finishHand(current);
        return;
      }

      const currentPlayer = current.players[current.currentPlayerIndex];

      // If it's the human player's turn and they can still act, stop and wait
      if (currentPlayer?.isHuman && !currentPlayer.isFolded && !currentPlayer.isAllIn) {
        processingRef.current = false;
        setState(prev => ({
          ...prev,
          gameState: { ...current },
          isProcessing: false,
        }));
        return;
      }

      // If human is folded/all-in and it's their turn index, advance the game state
      // to the next player who can act, then continue processing
      if (currentPlayer?.isHuman && (currentPlayer.isFolded || currentPlayer.isAllIn)) {
        const advanced = advanceToNextActor(current);
        if (!advanced) {
          // No one can act (all remaining are all-in) — run out the board
          const withBoard = advancePhase(current);
          // Update UI to show new community cards
          setState(prev => ({
            ...prev,
            gameState: { ...withBoard },
          }));
          if (withBoard.isHandComplete || withBoard.phase === 'showdown') {
            finishHand(withBoard);
          } else {
            // Keep advancing until showdown
            setTimeout(() => process(withBoard), 600);
          }
          return;
        }
        setTimeout(() => process(advanced), 100);
        return;
      }

      // AI turn (async to support LLM)
      let decision;
      try {
        decision = await getAIDecision(current, current.currentPlayerIndex);
      } catch {
        decision = { action: { type: 'fold' as const }, thought: '决策出错' };
      }
      // Clone and patch the action record with the thought
      const next = performAction(current, decision.action);
      if (decision.thought && next.actionHistory.length > 0) {
        next.actionHistory[next.actionHistory.length - 1].thought = decision.thought;
      }

      // Update UI so user can see each AI action
      setState(prev => ({
        ...prev,
        gameState: { ...next },
      }));

      // Continue with next player after a delay
      setTimeout(() => process(next), 600);
    };

    setState(prev => ({ ...prev, isProcessing: true }));
    process(gs);
  }, [finishHand]);

  const startGame = useCallback(() => {
    const gs = createGameState();
    const withHand = startNewHand(gs);
    setState(prev => ({
      ...prev,
      gameState: withHand,
      feedback: null,
      handResult: null,
      lastHumanAction: null,
      lastHumanPhase: null,
      isProcessing: false,
      gtoAdvice: null,
      humanPosition: null,
    }));

    // If first to act is AI, process
    if (!withHand.players[withHand.currentPlayerIndex]?.isHuman) {
      setTimeout(() => processAIActions(withHand), 600);
    }
  }, [processAIActions]);

  const playerAction = useCallback((action: GameAction) => {
    const { gameState } = stateRef.current;

    // Generate feedback for this action (before applying it)
    const fb = generateFeedback(gameState, action, gameState.phase);
    if (fb) recordDecision(fb.wasCorrect);

    const next = performAction(gameState, action);

    setState(prev => ({
      ...prev,
      gameState: next,
      feedback: fb,
      lastHumanAction: action,
      lastHumanPhase: gameState.phase,
    }));

    // Check if hand ended immediately (e.g. everyone else folded)
    if (next.isHandComplete || next.phase === 'showdown') {
      finishHand(next);
      return;
    }

    // Continue processing (AI actions or phase advancement)
    if (!next.players[next.currentPlayerIndex]?.isHuman) {
      setTimeout(() => processAIActions(next), 600);
    }
  }, [processAIActions, finishHand]);

  const dealNewHand = useCallback(() => {
    const { gameState } = stateRef.current;
    const next = startNewHand(gameState);

    setState(prev => ({
      ...prev,
      gameState: next,
      feedback: null,
      handResult: null,
      lastHumanAction: null,
      lastHumanPhase: null,
      isProcessing: false,
      gtoAdvice: null,
      humanPosition: null,
    }));

    if (!next.players[next.currentPlayerIndex]?.isHuman) {
      setTimeout(() => processAIActions(next), 600);
    }
  }, [processAIActions]);

  // Check if game over (human eliminated)
  const humanPlayer = state.gameState.players.find(p => p.isHuman);
  const isGameOver = humanPlayer?.isEliminated ?? false;

  // Check if human won (only one left)
  const activePlayers = state.gameState.players.filter(p => !p.isEliminated);
  const humanWon = activePlayers.length === 1 && activePlayers[0]?.isHuman;

  const availableActions = (() => {
    if (state.gameState.isHandComplete || state.gameState.phase === 'showdown' || state.gameState.phase === 'waiting') {
      return [];
    }
    const current = state.gameState.players[state.gameState.currentPlayerIndex];
    if (!current?.isHuman) return [];
    return getAvailableActions(state.gameState);
  })();

  const raiseRange = (() => {
    const current = state.gameState.players[state.gameState.currentPlayerIndex];
    if (!current?.isHuman) return { min: 0, max: 0 };
    return getRaiseRange(state.gameState);
  })();

  const isHumanTurn = (() => {
    if (state.gameState.isHandComplete || state.gameState.phase === 'showdown' || state.gameState.phase === 'waiting') {
      return false;
    }
    const current = state.gameState.players[state.gameState.currentPlayerIndex];
    return current?.isHuman ?? false;
  })();

  // Compute GTO advice for human during preflop
  const { gtoAdvice, humanPosition, postFlopAdvice } = useMemo(() => {
    if (!isHumanTurn) return { gtoAdvice: null, humanPosition: null, postFlopAdvice: null };
    const human = state.gameState.players.find((p: { isHuman: boolean }) => p.isHuman);
    if (!human || human.holeCards.length !== 2) return { gtoAdvice: null, humanPosition: null, postFlopAdvice: null };

    const pos = calculatePosition(human.seatIndex, state.gameState.dealerIndex, state.gameState.players);

    let gto = null;
    let pfAdvice = null;

    if (state.gameState.phase === 'preflop') {
      gto = getGTOAdvice(human.holeCards, pos);
    } else if (state.gameState.phase !== 'showdown' && state.gameState.phase !== 'waiting') {
      pfAdvice = getPostFlopAdvice(
        human.holeCards,
        state.gameState.communityCards,
        pos,
        state.gameState.pot,
        state.gameState.currentBet,
        human.currentBet
      );
    }

    return { gtoAdvice: gto, humanPosition: pos, postFlopAdvice: pfAdvice };
  }, [isHumanTurn, state.gameState.phase, state.gameState.dealerIndex, state.gameState.pot, state.gameState.currentBet, state.gameState.communityCards, humanPlayer?.holeCards]);

  return {
    gameState: state.gameState,
    feedback: state.feedback,
    handResult: state.handResult,
    isProcessing: state.isProcessing,
    isHumanTurn,
    availableActions,
    raiseRange,
    isGameOver,
    humanWon,
    gtoAdvice,
    humanPosition,
    postFlopAdvice,
    stats,
    resetStats,
    blindInfo: getBlindInfo(state.gameState),
    startGame,
    playerAction,
    dealNewHand,
  };
}
