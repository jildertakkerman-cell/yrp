import { ReplayStep } from "./replay_decoder";

// Message type constants
const MSG_DRAW = 90;
const MSG_NEW_TURN = 40;
const MSG_START = 4;

// Card type constants for categorization
const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;

// Well-known hand trap card codes (partial list - expandable)
const KNOWN_HAND_TRAPS = new Set([
    23434538,   // Ash Blossom & Joyous Spring
    14558127,   // Maxx "C"
    10045474,   // Infinite Impermanence
    59438930,   // Ghost Belle & Haunted Mansion
    73642296,   // Ghost Ogre & Snow Rabbit
    52038441,   // Effect Veiler
    15693423,   // Droll & Lock Bird
    94145021,   // D.D. Crow
    97268402,   // Nibiru, the Primal Being
    24224830,   // Called by the Grave (acts as hand trap response)
    59438930,   // Ghost Belle
    43898403,   // PSY-Framegear Gamma
    49036338,   // Artifact Lancea
    50078509,   // Ghost Mourner & Moonlit Chill
]);

// Common starter/extender indicators (cards that search or special summon)
// This is heuristic-based - future enhancement could use card database
const STARTER_KEYWORDS = [
    'search', 'add', 'special summon', 'from deck'
];

export interface OpeningHandInfo {
    player: number;
    cards: number[]; // Card codes
    handSize: number;
}

export interface DeckComposition {
    totalCards: number;
    monsters: number;
    spells: number;
    traps: number;
    handTraps: number; // Known hand traps in deck
}

export interface HandQualityAnalysis {
    player: number;
    openingHand: number[];
    deckSize: number;

    // Card type breakdown
    monstersInHand: number;
    spellsInHand: number;
    trapsInHand: number;
    handTrapsInHand: number;

    // Probability analysis
    handQualityScore: number; // 0-100, higher = better hand
    percentile: number; // Where this hand falls in probability distribution

    // Verdict
    verdict: 'god_hand' | 'good' | 'average' | 'brick' | 'unplayable';
    verdictExplanation: string;
}

export interface HandAnalysisResult {
    player1Hand: HandQualityAnalysis | null;
    player2Hand: HandQualityAnalysis | null;
    deckInfo: {
        player1Deck: DeckComposition | null;
        player2Deck: DeckComposition | null;
    };
}

/**
 * Hypergeometric probability: probability of drawing exactly k successes 
 * in n draws from a population of N with K successes
 */
function hypergeometricProbability(N: number, K: number, n: number, k: number): number {
    if (k > K || k > n || n - k > N - K || k < 0) return 0;

    const binomial = (n: number, k: number): number => {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;

        let result = 1;
        for (let i = 0; i < k; i++) {
            result = result * (n - i) / (i + 1);
        }
        return result;
    };

    return (binomial(K, k) * binomial(N - K, n - k)) / binomial(N, n);
}

/**
 * Calculate cumulative probability of getting AT LEAST k successes
 */
function hypergeometricCumulativeAtLeast(N: number, K: number, n: number, k: number): number {
    let prob = 0;
    for (let i = k; i <= Math.min(K, n); i++) {
        prob += hypergeometricProbability(N, K, n, i);
    }
    return prob;
}

/**
 * Analyze deck composition (requires card type data - simplified version)
 */
function analyzeDeckComposition(deckCodes: number[]): DeckComposition {
    let handTraps = 0;

    // Count known hand traps
    for (const code of deckCodes) {
        if (KNOWN_HAND_TRAPS.has(code)) {
            handTraps++;
        }
    }

    return {
        totalCards: deckCodes.length,
        monsters: 0, // Would need card database to determine
        spells: 0,
        traps: 0,
        handTraps
    };
}

/**
 * Calculate hand quality score based on composition
 */
