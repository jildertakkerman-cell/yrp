import { ReplayStep } from "./replay_decoder";

// Message type constants
const MSG_NEW_TURN = 40;
const MSG_NEW_PHASE = 41;
const MSG_CHAINING = 70;
const MSG_CHAINED = 71;
const MSG_CHAIN_SOLVING = 72;
const MSG_CHAIN_SOLVED = 73;
const MSG_CHAIN_END = 74;
const MSG_CHAIN_NEGATED = 75;
const MSG_CHAIN_DISABLED = 76;
const MSG_SUMMONING = 60;
const MSG_SUMMONED = 61;

// Phase constants
const PHASE_MAIN1 = 0x04;

export interface ChainEvent {
    turn: number;
    chainDepth: number;
    cards: Array<{
        code: number;
        controller: number;
        chainLink: number;
    }>;
    negatedLinks: number[];
    disabledLinks: number[];
    wasBeforeNormalSummon: boolean;
    respondingPlayer: number; // The player who responded (chained) to the turn player
}

export interface ChainAnalysisResult {
    // All chain events with depth >= 2 (actual interactions)
    interactions: ChainEvent[];

    // Summary statistics
    summary: {
        // Total chains that had at least 2 links
        totalInteractions: number;

        // Negate efficiency
        totalNegates: number;
        totalEffectsActivated: number;
        negateSuccessRate: number; // percentage

        // Chain depth stats
        averageChainDepth: number;
        maxChainDepth: number;

        // Bait counter - interactions before normal summon
        baitsForced: number;

        // Per-player stats
        player1Stats: PlayerChainStats;
        player2Stats: PlayerChainStats;
    };
}

export interface PlayerChainStats {
    effectsActivated: number;
    effectsNegated: number;
    chainsInitiated: number;
    responsesUsed: number; // Times this player responded in opponent's chain
}

interface ChainState {
    currentChainDepth: number;
    cardsInChain: Array<{
        code: number;
        controller: number;
        chainLink: number;
    }>;
    negatedLinks: number[];
    disabledLinks: number[];
    chainStartedBeforeNormalSummon: boolean;
}

interface GameState {
    turn: number;
    currentPhase: number;
    turnPlayer: number;
    hasNormalSummonedThisTurn: boolean;
    chainState: ChainState;
}

