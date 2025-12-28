import { ReplayStep } from "./replay_decoder";

// Location constants
const LOCATION_DECK = 0x01;
const LOCATION_HAND = 0x02;
const LOCATION_MZONE = 0x04;
const LOCATION_SZONE = 0x08;
const LOCATION_GRAVE = 0x10;
const LOCATION_REMOVED = 0x20;
const LOCATION_EXTRA = 0x40;
const LOCATION_OVERLAY = 0x80;

// Phase constants
const PHASE_DRAW = 0x01;
const PHASE_STANDBY = 0x02;
const PHASE_MAIN1 = 0x04;
const PHASE_BATTLE_START = 0x08;
const PHASE_BATTLE_STEP = 0x10;
const PHASE_DAMAGE = 0x20;
const PHASE_DAMAGE_CAL = 0x40;
const PHASE_BATTLE = 0x80;
const PHASE_MAIN2 = 0x100;
const PHASE_END = 0x200;

// Message type constants
const MSG_NEW_TURN = 40;
const MSG_NEW_PHASE = 41;
const MSG_MOVE = 50;
const MSG_DRAW = 90;
const MSG_START = 4;

export interface ResourceSnapshot {
    turn: number;
    phase: string;
    phaseCode: number;
    timestamp: number; // Relative message index for ordering
    player1: {
        hand: number;
        field: number;
        total: number;
    };
    player2: {
        hand: number;
        field: number;
        total: number;
    };
    delta: number; // player1.total - player2.total
}

export interface ResourceAnalysisResult {
    snapshots: ResourceSnapshot[];
    summary: {
        maxDelta: number;
        minDelta: number;
        peakAdvantagePlayer: number;
        finalDelta: number;
    };
}

interface GameState {
    turn: number;
    phase: string;
    phaseCode: number;
    // Track card counts per player per location
    // Player 0 and Player 1
    players: [PlayerState, PlayerState];
}

interface PlayerState {
    hand: Set<string>; // Track unique cards by a key (code + location + sequence)
    mzone: Set<string>;
    szone: Set<string>;
}

function getPhaseName(phase: number): string {
    switch (phase) {
        case PHASE_DRAW: return "Draw";
        case PHASE_STANDBY: return "Standby";
        case PHASE_MAIN1: return "Main 1";
        case PHASE_BATTLE_START: return "Battle Start";
        case PHASE_BATTLE_STEP: return "Battle Step";
        case PHASE_DAMAGE: return "Damage";
        case PHASE_DAMAGE_CAL: return "Damage Calc";
        case PHASE_BATTLE: return "Battle";
        case PHASE_MAIN2: return "Main 2";
        case PHASE_END: return "End";
        default: return `Phase ${phase}`;
    }
}

function isFieldLocation(location: number): boolean {
    return (location & (LOCATION_MZONE | LOCATION_SZONE)) !== 0;
}

function isHandLocation(location: number): boolean {
    return (location & LOCATION_HAND) !== 0;
}

function createEmptyPlayerState(): PlayerState {
    return {
        hand: new Set<string>(),
        mzone: new Set<string>(),
        szone: new Set<string>()
    };
}

function getCardKey(code: number, controller: number, sequence: number): string {
    return `${code}-${controller}-${sequence}`;
}

