import { OmegaReplayParser } from '../parsers/omega_replay_parser';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tempo & Speed Metrics Analysis
 * 
 * This script analyzes YGO Omega replay files for:
 * 1. Actions Per Turn: Count Special Summons and Effect Activations per turn
 * 2. Time Analysis: Track thinking time vs. action time (if timestamps available)
 * 3. OTK Speed: Calculate turns to win for completed games
 */

// Define ReplayStep interface locally to avoid import issues
interface ReplayStep {
    type: string;
    raw: string;
    msgId?: number;
    len?: number;
    details?: any;
    error?: string;
}

interface TurnMetrics {
    turn: number;
    specialSummons: number;
    effectActivations: number;
    totalActions: number;
    timestamp?: number; // If available
}

interface TimeAnalysis {
    totalGameTime?: number;
    thinkingTime?: number;
    actionTime?: number;
    thinkingPercentage?: number;
    hasTimestamps: boolean;
}

interface OTKMetrics {
    gameEnded: boolean;
    winner?: string;
    winReason?: number;
    turnsToWin?: number;
    isOTK: boolean; // True if won in ≤2 turns
}

interface TempoSpeedResults {
    perTurnMetrics: TurnMetrics[];
    timeAnalysis: TimeAnalysis;
    otkMetrics: OTKMetrics;
    summary: {
        averageActionsPerTurn: number;
        maxActionsInSingleTurn: number;
        totalSpecialSummons: number;
        totalEffectActivations: number;
    };
}

/**
 * Message IDs for tracking
 * These are common YGOPro protocol message IDs
 */
const MSG_NEW_TURN = 0x28;       // 40
const MSG_SUMMONING = 0x3c;      // 60
const MSG_SPSUMMONING = 0x3e;    // 62
const MSG_CHAINING = 0x46;       // 70
const MSG_WIN = 0x05;            // 5
const MSG_DRAW = 0x5a;           // 90

/**
 * Decode game messages buffer manually
 * Format: [Length: 1 byte] [MsgID: 1 byte] [Payload: Length bytes]
 */
function decodeGameMessages(buffer: Buffer): ReplayStep[] {
    const steps: ReplayStep[] = [];
    let cursor = 0;

    while (cursor < buffer.length) {
        // Check for end of buffer
        if (cursor + 2 > buffer.length) break;

        const len = buffer.readUInt8(cursor);
        cursor += 1;

        if (len === 0) {
            continue;
        }

        if (cursor >= buffer.length) break;
        const msgId = buffer.readUInt8(cursor);
        cursor += 1;

        if (cursor + len > buffer.length) {
            console.warn(`Incomplete packet for MsgID ${msgId} at ${cursor - 2}.`);
            break;
        }

        const data = buffer.subarray(cursor, cursor + len);
        cursor += len;

        const step: ReplayStep = {
            type: `MSG_${msgId}`,
            msgId: msgId,
            len: len,
            raw: data.toString('hex'),
            details: parseMessageDetails(msgId, data)
        };

        steps.push(step);

        // Enforce 4-byte padding alignment
        const remainder = cursor % 4;
        if (remainder !== 0) {
            cursor += (4 - remainder);
        }
    }

    return steps;
}

/**
 * Parse message details based on message ID
 */
function parseMessageDetails(msgId: number, data: Buffer): any {
    try {
        switch (msgId) {
            case MSG_NEW_TURN:
                return { player: data.length > 0 ? data.readUInt8(0) : 0 };

            case MSG_WIN:
                return {
                    player: data.length > 0 ? data.readUInt8(0) : undefined,
                    reason: data.length > 1 ? data.readUInt8(1) : undefined
                };

            case MSG_DRAW:
                if (data.length >= 5) {
                    const player = data.readUInt8(0);
                    const count = data.readUInt32LE(1);
                    const cards = [];
                    for (let i = 0; i < count && (5 + i * 8 + 4) <= data.length; i++) {
                        cards.push({
                            code: data.readUInt32LE(5 + i * 8)
                        });
                    }
                    return { player, count, cards };
                }
                return {};

            default:
                return {};
        }
    } catch (e) {
        return { error: String(e) };
    }
}

