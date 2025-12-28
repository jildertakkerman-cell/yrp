import { ReplayParserTS } from "./replay_parser_ts";
import { ReplayDecoder } from "./replay_decoder";
import * as fs from "fs";
import * as path from "path";

/**
 * Tempo & Speed Metrics Analysis for YRPX Replays
 * 
 * This script analyzes .yrpX replay files for:
 * 1. Actions Per Turn: Count Special Summons and Effect Activations per turn
 * 2. Time Analysis: Track thinking time vs. action time (if timestamps available)
 * 3. OTK Speed: Calculate turns to win for completed games
 */

interface TurnMetrics {
    turn: number;
    specialSummons: number;
    normalSummons: number;
    effectActivations: number;
    totalActions: number;
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
    replayInfo: {
        playerNames: string[];
        seed: number;
        startLP: number;
    };
    perTurnMetrics: TurnMetrics[];
    timeAnalysis: TimeAnalysis;
    otkMetrics: OTKMetrics;
    summary: {
        averageActionsPerTurn: number;
        maxActionsInSingleTurn: number;
        totalSpecialSummons: number;
        totalNormalSummons: number;
        totalEffectActivations: number;
    };
}

/**
 * Analyze a .yrpX replay file for tempo and speed metrics
 */
async function analyzeReplay(replayPath: string): Promise<TempoSpeedResults> {
    console.log(`\n=== Tempo & Speed Analysis ===`);
    console.log(`Analyzing: ${path.basename(replayPath)}\n`);

    // Load and parse the replay file
    const buffer = fs.readFileSync(replayPath);
    const replay = new ReplayParserTS(buffer);
    await replay.parse();

    console.log(`Player 0: ${replay.playerNames[0]}`);
    console.log(`Player 1: ${replay.playerNames[1]}`);
    console.log(`Seed: ${replay.header.seed}`);
    console.log(`Start LP: ${replay.params.startLP || 8000}\n`);

    // Decode the replay data
    const replayDataBuffer = replay.replayData;
    if (!replayDataBuffer) {
        throw new Error("No replay data found in file!");
    }

    const parsedSteps = ReplayDecoder.decode(replayDataBuffer, replay.header.id);
    console.log(`Total messages decoded: ${parsedSteps.length}\n`);

    // Initialize metrics
    const turnMetrics: TurnMetrics[] = [];
    let currentTurn = 0;
    let currentTurnMetrics: TurnMetrics = {
        turn: 0,
        specialSummons: 0,
        normalSummons: 0,
        effectActivations: 0,
        totalActions: 0
    };

    let gameEnded = false;
    let winner: string | undefined;
    let winReason: number | undefined;
    let turnsToWin: number | undefined;

    let totalSpecialSummons = 0;
    let totalNormalSummons = 0;
    let totalEffectActivations = 0;

    // Process each step
    for (const step of parsedSteps) {
        // Track new turns
        if (step.type === "MSG_NEW_TURN") {
            // Save previous turn metrics if it had any actions
            if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
                turnMetrics.push({ ...currentTurnMetrics });
            }

            // Start new turn
            currentTurn++;
            currentTurnMetrics = {
                turn: currentTurn,
                specialSummons: 0,
                normalSummons: 0,
                effectActivations: 0,
                totalActions: 0
            };
            console.log(`Turn ${currentTurn} started`);
        }

        // Track Special Summons
        if (step.type === "MSG_SPSUMMONING") {
            currentTurnMetrics.specialSummons++;
            currentTurnMetrics.totalActions++;
            totalSpecialSummons++;
        }

        // Track Normal Summons
        if (step.type === "MSG_SUMMONING") {
            currentTurnMetrics.normalSummons++;
            currentTurnMetrics.totalActions++;
            totalNormalSummons++;
        }

        // Track Effect Activations (chain activation)
        if (step.type === "MSG_CHAINING") {
            currentTurnMetrics.effectActivations++;
            currentTurnMetrics.totalActions++;
            totalEffectActivations++;
        }

        // Track game end
        if (step.type === "MSG_WIN") {
            gameEnded = true;
            turnsToWin = currentTurn;

            // Extract winner information
            if (step.details) {
                const playerIndex = step.details.player;
                winner = playerIndex !== undefined ? replay.playerNames[playerIndex] : undefined;
                winReason = step.details.type;
            }

            console.log(`Game ended on turn ${turnsToWin}, Winner: ${winner || "Unknown"}`);
        }
    }

    // Add final turn metrics if game didn't end cleanly
    if (currentTurn > 0 && currentTurnMetrics.totalActions > 0) {
        turnMetrics.push({ ...currentTurnMetrics });
    }

    // Time analysis - YRPX format doesn't include timestamps
    // This is a placeholder for future enhancement
    const timeAnalysis: TimeAnalysis = {
        hasTimestamps: false
    };

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
        replayInfo: {
            playerNames: replay.playerNames,
            seed: replay.header.seed,
            startLP: replay.params.startLP || 8000
        },
        perTurnMetrics: turnMetrics,
        timeAnalysis,
        otkMetrics,
        summary: {
            averageActionsPerTurn: Math.round(avgActionsPerTurn * 10) / 10,
            maxActionsInSingleTurn: maxActions,
            totalSpecialSummons,
            totalNormalSummons,
            totalEffectActivations
        }
    };

    return results;
}