function calculateHandQualityScore(
    handCodes: number[],
    deckCodes: number[],
    deckComposition: DeckComposition
): { score: number; percentile: number; handTrapsDrawn: number } {
    const handSize = handCodes.length;
    const deckSize = deckCodes.length;

    // Count hand traps in opening hand
    let handTrapsDrawn = 0;
    for (const code of handCodes) {
        if (KNOWN_HAND_TRAPS.has(code)) {
            handTrapsDrawn++;
        }
    }

    // Count unique cards (non-duplicates indicate more options)
    const uniqueCards = new Set(handCodes).size;
    const diversityRatio = uniqueCards / handSize;

    // Scoring factors:
    // 1. Hand trap balance (1-2 is ideal for going second, 0-1 for going first)
    // 2. Card diversity (more unique = more options)
    // 3. Not all same type of card

    let score = 50; // Start at average

    // Hand trap scoring (ideal is 1-2)
    if (handTrapsDrawn === 1 || handTrapsDrawn === 2) {
        score += 15;
    } else if (handTrapsDrawn === 0) {
        score -= 5; // Slight penalty but not always bad
    } else if (handTrapsDrawn >= 3) {
        score -= 10 * (handTrapsDrawn - 2); // Diminishing returns on hand traps
    }

    // Diversity bonus
    score += (diversityRatio - 0.5) * 30;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    // Calculate percentile based on hand trap distribution probability
    let percentile = 50;
    if (deckComposition.handTraps > 0) {
        // What % of hands would have fewer hand traps than this?
        let cumulativeProb = 0;
        for (let i = 0; i < handTrapsDrawn; i++) {
            cumulativeProb += hypergeometricProbability(
                deckSize,
                deckComposition.handTraps,
                handSize,
                i
            );
        }
        percentile = Math.round(cumulativeProb * 100);
    }

    return { score, percentile, handTrapsDrawn };
}

/**
 * Determine verdict based on score
 */
function getVerdict(score: number, percentile: number, handTrapsDrawn: number, handSize: number): { verdict: HandQualityAnalysis['verdict']; explanation: string } {
    // All hand traps = brick
    if (handTrapsDrawn >= handSize - 1) {
        return {
            verdict: 'unplayable',
            explanation: `Opening ${handTrapsDrawn} hand traps in ${handSize} cards. Almost no playable cards.`
        };
    }

    // 4+ hand traps = brick
    if (handTrapsDrawn >= 4) {
        return {
            verdict: 'brick',
            explanation: `${handTrapsDrawn} hand traps significantly limit combo potential.`
        };
    }

    if (score >= 80 && percentile >= 85) {
        return {
            verdict: 'god_hand',
            explanation: `Top ${100 - percentile}% hand statistically. Excellent balance of cards.`
        };
    }

    if (score >= 65) {
        return {
            verdict: 'good',
            explanation: `Above average hand with good playability options.`
        };
    }

    if (score >= 40) {
        return {
            verdict: 'average',
            explanation: `Typical opening hand. Winnable with good sequencing.`
        };
    }

    if (score >= 20) {
        return {
            verdict: 'brick',
            explanation: `Below average hand. Limited options, likely relying on luck.`
        };
    }

    return {
        verdict: 'unplayable',
        explanation: `Bottom ${percentile}% hand. Very unlikely to win from here.`
    };
}

/**
 * Extract deck cards from MSG_UPDATE_DATA messages (for YRPX files)
 * These messages contain card info for all cards in LOCATION_DECK
 */
const MSG_UPDATE_DATA = 6;
const LOCATION_DECK = 0x01;

function extractDecksFromReplayMessages(parsedReplayData: ReplayStep[]): Array<{ main: number[]; extra: number[] }> {
    const playerDecks: Map<number, Set<number>> = new Map();

    // Look through MSG_UPDATE_DATA and MSG_MOVE messages to find deck cards
    for (const step of parsedReplayData) {
        if (!step.details) continue;

        // MSG_UPDATE_DATA contains bulk card data
        if (step.msgId === MSG_UPDATE_DATA) {
            const cards = step.details.cards as Array<{ code: number; controller?: number; location?: number }>;
            if (cards && Array.isArray(cards)) {
                for (const card of cards) {
                    // Only count cards with valid codes (not face-down/unknown)
                    if (card.code && card.code > 0) {
                        const player = card.controller ?? 0;
                        if (!playerDecks.has(player)) {
                            playerDecks.set(player, new Set());
                        }
                        playerDecks.get(player)!.add(card.code);
                    }
                }
            }
        }

        // Also track cards from MSG_MOVE that came from deck
        if (step.msgId === 50) { // MSG_MOVE
            const code = step.details.code as number;
            const oldLoc = step.details.oldLocation as number;
            const controller = step.details.oldController as number;

            if (code > 0 && (oldLoc & LOCATION_DECK)) {
                if (!playerDecks.has(controller)) {
                    playerDecks.set(controller, new Set());
                }
                playerDecks.get(controller)!.add(code);
            }
        }
    }

    // Convert to deck arrays
    const result: Array<{ main: number[]; extra: number[] }> = [];
    for (let p = 0; p <= 1; p++) {
        const cards = playerDecks.get(p);
        result.push({
            main: cards ? Array.from(cards) : [],
            extra: []
        });
    }

    console.log(`[HAND ANALYZER] Extracted deck cards from replay messages: P1=${result[0].main.length}, P2=${result[1].main.length}`);
    return result;
}