async function analyzeTempoAndSpeed(replayPath: string): Promise<TempoSpeedResults> {
    console.log(`\n=== Tempo & Speed Analysis ===`);
    console.log(`Analyzing: ${path.basename(replayPath)}\n`);

    // Load and parse replay
    const content = fs.readFileSync(replayPath, 'utf-8').trim();
    const parser = OmegaReplayParser.fromBase64(content);
    const replay = parser.parse();

    if (!replay.gameMessagesRaw) {
        throw new Error("No game messages found in replay!");
    }

    // Decode the game messages
    const steps = decodeGameMessages(replay.gameMessagesRaw);
    console.log(`Total messages decoded: ${steps.length}\n`);

    // Initialize metrics
    const turnMetrics: TurnMetrics[] = [];
    let currentTurn = 0;
    let currentTurnMetrics: TurnMetrics = {
        turn: 0,
        specialSummons: 0,
        effectActivations: 0,
        totalActions: 0
    };

    let gameEnded = false;
    let winner: string | undefined;
    let winReason: number | undefined;
    let turnsToWin: number | undefined;

    let firstTimestamp: number | undefined;
    let lastTimestamp: number | undefined;
    let hasTimestamps = false;

    let totalSpecialSummons = 0;
    let totalEffectActivations = 0;

    // Process each step
    for (const step of steps) {
        const msgId = step.msgId;

        // Check for timestamps (Omega might include these in some message types)
        // This is speculative - actual implementation depends on Omega's format
        if (step.details?.timestamp) {
            hasTimestamps = true;
            const timestamp = step.details.timestamp;
            if (!firstTimestamp) firstTimestamp = timestamp;
            lastTimestamp = timestamp;
        }

        // Track turns
        if (msgId === MSG_NEW_TURN) {
            // Save previous turn metrics if it had any actions
            if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
                turnMetrics.push({ ...currentTurnMetrics });
            }

            // Start new turn
            currentTurn++;
            currentTurnMetrics = {
                turn: currentTurn,
                specialSummons: 0,
                effectActivations: 0,
                totalActions: 0
            };
            console.log(`Turn ${currentTurn} started`);
        }

        // Track Special Summons (MSG_SPSUMMONING = 62 = 0x3e)
        if (msgId === MSG_SPSUMMONING) {
            currentTurnMetrics.specialSummons++;
            currentTurnMetrics.totalActions++;
            totalSpecialSummons++;
        }

        // Track Effect Activations (MSG_CHAINING = 70 = 0x46)
        if (msgId === MSG_CHAINING) {
            currentTurnMetrics.effectActivations++;
            currentTurnMetrics.totalActions++;
            totalEffectActivations++;
        }

        // Track game end
        if (msgId === MSG_WIN) {
            gameEnded = true;
            turnsToWin = currentTurn;

            // Try to extract winner info from the message
            if (step.details) {
                winReason = step.details.reason;
                const playerByte = step.details.player;
                winner = playerByte !== undefined ? `Player${playerByte}` : undefined;
            }

            console.log(`Game ended on turn ${turnsToWin}, Winner: ${winner || 'Unknown'}`);
        }
    }

    // Add final turn metrics if game didn't end cleanly
    if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
        turnMetrics.push({ ...currentTurnMetrics });
    }

    // Calculate time analysis
    const timeAnalysis: TimeAnalysis = {
        hasTimestamps
    };

    if (hasTimestamps && firstTimestamp !== undefined && lastTimestamp !== undefined) {
        timeAnalysis.totalGameTime = lastTimestamp - firstTimestamp;
        // These would need more sophisticated analysis of action timestamps
        // For now, just indicate we have timestamp data
        console.log(`\nTime data available: ${timeAnalysis.totalGameTime}ms total game time`);
    }

    // Calculate OTK metrics
    const isOTK = gameEnded && turnsToWin !== undefined && turnsToWin <= 2;
    const otkMetrics: OTKMetrics = {
        gameEnded,
        winner,
        winReason,
        turnsToWin,
        isOTK
    };

    // Calculate summary statistics
    const totalActions = turnMetrics.reduce((sum, t) => sum + t.totalActions, 0);
    const avgActionsPerTurn = turnMetrics.length > 0 ? totalActions / turnMetrics.length : 0;
    const maxActions = turnMetrics.reduce((max, t) => Math.max(max, t.totalActions), 0);

    const results: TempoSpeedResults = {
        perTurnMetrics: turnMetrics,
        timeAnalysis,
        otkMetrics,
        summary: {
            averageActionsPerTurn: Math.round(avgActionsPerTurn * 10) / 10,
            maxActionsInSingleTurn: maxActions,
            totalSpecialSummons,
            totalEffectActivations
        }
    };

    return results;
}