/**
 * Display results in a formatted console output
 */
function displayResults(results: TempoSpeedResults, filename: string) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`TEMPO & SPEED ANALYSIS RESULTS`);
    console.log(`${"=".repeat(70)}\n`);

    // Replay Info
    console.log(`📋 REPLAY INFO`);
    console.log(`  File: ${filename}`);
    console.log(`  Player 0: ${results.replayInfo.playerNames[0]}`);
    console.log(`  Player 1: ${results.replayInfo.playerNames[1]}`);
    console.log(`  Start LP: ${results.replayInfo.startLP}`);
    console.log(`  Seed: ${results.replayInfo.seed}\n`);

    // Summary
    console.log(`📊 SUMMARY`);
    console.log(`  Total Turns Analyzed: ${results.perTurnMetrics.length}`);
    console.log(`  Total Normal Summons: ${results.summary.totalNormalSummons}`);
    console.log(`  Total Special Summons: ${results.summary.totalSpecialSummons}`);
    console.log(`  Total Effect Activations: ${results.summary.totalEffectActivations}`);
    console.log(`  Average Actions/Turn: ${results.summary.averageActionsPerTurn}`);
    console.log(`  Max Actions (Single Turn): ${results.summary.maxActionsInSingleTurn}\n`);

    // Per-Turn Breakdown
    console.log(`📈 ACTIONS PER TURN`);
    if (results.perTurnMetrics.length > 0) {
        results.perTurnMetrics.forEach(turn => {
            const ns = turn.normalSummons > 0 ? `${turn.normalSummons} NS, ` : "";
            const ss = turn.specialSummons > 0 ? `${turn.specialSummons} SS, ` : "";
            const fx = turn.effectActivations > 0 ? `${turn.effectActivations} FX` : "";
            console.log(`  Turn ${turn.turn}: ${turn.totalActions} actions (${ns}${ss}${fx})`);
        });
    } else {
        console.log(`  No turn data available`);
    }

    // Time Analysis
    console.log(`\n⏱️  TIME ANALYSIS`);
    if (results.timeAnalysis.hasTimestamps) {
        console.log(`  Total Game Time: ${results.timeAnalysis.totalGameTime}s`);
        if (results.timeAnalysis.thinkingTime && results.timeAnalysis.actionTime) {
            console.log(`  Thinking Time: ${results.timeAnalysis.thinkingTime}s (${results.timeAnalysis.thinkingPercentage}%)`);
            console.log(`  Action Time: ${results.timeAnalysis.actionTime}s`);
        }
    } else {
        console.log(`  ⚠️  No timestamp data available in YRPX format`);
    }

    // OTK Metrics
    console.log(`\n🏆 OTK/WIN SPEED`);
    if (results.otkMetrics.gameEnded) {
        console.log(`  Game Ended: Yes`);
        console.log(`  Winner: ${results.otkMetrics.winner || "Unknown"}`);
        console.log(`  Turns to Win: ${results.otkMetrics.turnsToWin}`);
        console.log(`  Is OTK: ${results.otkMetrics.isOTK ? "YES! ⚡" : "No"}`);
    } else {
        console.log(`  Game Ended: No (replay may be incomplete)`);
    }

    console.log(`\n${"=".repeat(70)}\n`);
}

/**
 * Main function - processes replay file(s)
 */
async function main() {
    try {
        // Check if a specific file was provided as command line argument
        const replayPath = process.argv[2] || path.join(process.cwd(), "replays", "ABC XYZ combo Hangar.yrpX");

        if (!fs.existsSync(replayPath)) {
            console.error(`❌ Replay file not found: ${replayPath}`);
            console.log(`\nUsage: npx ts-node src/tempo_speed_analysis.ts [path/to/replay.yrpX]`);
            console.log(`\nAvailable replay files:`);

            const replaysDir = path.join(process.cwd(), "replays");
            if (fs.existsSync(replaysDir)) {
                const files = fs.readdirSync(replaysDir).filter(f => f.endsWith(".yrpX"));
                files.forEach(f => console.log(`  - ${f}`));
            }
            return;
        }

        const results = await analyzeReplay(replayPath);
        displayResults(results, path.basename(replayPath));

        // Save results to JSON
        const outputPath = path.join(process.cwd(), "tempo_speed_results.json");
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`✅ Results saved to: ${outputPath}`);

    } catch (error: any) {
        console.error(`❌ Error analyzing replay: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main().catch(console.error);
