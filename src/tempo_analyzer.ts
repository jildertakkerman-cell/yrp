import { ReplayDecoder } from "./replay_decoder";

/**
 * Analyze tempo and speed metrics from parsed replay data
 */
export interface TempoAnalysis {
    perTurnMetrics: TurnMetrics[];
    summary: {
        averageActionsPerTurn: number;
        maxActionsInSingleTurn: number;
        totalSpecialSummons: number;
        totalNormalSummons: number;
        totalEffectActivations: number;
        player1: {
            specialSummons: number;
            normalSummons: number;
            effectActivations: number;
            totalActions: number;
        };
        player2: {
            specialSummons: number;
            normalSummons: number;
            effectActivations: number;
            totalActions: number;
        };
    };
    winner?: {
        player: number;
        playerName: string;
        turnsToWin: number;
        isOTK: boolean;
    };
}

export interface TurnMetrics {
    turn: number;
    specialSummons: number;
    normalSummons: number;
    effectActivations: number;
    totalActions: number;
    // Per-player breakdown
    player1: {
        specialSummons: number;
        normalSummons: number;
        effectActivations: number;
        totalActions: number;
    };
    player2: {
        specialSummons: number;
        normalSummons: number;
        effectActivations: number;
        totalActions: number;
    };
}

export function analyzeTempoMetrics(parsedSteps: any[], playerNames: string[]): TempoAnalysis {
    const turnMetrics: TurnMetrics[] = [];
    let currentTurn = 0;
    let currentTurnPlayer = 0; // Track whose turn it is (0 or 1)
    let currentTurnMetrics: TurnMetrics = {
        turn: 0,
        specialSummons: 0,
        normalSummons: 0,
        effectActivations: 0,
        totalActions: 0,
        player1: { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 },
        player2: { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 }
    };

    let totalSpecialSummons = 0;
    let totalNormalSummons = 0;
    let totalEffectActivations = 0;
    let winner: TempoAnalysis["winner"] | undefined;

    // Process each step
    for (const step of parsedSteps) {
        // Track new turns
        if (step.type === "MSG_NEW_TURN") {
            // Save previous turn metrics if it had any actions
            if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
                turnMetrics.push({ ...currentTurnMetrics });
            }

            // Detect which player's turn it is from the message details
            if (step.details && step.details.player !== undefined) {
                currentTurnPlayer = step.details.player;
            }

            // Start new turn
            currentTurn++;
            currentTurnMetrics = {
                turn: currentTurn,
                specialSummons: 0,
                normalSummons: 0,
                effectActivations: 0,
                totalActions: 0,
                player1: { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 },
                player2: { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 }
            };
        }

        // Helper to get player data - most actions during a turn are by the turn player
        const getPlayerData = (controller?: number) => {
            // If controller is explicit and valid, use it
            if (controller !== undefined && (controller === 0 || controller === 1)) {
                return controller === 0 ? currentTurnMetrics.player1 : currentTurnMetrics.player2;
            }
            // Otherwise attribute to the turn player
            return currentTurnPlayer === 0 ? currentTurnMetrics.player1 : currentTurnMetrics.player2;
        };

        // Track Special Summons
        if (step.type === "MSG_SPSUMMONING") {
            currentTurnMetrics.specialSummons++;
            currentTurnMetrics.totalActions++;
            totalSpecialSummons++;

            // Track per player
            const controller = step.details?.controller;
            const playerData = getPlayerData(controller);
            playerData.specialSummons++;
            playerData.totalActions++;
        }

        // Track Normal Summons
        if (step.type === "MSG_SUMMONING") {
            currentTurnMetrics.normalSummons++;
            currentTurnMetrics.totalActions++;
            totalNormalSummons++;

            // Track per player
            const controller = step.details?.controller;
            const playerData = getPlayerData(controller);
            playerData.normalSummons++;
            playerData.totalActions++;
        }

        // Track Effect Activations
        if (step.type === "MSG_CHAINING") {
            currentTurnMetrics.effectActivations++;
            currentTurnMetrics.totalActions++;
            totalEffectActivations++;

            // Track per player
            const controller = step.details?.controller;
            const playerData = getPlayerData(controller);
            playerData.effectActivations++;
            playerData.totalActions++;
        }

        // Track game end
        if (step.type === "MSG_WIN") {
            if (step.details) {
                const playerIndex = step.details.player;
                const playerName = playerNames[playerIndex] || `Player ${playerIndex + 1}`;
                const isOTK = currentTurn <= 2;

                winner = {
                    player: playerIndex,
                    playerName,
                    turnsToWin: currentTurn,
                    isOTK
                };
            }
        }
    }

    // Add final turn metrics if game didn't end cleanly
    if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
        turnMetrics.push({ ...currentTurnMetrics });
    }

    // Calculate summary statistics
    const totalActions = turnMetrics.reduce((sum, t) => sum + t.totalActions, 0);
    const avgActionsPerTurn = turnMetrics.length > 0 ? totalActions / turnMetrics.length : 0;
    const maxActions = turnMetrics.reduce((max, t) => Math.max(max, t.totalActions), 0);

    // Calculate per-player totals
    const p1Stats = turnMetrics.reduce((stats, t) => ({
        specialSummons: stats.specialSummons + t.player1.specialSummons,
        normalSummons: stats.normalSummons + t.player1.normalSummons,
        effectActivations: stats.effectActivations + t.player1.effectActivations,
        totalActions: stats.totalActions + t.player1.totalActions
    }), { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 });

    const p2Stats = turnMetrics.reduce((stats, t) => ({
        specialSummons: stats.specialSummons + t.player2.specialSummons,
        normalSummons: stats.normalSummons + t.player2.normalSummons,
        effectActivations: stats.effectActivations + t.player2.effectActivations,
        totalActions: stats.totalActions + t.player2.totalActions
    }), { specialSummons: 0, normalSummons: 0, effectActivations: 0, totalActions: 0 });

    return {
        perTurnMetrics: turnMetrics,
        summary: {
            averageActionsPerTurn: Math.round(avgActionsPerTurn * 10) / 10,
            maxActionsInSingleTurn: maxActions,
            totalSpecialSummons,
            totalNormalSummons,
            totalEffectActivations,
            player1: p1Stats,
            player2: p2Stats
        },
        winner
    };
}