/**
 * Main analysis function
 */
export function analyzeOpeningHands(
    parsedReplayData: ReplayStep[],
    decks: Array<{ main: number[]; extra: number[] }> | null
): HandAnalysisResult {
    const result: HandAnalysisResult = {
        player1Hand: null,
        player2Hand: null,
        deckInfo: {
            player1Deck: null,
            player2Deck: null
        }
    };

    // Try to use provided decks, fallback to extracting from replay messages
    let effectiveDecks = decks;
    if (!decks || decks.length < 2 || (decks[0].main.length === 0 && decks[1].main.length === 0)) {
        console.log("[HAND ANALYZER] No deck data in header, extracting from replay messages...");
        effectiveDecks = extractDecksFromReplayMessages(parsedReplayData);
    }

    // If still no deck data, we can't do full analysis
    if (!effectiveDecks || effectiveDecks.length < 2 ||
        (effectiveDecks[0].main.length === 0 && effectiveDecks[1].main.length === 0)) {
        console.log("[HAND ANALYZER] Could not extract deck data");
        return result;
    }

    // Analyze deck compositions
    const deck1Composition = analyzeDeckComposition(effectiveDecks[0].main);
    const deck2Composition = analyzeDeckComposition(effectiveDecks[1].main);
    result.deckInfo.player1Deck = deck1Composition;
    result.deckInfo.player2Deck = deck2Composition;

    // Find opening hands from MSG_DRAW events at turn 0/1
    const openingHands: Map<number, number[]> = new Map();
    let currentTurn = 0;
    let drawsProcessed = 0;

    for (const step of parsedReplayData) {
        if (!step.details) continue;

        if (step.msgId === MSG_NEW_TURN) {
            currentTurn++;
            if (currentTurn > 1) break; // We only care about opening hands
        }

        if (step.msgId === MSG_DRAW && currentTurn <= 1) {
            const player = step.details.player as number;
            const cards = step.details.cards as Array<{ code: number }>;

            if (cards && cards.length > 0) {
                const cardCodes = cards.map(c => c.code).filter(c => c > 0);

                // First draw for each player is their opening hand
                if (!openingHands.has(player)) {
                    openingHands.set(player, cardCodes);
                    drawsProcessed++;
                } else {
                    // Add to existing hand (for draw phase)
                    const existing = openingHands.get(player)!;
                    openingHands.set(player, [...existing, ...cardCodes]);
                }
            }
        }
    }

    console.log(`[HAND ANALYZER] Found opening hands for ${openingHands.size} players`);

    // Analyze each player's hand
    const handEntries = Array.from(openingHands.entries());
    for (const [player, handCodes] of handEntries) {
        const deckIndex = player; // Player 0 = deck 0, Player 1 = deck 1
        if (deckIndex >= effectiveDecks.length) continue;

        const deckCodes = effectiveDecks[deckIndex].main;
        const deckComposition = player === 0 ? deck1Composition : deck2Composition;

        const { score, percentile, handTrapsDrawn } = calculateHandQualityScore(
            handCodes,
            deckCodes,
            deckComposition
        );

        const { verdict, explanation } = getVerdict(score, percentile, handTrapsDrawn, handCodes.length);

        const analysis: HandQualityAnalysis = {
            player,
            openingHand: handCodes,
            deckSize: deckCodes.length,
            monstersInHand: 0, // Would need card database
            spellsInHand: 0,
            trapsInHand: 0,
            handTrapsInHand: handTrapsDrawn,
            handQualityScore: Math.round(score),
            percentile,
            verdict,
            verdictExplanation: explanation
        };

        if (player === 0) {
            result.player1Hand = analysis;
        } else if (player === 1) {
            result.player2Hand = analysis;
        }
    }

    return result;
}