export function analyzeChains(parsedReplayData: ReplayStep[]): ChainAnalysisResult {
    const interactions: ChainEvent[] = [];

    // Initialize game state
    const state: GameState = {
        turn: 0,
        currentPhase: 0,
        turnPlayer: 0,
        hasNormalSummonedThisTurn: false,
        chainState: createEmptyChainState()
    };

    // Player statistics
    const playerStats: [PlayerChainStats, PlayerChainStats] = [
        { effectsActivated: 0, effectsNegated: 0, chainsInitiated: 0, responsesUsed: 0 },
        { effectsActivated: 0, effectsNegated: 0, chainsInitiated: 0, responsesUsed: 0 }
    ];

    let currentChainLink = 0;

    // Process all replay steps
    for (const step of parsedReplayData) {
        const details = step.details;
        if (!details) continue;

        switch (step.msgId) {
            case MSG_NEW_TURN: {
                // New turn - reset per-turn state
                if (details.player !== undefined) {
                    state.turn++;
                    state.turnPlayer = details.player as number;
                    state.hasNormalSummonedThisTurn = false;
                }
                break;
            }

            case MSG_NEW_PHASE: {
                if (details.phase !== undefined) {
                    state.currentPhase = details.phase as number;
                }
                break;
            }

            case MSG_SUMMONING: {
                // Normal summon is happening
                state.hasNormalSummonedThisTurn = true;
                break;
            }

            case MSG_CHAINING: {
                // An effect is being chained
                currentChainLink++;

                const controller = details.controller as number;
                const code = details.code as number;

                // Track this card in the chain
                state.chainState.cardsInChain.push({
                    code,
                    controller,
                    chainLink: currentChainLink
                });

                state.chainState.currentChainDepth = currentChainLink;

                // First link starts the chain
                if (currentChainLink === 1) {
                    state.chainState.chainStartedBeforeNormalSummon = !state.hasNormalSummonedThisTurn;
                    if (controller === 0 || controller === 1) {
                        playerStats[controller].chainsInitiated++;
                    }
                } else {
                    // This is a response (chain link 2+)
                    if (controller === 0 || controller === 1) {
                        playerStats[controller].responsesUsed++;
                    }
                }

                // Track activations per player
                if (controller === 0 || controller === 1) {
                    playerStats[controller].effectsActivated++;
                }
                break;
            }

            case MSG_CHAINED: {
                // Chain link was added successfully
                // The chain link number is tracked via MSG_CHAINING
                break;
            }

            case MSG_CHAIN_NEGATED: {
                // An effect in the chain was negated
                // This typically means the effect didn't resolve
                state.chainState.negatedLinks.push(currentChainLink);

                // Find which player's effect was negated
                const negatedCard = state.chainState.cardsInChain.find(
                    c => c.chainLink === currentChainLink
                );
                if (negatedCard && (negatedCard.controller === 0 || negatedCard.controller === 1)) {
                    playerStats[negatedCard.controller].effectsNegated++;
                }
                break;
            }

            case MSG_CHAIN_DISABLED: {
                // An effect in the chain was disabled (similar to negate)
                state.chainState.disabledLinks.push(currentChainLink);

                // Find which player's effect was disabled
                const disabledCard = state.chainState.cardsInChain.find(
                    c => c.chainLink === currentChainLink
                );
                if (disabledCard && (disabledCard.controller === 0 || disabledCard.controller === 1)) {
                    playerStats[disabledCard.controller].effectsNegated++;
                }
                break;
            }

            case MSG_CHAIN_END: {
                // Chain finished resolving
                // If chain depth >= 2, this was an actual interaction
                if (state.chainState.currentChainDepth >= 2) {
                    // Determine the responding player (first player to chain link 2)
                    const respondingCard = state.chainState.cardsInChain.find(c => c.chainLink === 2);
                    const respondingPlayer = respondingCard ? respondingCard.controller : -1;

                    interactions.push({
                        turn: state.turn,
                        chainDepth: state.chainState.currentChainDepth,
                        cards: [...state.chainState.cardsInChain],
                        negatedLinks: [...state.chainState.negatedLinks],
                        disabledLinks: [...state.chainState.disabledLinks],
                        wasBeforeNormalSummon: state.chainState.chainStartedBeforeNormalSummon,
                        respondingPlayer
                    });
                }

                // Reset chain state
                state.chainState = createEmptyChainState();
                currentChainLink = 0;
                break;
            }
        }
    }

    // Calculate summary statistics
    const totalInteractions = interactions.length;
    const totalNegates = playerStats[0].effectsNegated + playerStats[1].effectsNegated;
    const totalEffectsActivated = playerStats[0].effectsActivated + playerStats[1].effectsActivated;

    const chainDepths = interactions.map(i => i.chainDepth);
    const averageChainDepth = chainDepths.length > 0
        ? chainDepths.reduce((a, b) => a + b, 0) / chainDepths.length
        : 0;
    const maxChainDepth = chainDepths.length > 0 ? Math.max(...chainDepths) : 0;

    // Count baits - interactions where the chain started before normal summon
    const baitsForced = interactions.filter(i => i.wasBeforeNormalSummon).length;

    return {
        interactions,
        summary: {
            totalInteractions,
            totalNegates,
            totalEffectsActivated,
            negateSuccessRate: totalEffectsActivated > 0
                ? Math.round((totalNegates / totalEffectsActivated) * 100)
                : 0,
            averageChainDepth: Math.round(averageChainDepth * 10) / 10,
            maxChainDepth,
            baitsForced,
            player1Stats: playerStats[0],
            player2Stats: playerStats[1]
        }
    };
}

function createEmptyChainState(): ChainState {
    return {
        currentChainDepth: 0,
        cardsInChain: [],
        negatedLinks: [],
        disabledLinks: [],
        chainStartedBeforeNormalSummon: false
    };
}