function displayResults(results: TempoSpeedResults) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEMPO & SPEED ANALYSIS RESULTS`);
    console.log(`${'='.repeat(60)}\n`);

    // Summary
    console.log(`📊 SUMMARY`);
    console.log(`  Total Turns Analyzed: ${results.perTurnMetrics.length}`);
    console.log(`  Total Special Summons: ${results.summary.totalSpecialSummons}`);
    console.log(`  Total Effect Activations: ${results.summary.totalEffectActivations}`);
    console.log(`  Average Actions/Turn: ${results.summary.averageActionsPerTurn}`);
    console.log(`  Max Actions (Single Turn): ${results.summary.maxActionsInSingleTurn}\n`);

    // Per-Turn Breakdown
    console.log(`📈 ACTIONS PER TURN`);
    if (results.perTurnMetrics.length > 0) {
        results.perTurnMetrics.forEach(turn => {
            console.log(`  Turn ${turn.turn}: ${turn.totalActions} actions (${turn.specialSummons} SS, ${turn.effectActivations} FX)`);
        });
    } else {
        console.log(`  No turn data available`);
    }

    // Time Analysis
    console.log(`\n⏱️  TIME ANALYSIS`);
    if (results.timeAnalysis.hasTimestamps) {
        console.log(`  Total Game Time: ${results.timeAnalysis.totalGameTime}ms`);
        console.log(`  Note: Detailed thinking/action time breakdown requires timestamp analysis`);
    } else {
        console.log(`  ⚠️  No timestamp data available in replay`);
    }

    // OTK Metrics
    console.log(`\n🏆 OTK/WIN SPEED`);
    if (results.otkMetrics.gameEnded) {
        console.log(`  Game Ended: Yes`);
        console.log(`  Winner: ${results.otkMetrics.winner || 'Unknown'}`);
        console.log(`  Turns to Win: ${results.otkMetrics.turnsToWin}`);
        console.log(`  Is OTK: ${results.otkMetrics.isOTK ? 'YES! ⚡' : 'No'}`);
    } else {
        console.log(`  Game Ended: No (replay may be incomplete)`);
    }

    console.log(`\n${'='.repeat(60)}\n`);
}

async function main() {
    try {
        // Analyze the default replay file (ensure this path is correct for your setup)
        const replayPath = path.join(__dirname, '..', 'replays', 'YGO OMEGA REPLAY1.txt');

        if (!fs.existsSync(replayPath)) {
            console.error(`Replay file not found: ${replayPath}`);
            console.log(`Please ensure you have a replay file at this location.`);
            return;
        }

        const results = await analyzeTempoAndSpeed(replayPath);
        displayResults(results);

        // Save results to JSON
        const outputPath = path.join(__dirname, 'tempo_speed_results.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`Results saved to: ${outputPath}`);

    } catch (error: any) {
        console.error(`Error analyzing replay: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

main().catch(console.error);
