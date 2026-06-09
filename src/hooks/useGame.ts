import { useState, useCallback, useRef, useMemo } from 'react';
import {
  GameState,
  GameAction,
  GamePhase,
  DecisionFeedback,
} from '../engine/types';
import {
  createGameState,
  startNewHand,
  performAction,
  getWinners,
  getAvailableActions,
  getRaiseRange,
  generateFeedback,
  HandResult,
} from '../engine/game';
import { makeAIDecision } from '../ai/strategy';
import { getGTOAdvice, calculatePosition, GTOAdvice, Position } from '../engine/gto';

export interface GameHookState {
  gameState: GameState;
  feedback: DecisionFeedback | null;
  handResult: HandResult | null;
  lastHumanAction: GameAction | null;
  lastHumanPhase: GamePhase | null;
  isProcessing: boolean;
  gtoAdvice: GTOAdvice | null;
  humanPosition: Position | null;
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
  }));;

  const processingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const finishHand = useCallback((gs: GameState) => {
    const { result, updatedPlayers } = getWinners(gs);
    const finalState = { ...gs, players: updatedPlayers };
    setState(prev => ({
      ...prev,
      gameState: finalState,
      handResult: result,
      isProcessing: false,
    }));
    processingRef.current = false;
  }, []);

  const processAIActions = useCallback((gs: GameState) => {
    if (processingRef.current) return;
    processingRef.current = true;

    const process = (current: GameState) => {
      // Check if hand is over
      if (current.isHandComplete || current.phase === 'showdown') {
        finishHand(current);
        return;
      }

      const currentPlayer = current.players[current.currentPlayerIndex];

      // If it's the human player's turn, stop and wait
      if (currentPlayer?.isHuman) {
        processingRef.current = false;
        setState(prev => ({
          ...prev,
          gameState: { ...current },
          isProcessing: false,
        }));
        return;
      }

      // AI turn
      const action = makeAIDecision(current, current.currentPlayerIndex);
      const next = performAction(current, action);

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
    }));;

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
  const { gtoAdvice, humanPosition } = useMemo(() => {
    if (!isHumanTurn || state.gameState.phase !== 'preflop') return { gtoAdvice: null, humanPosition: null };
    const human = state.gameState.players.find((p: { isHuman: boolean }) => p.isHuman);
    if (!human || human.holeCards.length !== 2) return { gtoAdvice: null, humanPosition: null };

    const pos = calculatePosition(human.seatIndex, state.gameState.dealerIndex, state.gameState.players);
    const advice = getGTOAdvice(human.holeCards, pos);
    return { gtoAdvice: advice, humanPosition: pos };
  }, [isHumanTurn, state.gameState.phase, state.gameState.dealerIndex, state.gameState.players]);

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
    startGame,
    playerAction,
    dealNewHand,
  };
}