export function analyzeResources(parsedReplayData: ReplayStep[]): ResourceAnalysisResult {
    const snapshots: ResourceSnapshot[] = [];

    // Initialize game state
    const state: GameState = {
        turn: 0,
        phase: "Start",
        phaseCode: 0,
        players: [createEmptyPlayerState(), createEmptyPlayerState()]
    };

    let messageIndex = 0;
    let lastSnapshotKey = "";

    // Helper to create a snapshot
    const createSnapshot = (): ResourceSnapshot => {
        const p1Hand = state.players[0].hand.size;
        const p1Field = state.players[0].mzone.size + state.players[0].szone.size;
        const p2Hand = state.players[1].hand.size;
        const p2Field = state.players[1].mzone.size + state.players[1].szone.size;

        return {
            turn: state.turn,
            phase: state.phase,
            phaseCode: state.phaseCode,
            timestamp: messageIndex,
            player1: {
                hand: p1Hand,
                field: p1Field,
                total: p1Hand + p1Field
            },
            player2: {
                hand: p2Hand,
                field: p2Field,
                total: p2Hand + p2Field
            },
            delta: (p1Hand + p1Field) - (p2Hand + p2Field)
        };
    };

    // Helper to add snapshot only if state changed
    const addSnapshotIfChanged = () => {
        const snapshot = createSnapshot();
        const snapshotKey = `${snapshot.turn}-${snapshot.phaseCode}-${snapshot.player1.total}-${snapshot.player2.total}`;

        if (snapshotKey !== lastSnapshotKey) {
            snapshots.push(snapshot);
            lastSnapshotKey = snapshotKey;
        }
    };

    // Process all replay steps
    for (const step of parsedReplayData) {
        messageIndex++;
        const details = step.details;

        if (!details) continue;

        switch (step.msgId) {
            case MSG_START: {
                // Initial draw - MSG_START contains initial state info
                // We'll capture the initial state after processing draws
                break;
            }

            case MSG_NEW_TURN: {
                state.turn = (details.player !== undefined) ? state.turn + 1 : state.turn + 1;
                // Don't snapshot on turn change, wait for phase
                break;
            }

            case MSG_NEW_PHASE: {
                if (details.phase !== undefined) {
                    state.phaseCode = details.phase;
                    state.phase = getPhaseName(details.phase);

                    // Snapshot at major phases (not battle substeps)
                    const majorPhases = [PHASE_DRAW, PHASE_STANDBY, PHASE_MAIN1, PHASE_BATTLE, PHASE_MAIN2, PHASE_END];
                    if (majorPhases.includes(details.phase)) {
                        addSnapshotIfChanged();
                    }
                }
                break;
            }

            case MSG_DRAW: {
                // Cards drawn go to hand
                if (details.player !== undefined && details.cards) {
                    const playerIdx = details.player as number;
                    if (playerIdx === 0 || playerIdx === 1) {
                        for (const card of details.cards) {
                            const key = getCardKey(card.code, playerIdx, state.players[playerIdx].hand.size);
                            state.players[playerIdx].hand.add(key);
                        }
                    }
                }
                break;
            }

            case MSG_MOVE: {
                // Card moved from one location to another
                const oldController = details.oldController as number;
                const newController = details.newController as number;
                const oldLocation = details.oldLocation as number;
                const newLocation = details.newLocation as number;
                const code = details.code as number;
                const oldSequence = details.oldSequence as number;
                const newSequence = details.newSequence as number;

                // Remove from old location
                if (oldController === 0 || oldController === 1) {
                    const oldKey = getCardKey(code, oldController, oldSequence);

                    if (isHandLocation(oldLocation)) {
                        state.players[oldController].hand.delete(oldKey);
                    } else if (oldLocation & LOCATION_MZONE) {
                        state.players[oldController].mzone.delete(oldKey);
                    } else if (oldLocation & LOCATION_SZONE) {
                        state.players[oldController].szone.delete(oldKey);
                    }
                }

                // Add to new location
                if (newController === 0 || newController === 1) {
                    const newKey = getCardKey(code, newController, newSequence);

                    if (isHandLocation(newLocation)) {
                        state.players[newController].hand.add(newKey);
                    } else if (newLocation & LOCATION_MZONE) {
                        state.players[newController].mzone.add(newKey);
                    } else if (newLocation & LOCATION_SZONE) {
                        state.players[newController].szone.add(newKey);
                    }
                    // Cards going to GY, banished, deck, etc. are not counted
                }
                break;
            }
        }
    }

    // Add final snapshot if we have any snapshots
    if (snapshots.length === 0 || snapshots[snapshots.length - 1].timestamp !== messageIndex) {
        addSnapshotIfChanged();
    }

    // Calculate summary statistics
    let maxDelta = -Infinity;
    let minDelta = Infinity;

    for (const snapshot of snapshots) {
        if (snapshot.delta > maxDelta) maxDelta = snapshot.delta;
        if (snapshot.delta < minDelta) minDelta = snapshot.delta;
    }

    const finalSnapshot = snapshots[snapshots.length - 1];
    const finalDelta = finalSnapshot ? finalSnapshot.delta : 0;

    // Peak advantage: positive = player 1, negative = player 2
    const peakAdvantagePlayer = Math.abs(maxDelta) >= Math.abs(minDelta) ? 1 : 2;

    return {
        snapshots,
        summary: {
            maxDelta: maxDelta === -Infinity ? 0 : maxDelta,
            minDelta: minDelta === Infinity ? 0 : minDelta,
            peakAdvantagePlayer,
            finalDelta
        }
    };
}
