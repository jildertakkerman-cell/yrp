import { ReplayStep } from "./replay_decoder";
// @ts-ignore - node-fetch types
import fetch from 'node-fetch';

// Message type constants
const MSG_DRAW = 90;
const MSG_NEW_TURN = 40;
const MSG_START = 4;

// Card type constants for categorization
const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;

// Well-known hand trap card codes - verified against YGOProDeck API
const KNOWN_HAND_TRAPS = new Set([
    // Ash Blossom & Joyous Spring (negates add/SS/mill from deck)
    14558127,   // Ash Blossom & Joyous Spring
    14558128,   // Ash Blossom & Joyous Spring (alt art)

    // Maxx "C" (draw when opponent SS) - Banned in TCG
    23434538,   // Maxx "C"

    // Infinite Impermanence (negate monster effects, can activate from hand)
    10045474,   // Infinite Impermanence

    // Droll & Lock Bird (locks adding from deck)
    94145021,   // Droll & Lock Bird
    94145022,   // Droll & Lock Bird (alt art)

    // Ghost Belle & Haunted Mansion (negates GY effects)
    73642296,   // Ghost Belle & Haunted Mansion
    73642297,   // Ghost Belle & Haunted Mansion (alt art)

    // Ghost Ogre & Snow Rabbit (destroys activated card)
    59438930,   // Ghost Ogre & Snow Rabbit
    59438931,   // Ghost Ogre & Snow Rabbit (alt art)

    // Effect Veiler (negates monster effects during opponent's MP)
    97268402,   // Effect Veiler

    // Nibiru, the Primal Being (tributes all monsters after 5+ summons)
    27204311,   // Nibiru, the Primal Being

    // D.D. Crow (banishes from opponent's GY)
    24508238,   // D.D. Crow

    // Other hand traps
    24224830,   // Called by the Grave (acts as hand trap response)
    43898403,   // PSY-Framegear Gamma
    49036338,   // Artifact Lancea
    50078509,   // Ghost Mourner & Moonlit Chill
    84192580,   // Mulcharmy Purulia
    42141493,   // Mulcharmy Fuwalos
    93457100,   // Mulcharmy Meowls
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

    // Archetype analysis
    archetypesIdentified: string[];   // Main archetypes in deck
    archetypeCardsInHand: number;     // Count of archetype cards in hand
    archetypeDensity: number;         // Percentage of hand that's archetype cards (0-100)
    garnetsInHand: number;            // Count of "Garnets" (1-off archetype cards drawn)

    // Probability analysis
    handQualityScore: number; // 0-100, higher = better hand
    percentile: number; // Where this hand falls in probability distribution

    // Verdict
    isGoingFirst: boolean;
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
    // Deck cards extracted from replay messages (for YRPX files where file parsing fails)
    extractedDecks: Array<{ main: number[]; extra: number[] }> | null;
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

interface CardData {
    archetype: string | null;
    isRestricted: boolean; // True if Limited or Semi-Limited in TCG
}

/**
 * Fetch card archetypes and banlist status from YGOProDeck API
 * Uses batch requests with comma-separated IDs (max 50 per request)
 */
async function fetchCardArchetypes(cardCodes: number[]): Promise<Map<number, CardData>> {
    const archetypeMap = new Map<number, CardData>();

    if (cardCodes.length === 0) return archetypeMap;

    // Get unique codes
    const uniqueCodes = [...new Set(cardCodes)];

    // Split into batches of 50
    const batchSize = 50;
    for (let i = 0; i < uniqueCodes.length; i += batchSize) {
        const batch = uniqueCodes.slice(i, i + batchSize);
        const idsParam = batch.join(',');

        try {
            const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${idsParam}`);
            if (!response.ok) {
                console.log(`[HAND ANALYZER] API call failed for batch: ${response.status}`);
                continue;
            }

            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                for (const card of data.data) {
                    if (card.id) {
                        const archetype = card.archetype || null;

                        // Check if card is restricted in TCG (Limited or Semi-Limited)
                        let isRestricted = false;
                        if (card.banlist_info && card.banlist_info.ban_tcg) {
                            const banStatus = card.banlist_info.ban_tcg;
                            if (banStatus === 'Limited' || banStatus === 'Semi-Limited') {
                                isRestricted = true;
                            }
                        }

                        archetypeMap.set(card.id, { archetype, isRestricted });
                    }
                }
            }
        } catch (error) {
            console.log(`[HAND ANALYZER] Error fetching card data: ${error}`);
        }
    }

    console.log(`[HAND ANALYZER] Fetched archetypes for ${archetypeMap.size}/${uniqueCodes.length} cards`);
    return archetypeMap;
}

/**
 * Identify main archetypes in deck (archetypes with 3+ cards)
 */
function identifyDeckArchetypes(deckCodes: number[], archetypeMap: Map<number, CardData>): string[] {
    const archetypeCounts = new Map<string, number>();

    for (const code of deckCodes) {
        const cardData = archetypeMap.get(code);
        if (cardData && cardData.archetype) {
            archetypeCounts.set(cardData.archetype, (archetypeCounts.get(cardData.archetype) || 0) + 1);
        }
    }

    // Return archetypes with 3+ cards, sorted by count descending
    // Exclude "Mulcharmy" as requested, as it's treated primarily as a hand trap set
    const mainArchetypes = Array.from(archetypeCounts.entries())
        .filter(([name, count]) => count >= 3 && name !== 'Mulcharmy')
        .sort((a, b) => b[1] - a[1])
        .map(([name, _]) => name);

    console.log(`[HAND ANALYZER] Main archetypes identified: ${mainArchetypes.join(', ') || 'none'}`);
    return mainArchetypes;
}

/**
 * Count archetype cards in hand
 */
function countArchetypeCardsInHand(
    handCodes: number[],
    mainArchetypes: string[],
    archetypeMap: Map<number, CardData>
): number {
    if (mainArchetypes.length === 0) return 0;

    const mainArchetypeSet = new Set(mainArchetypes);
    let count = 0;

    for (const code of handCodes) {
        const cardData = archetypeMap.get(code);
        if (cardData && cardData.archetype && mainArchetypeSet.has(cardData.archetype)) {
            count++;
        }
    }

    return count;
}

/**
 * Calculate hand quality score based on composition
 */
function calculateHandQualityScore(
    handCodes: number[],
    deckCodes: number[],
    deckComposition: DeckComposition,
    archetypeMap: Map<number, CardData>,
    mainArchetypes: string[],
    isGoingFirst: boolean
): { score: number; percentile: number; handTrapsDrawn: number; garnetsDrawn: number } {
    const handSize = handCodes.length;
    const deckSize = deckCodes.length;

    // Pre-calculate deck counts for 1-off detection
    const deckCounts = new Map<number, number>();
    for (const code of deckCodes) {
        deckCounts.set(code, (deckCounts.get(code) || 0) + 1);
    }

    // Identify main archetypes as a set for faster lookup
    const mainArchetypeSet = new Set(mainArchetypes);

    // Count hand traps and garnets in opening hand
    let handTrapsDrawn = 0;
    let garnetsDrawn = 0;

    for (const code of handCodes) {
        if (KNOWN_HAND_TRAPS.has(code)) {
            handTrapsDrawn++;
        }

        // Garnet Check:
        // 1. Is it a 1-off in the deck?
        // 2. Is it part of a main archetype?
        // 3. Is it NOT restricted on the banlist?
        const countInDeck = deckCounts.get(code) || 0;
        const cardData = archetypeMap.get(code);

        if (countInDeck === 1 &&
            cardData && cardData.archetype && mainArchetypeSet.has(cardData.archetype) &&
            !cardData.isRestricted) {
            garnetsDrawn++;
        }
    }

    // Count unique cards (non-duplicates indicate more options)
    const uniqueCards = new Set(handCodes).size;
    const diversityRatio = uniqueCards / handSize;

    // Scoring factors:
    // 1. Hand trap balance (Adjusted by turn order)
    // 2. Card diversity (more unique = more options)
    // 3. Garnet penalty (-15 per garnet)

    let score = 50; // Start at average

    // Hand trap scoring
    if (isGoingFirst) {
        // Going First: 0-1 hand traps is ideal (+15). 2+ is clunky (-5 per extra).
        if (handTrapsDrawn <= 1) {
            score += 15;
        } else {
            score -= 10 * (handTrapsDrawn - 1);
        }
    } else {
        // Going Second: 2+ hand traps is ideal (+15). 0 is a heavy penalty (-20).
        if (handTrapsDrawn >= 2) {
            score += 15;
        } else if (handTrapsDrawn === 1) {
            score += 5; // Better than nothing
        } else {
            score -= 20; // 0 hand traps going second is bad
        }
    }

    // Diversity bonus
    score += (diversityRatio - 0.5) * 30;

    // Garnet Penalty
    score -= (garnetsDrawn * 15);

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

    return { score, percentile, handTrapsDrawn, garnetsDrawn };
}

/**
 * Determine verdict based on score
 */
function getVerdict(score: number, percentile: number, handTrapsDrawn: number, garnetsDrawn: number, handSize: number, isGoingFirst: boolean): { verdict: HandQualityAnalysis['verdict']; explanation: string } {
    // All hand traps = brick (more leniency going second)
    const brickThreshold = isGoingFirst ? handSize - 1 : handSize;
    if (handTrapsDrawn >= brickThreshold) {
        return {
            verdict: 'brick',
            explanation: `${handTrapsDrawn} hand traps significantly limit engine access going ${isGoingFirst ? 'first' : 'second'}.`
        };
    }

    // 4+ hand traps = brick
    if (handTrapsDrawn >= 4) {
        return {
            verdict: 'brick',
            explanation: `${handTrapsDrawn} hand traps significantly limit combo potential.`
        };
    }

    const garnetText = garnetsDrawn > 0 ? ` with ${garnetsDrawn} "Garnet" brick(s)` : '';

    if (score >= 80 && percentile >= 85) {
        return {
            verdict: 'god_hand',
            explanation: `Top ${100 - percentile}% hand statistically. Excellent balance of cards${garnetText}.`
        };
    }

    if (score >= 65) {
        return {
            verdict: 'good',
            explanation: `Above average hand with good playability options${garnetText}.`
        };
    }

    if (score >= 40) {
        return {
            verdict: 'average',
            explanation: `Typical opening hand${garnetText}. Winnable with good sequencing.`
        };
    }

    if (score >= 20) {
        return {
            verdict: 'brick',
            explanation: `Below average hand${garnetText}. Limited options, likely relying on luck.`
        };
    }

    return {
        verdict: 'unplayable',
        explanation: `Bottom ${percentile}% hand${garnetText}. Very unlikely to win from here.`
    };
}

/**
 * Extract deck cards from MSG_UPDATE_DATA messages (for YRPX files)
 * These messages contain card info for all cards at specific locations
 */
const MSG_UPDATE_DATA = 6;
const LOCATION_DECK = 0x01;
const LOCATION_EXTRA = 0x40;

function extractDecksFromReplayMessages(parsedReplayData: ReplayStep[]): Array<{ main: number[]; extra: number[] }> {
    // Use arrays to preserve duplicates (3x of a card = 3 entries)
    const playerMainDecks: Map<number, number[]> = new Map();
    const playerExtraDecks: Map<number, number[]> = new Map();

    // Initialize for both players
    playerMainDecks.set(0, []);
    playerMainDecks.set(1, []);
    playerExtraDecks.set(0, []);
    playerExtraDecks.set(1, []);

    // Track which player/location combos we've already captured
    // We only want the FIRST MSG_UPDATE_DATA for each, which is the initial deck state
    const capturedMainDeck: Set<number> = new Set();
    const capturedExtraDeck: Set<number> = new Set();

    let foundDeckData = false;

    // Look through MSG_UPDATE_DATA messages for initial deck data
    // The FIRST MSG_UPDATE_DATA messages with location DECK contain the initial deck
    for (const step of parsedReplayData) {
        if (!step.details) continue;

        // MSG_UPDATE_DATA contains bulk card data for a specific location
        if (step.msgId === MSG_UPDATE_DATA) {
            const player = step.details.player as number;
            const location = step.details.location as number;
            const cards = step.details.cards as Array<{ code: number }>;

            if (player === undefined || player < 0 || player > 1) continue;
            if (!cards || !Array.isArray(cards)) continue;

            // Filter by location - only take DECK or EXTRA deck cards
            // Only capture the FIRST occurrence for each player/location
            if (location === LOCATION_DECK && !capturedMainDeck.has(player)) {
                const deckArray = playerMainDecks.get(player)!;
                for (const card of cards) {
                    if (card.code && card.code > 0) {
                        deckArray.push(card.code);
                    }
                }
                capturedMainDeck.add(player);
                foundDeckData = true;
                console.log(`[HAND ANALYZER] MSG_UPDATE_DATA: Player ${player} DECK - ${deckArray.length} cards (FIRST occurrence, captured)`);
            } else if (location === LOCATION_EXTRA && !capturedExtraDeck.has(player)) {
                const extraArray = playerExtraDecks.get(player)!;
                for (const card of cards) {
                    if (card.code && card.code > 0) {
                        extraArray.push(card.code);
                    }
                }
                capturedExtraDeck.add(player);
                console.log(`[HAND ANALYZER] MSG_UPDATE_DATA: Player ${player} EXTRA - ${extraArray.length} cards (FIRST occurrence, captured)`);
            }

            // Stop early if we've captured all 4 combinations (2 players x 2 locations)
            if (capturedMainDeck.size === 2 && capturedExtraDeck.size === 2) {
                console.log("[HAND ANALYZER] All deck data captured, stopping early");
                break;
            }
        }
    }

    // If we didn't find deck data from MSG_UPDATE_DATA, try MSG_MOVE as fallback
    if (!foundDeckData) {
        console.log("[HAND ANALYZER] No deck data from MSG_UPDATE_DATA, trying MSG_MOVE fallback...");
        const seenCards: Map<number, Set<number>> = new Map();
        seenCards.set(0, new Set());
        seenCards.set(1, new Set());

        for (const step of parsedReplayData) {
            if (!step.details) continue;

            // MSG_MOVE tracks cards that moved from deck
            if (step.msgId === 50) { // MSG_MOVE
                const code = step.details.code as number;
                const oldLoc = step.details.oldLocation as number;
                const controller = step.details.oldController as number;

                if (code > 0 && controller >= 0 && controller <= 1) {
                    if ((oldLoc & LOCATION_DECK) && !seenCards.get(controller)!.has(code)) {
                        playerMainDecks.get(controller)!.push(code);
                        seenCards.get(controller)!.add(code);
                    } else if ((oldLoc & LOCATION_EXTRA) && !seenCards.get(controller)!.has(code)) {
                        playerExtraDecks.get(controller)!.push(code);
                        seenCards.get(controller)!.add(code);
                    }
                }
            }
        }
    }

    // Build result array
    const result: Array<{ main: number[]; extra: number[] }> = [];
    for (let p = 0; p <= 1; p++) {
        result.push({
            main: playerMainDecks.get(p) || [],
            extra: playerExtraDecks.get(p) || []
        });
    }

    console.log(`[HAND ANALYZER] Extracted deck cards: P1 main=${result[0].main.length} extra=${result[0].extra.length}, P2 main=${result[1].main.length} extra=${result[1].extra.length}`);
    return result;
}

/**
 * Extract deck sizes from MSG_START messages (more reliable for YRPX replays)
 */
function extractDeckSizesFromMessages(parsedReplayData: ReplayStep[]): { player1: number; player2: number } {
    const sizes = { player1: 0, player2: 0 };

    for (const step of parsedReplayData) {
        if (step.msgId === MSG_START && step.details) {
            // MSG_START contains both players' deck sizes in a single message
            const deckSize = step.details.deckSize as number;
            const deck2Size = step.details.deck2Size as number;

            if (deckSize && deckSize > 0) {
                sizes.player1 = deckSize;
            }
            if (deck2Size && deck2Size > 0) {
                sizes.player2 = deck2Size;
            }

            console.log(`[HAND ANALYZER] Extracted deck sizes from MSG_START: P1=${sizes.player1}, P2=${sizes.player2}`);
            break; // Only one MSG_START per game
        }
    }

    return sizes;
}

/**
 * Main analysis function
 */
export async function analyzeOpeningHands(
    parsedReplayData: ReplayStep[],
    decks: Array<{ main: number[]; extra: number[] }> | null
): Promise<HandAnalysisResult> {
    const result: HandAnalysisResult = {
        player1Hand: null,
        player2Hand: null,
        deckInfo: {
            player1Deck: null,
            player2Deck: null
        },
        extractedDecks: null
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

    // Get accurate deck sizes from MSG_START (more reliable for YRPX)
    const deckSizes = extractDeckSizesFromMessages(parsedReplayData);

    // Analyze deck compositions
    const deck1Composition = analyzeDeckComposition(effectiveDecks[0].main);
    const deck2Composition = analyzeDeckComposition(effectiveDecks[1].main);

    // Override totalCards with MSG_START values if available
    if (deckSizes.player1 > 0) {
        deck1Composition.totalCards = deckSizes.player1;
    }
    if (deckSizes.player2 > 0) {
        deck2Composition.totalCards = deckSizes.player2;
    }

    result.deckInfo.player1Deck = deck1Composition;
    result.deckInfo.player2Deck = deck2Composition;

    // Fetch archetypes for all cards in both decks
    const allDeckCodes = [...effectiveDecks[0].main, ...effectiveDecks[1].main];
    const archetypeMap = await fetchCardArchetypes(allDeckCodes);

    // Identify main archetypes for each deck
    const deck1Archetypes = identifyDeckArchetypes(effectiveDecks[0].main, archetypeMap);
    const deck2Archetypes = identifyDeckArchetypes(effectiveDecks[1].main, archetypeMap);

    // Find opening hands from MSG_DRAW events at turn 0/1
    const openingHands: Map<number, number[]> = new Map();
    let currentTurn = 0;
    let startingPlayer: number | null = null;
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

                // Detect starting player (first player to draw cards)
                if (startingPlayer === null) {
                    startingPlayer = player;
                    console.log(`[HAND ANALYZER] Detected starting player: Player ${startingPlayer}`);
                }

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
        const deckArchetypes = player === 0 ? deck1Archetypes : deck2Archetypes;
        const isGoingFirst = player === startingPlayer;

        // Count archetype cards in hand
        const archetypeCardsInHand = countArchetypeCardsInHand(handCodes, deckArchetypes, archetypeMap);
        const archetypeDensity = handCodes.length > 0
            ? Math.round((archetypeCardsInHand / handCodes.length) * 100)
            : 0;

        const { score, percentile, handTrapsDrawn, garnetsDrawn } = calculateHandQualityScore(
            handCodes,
            deckCodes,
            deckComposition,
            archetypeMap,
            deckArchetypes,
            isGoingFirst
        );

        // Adjust score based on archetype density
        let adjustedScore = score;
        if (archetypeCardsInHand >= 3) {
            adjustedScore += 10; // Bonus for good archetype density
        } else if (archetypeCardsInHand === 0 && deckArchetypes.length > 0) {
            adjustedScore -= 10; // Penalty for no archetype cards when deck has archetypes
        }
        adjustedScore = Math.max(0, Math.min(100, adjustedScore)); // Clamp to 0-100

        const { verdict, explanation } = getVerdict(adjustedScore, percentile, handTrapsDrawn, garnetsDrawn, handCodes.length, isGoingFirst);

        const analysis: HandQualityAnalysis = {
            player,
            openingHand: handCodes,
            deckSize: deckComposition.totalCards, // Use corrected size from MSG_START
            monstersInHand: 0, // Would need card database
            spellsInHand: 0,
            trapsInHand: 0,
            handTrapsInHand: handTrapsDrawn,
            archetypesIdentified: deckArchetypes,
            archetypeCardsInHand,
            archetypeDensity,
            garnetsInHand: garnetsDrawn,
            handQualityScore: Math.round(adjustedScore),
            percentile,
            isGoingFirst,
            verdict,
            verdictExplanation: explanation
        };

        if (player === 0) {
            result.player1Hand = analysis;
        } else if (player === 1) {
            result.player2Hand = analysis;
        }
    }

    // Store the effective decks so they can be used by the server
    result.extractedDecks = effectiveDecks;

    return result;
}
