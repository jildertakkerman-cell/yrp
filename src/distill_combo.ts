import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

// Interfaces for the Input JSON (Replay Parser Output)
interface ReplayData {
    header: any;
    parsedReplayData: ReplayStep[];
}

interface ReplayStep {
    type: string;
    raw: string;
    msgId?: number;
    len?: number;
    details?: any;
}

// Interfaces for the Output JSON (Combo Format)
interface ComboOutput {
    archetype: string;
    combos: { [key: string]: ComboDetail };
}

interface ComboDetail {
    title: string;
    description: string;
    cards: CardDetail[];
    steps: ComboStep[];
}

interface CardDetail {
    id: string;
    name: string;
    type: string;
    zone: string;
}

interface ComboStep {
    text: string;
    card?: string;
    to?: string;
    actions?: { card: string; to: string }[];
}

// YGOProDeck API Response Interface
interface YgoProDeckCard {
    id: number;
    name: string;
    type: string;
    desc: string;
    atk: number;
    def: number;
    level: number;
    race: string;
    attribute: string;
    card_images: { id: number; image_url: string; image_url_small: string }[];
}

// Helper to fetch card data
async function fetchCardData(cardIds: number[]): Promise<Map<number, YgoProDeckCard>> {
    const cardMap = new Map<number, YgoProDeckCard>();
    const uniqueIds = Array.from(new Set(cardIds));

    if (uniqueIds.length === 0) return cardMap;

    console.log(`Fetching data for ${uniqueIds.length} cards...`);

    const chunkSize = 20;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${chunk.join(",")}`;

        await new Promise<void>((resolve, reject) => {
            https.get(url, (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.data) {
                            for (const card of response.data) {
                                cardMap.set(card.id, card);
                            }
                        }
                        resolve();
                    } catch (e) {
                        console.error("Error parsing API response", e);
                        resolve();
                    }
                });
            }).on("error", (err) => {
                console.error("Error fetching card data", err);
                resolve();
            });
        });
    }

    return cardMap;
}

// Main distillation function (in-memory)
export async function distillReplayData(replayJson: ReplayData): Promise<ComboOutput> {
    const steps: ComboStep[] = [];
    const cardIds = new Set<number>();
    const cardIdToAlias = new Map<number, string>();

    // Helper to get or create alias
    const getAlias = (code: number) => {
        if (!cardIdToAlias.has(code)) {
            cardIdToAlias.set(code, `card_${code}`);
        }
        return cardIdToAlias.get(code)!;
    };

    // Helper to map location/sequence to zone name
    const getZoneName = (loc: number, seq: number): string => {
        // Location Constants
        const LOCATION_DECK = 0x01;
        const LOCATION_HAND = 0x02;
        const LOCATION_MZONE = 0x04;
        const LOCATION_SZONE = 0x08;
        const LOCATION_GRAVE = 0x10;
        const LOCATION_REMOVED = 0x20;
        const LOCATION_EXTRA = 0x40;
        const LOCATION_OVERLAY = 0x80;

        // Handle Overlay: Map to the base zone (under the Xyz monster)
        if (loc & LOCATION_OVERLAY) {
            const baseLoc = loc & ~LOCATION_OVERLAY;
            if (baseLoc & LOCATION_EXTRA) {
                // Special case: Overlay on Extra Deck monster (or during summon)
                // Map to MZONE based on sequence (usually matches the Xyz monster's zone)
                return `zone-m${seq + 1}`;
            }
            loc = baseLoc;
        }

        if (loc & LOCATION_HAND) return "zone-hand";
        if (loc & LOCATION_DECK) return "zone-deck";
        if (loc & LOCATION_GRAVE) return "zone-gy";
        if (loc & LOCATION_REMOVED) return "zone-banish";
        if (loc & LOCATION_EXTRA) return "zone-extra";

        if (loc & LOCATION_MZONE) {
            if (seq < 5) return `zone-m${seq + 1}`; // 0->m1, 4->m5
            if (seq === 5) return "zone-em-left";
            if (seq === 6) return "zone-em-right";
        }

        if (loc & LOCATION_SZONE) {
            if (seq < 5) return `zone-s${seq + 1}`; // 0->s1, 4->s5
            if (seq === 5) return "zone-field";
        }

        return "zone-deck"; // Default fallback
    };

    // Chain tracking for effect causes
    const chainStack: number[] = [];
    let isChainResolving = false;

    for (const step of replayJson.parsedReplayData) {
        if (!step.details) {
            // Handle events without details
            if (step.type === "MSG_CHAIN_SOLVING") {
                isChainResolving = true;
            } else if (step.type === "MSG_CHAIN_SOLVED") {
                // One link resolved, pop from stack
                chainStack.pop();
            } else if (step.type === "MSG_CHAIN_END") {
                // Chain finished completely
                isChainResolving = false;
                chainStack.length = 0;
            }
            continue;
        }

        // Track MSG_CHAINING to know which card is activating
        if (step.type === "MSG_CHAINING") {
            if (step.details.code) {
                chainStack.push(step.details.code);
                cardIds.add(step.details.code);
            }
        }

        if (step.type === "MSG_SUMMONING" || step.type === "MSG_SPSUMMONING") {
            if (step.details.code) {
                cardIds.add(step.details.code);

                // Get the current chain card if resolving
                const currentChainCard = isChainResolving && chainStack.length > 0 ? chainStack[chainStack.length - 1] : undefined;

                steps.push({
                    text: `${step.type === "MSG_SUMMONING" ? "Normal" : "Special"} Summon`,
                    card: getAlias(step.details.code),
                    to: getZoneName(step.details.location, step.details.sequence),
                    chainCard: currentChainCard
                } as any);
            }
        } else if (step.type === "MSG_CHAINING") {
            if (step.details.code) {
                cardIds.add(step.details.code);

                let targetZone = getZoneName(step.details.location, step.details.sequence);

                // If activating from hand, default to field for visual effect
                if (targetZone === "zone-hand") {
                    targetZone = "zone-field";
                }

                steps.push({
                    text: `Activate Effect`,
                    card: getAlias(step.details.code),
                    to: targetZone
                });
            }
        } else if (step.type === "MSG_EQUIP") {
            if (step.details.location !== undefined && step.details.sequence !== undefined) {
                const targetZone = getZoneName(step.details.targetLocation, step.details.targetSequence);

                steps.push({
                    text: `Equip Card`,
                    to: targetZone
                });
            }
        } else if (step.type === "MSG_DRAW") {
            if (step.details.cards && Array.isArray(step.details.cards)) {
                for (const card of step.details.cards) {
                    if (card.code) {
                        cardIds.add(card.code);
                        steps.push({
                            text: `Draw`,
                            card: getAlias(card.code),
                            to: getZoneName(card.location, card.sequence)
                        });
                    }
                }
            }
        } else if (step.type === "MSG_MOVE") {
            if (step.details.code) {
                cardIds.add(step.details.code);

                const newLoc = step.details.newLocation;
                let locName = "Unknown Location";
                let text = "Move to";

                // Location Constants
                const LOCATION_DECK = 0x01;
                const LOCATION_HAND = 0x02;
                const LOCATION_MZONE = 0x04;
                const LOCATION_SZONE = 0x08;
                const LOCATION_GRAVE = 0x10;
                const LOCATION_REMOVED = 0x20;
                const LOCATION_EXTRA = 0x40;
                const LOCATION_OVERLAY = 0x80;

                if (newLoc & LOCATION_OVERLAY) {
                    locName = "Overlay Material";
                    text = "Attach as Material";
                } else if (newLoc & LOCATION_DECK) locName = "Deck";
                else if (newLoc & LOCATION_HAND) locName = "Hand";
                else if (newLoc & LOCATION_MZONE) locName = "Main Monster Zone";
                else if (newLoc & LOCATION_SZONE) locName = "Spell/Trap Zone";
                else if (newLoc & LOCATION_GRAVE) locName = "Graveyard";
                else if (newLoc & LOCATION_REMOVED) locName = "Banished";
                else if (newLoc & LOCATION_EXTRA) locName = "Extra Deck";

                // Check for specific reasons if available (heuristic)
                if (step.details.reasonName && step.details.reasonName.includes("MATERIAL")) {
                    if (newLoc & LOCATION_OVERLAY) {
                        text = "Attach as Material";
                    } else {
                        text = "Send to";
                        // Append "as Material" to locName or handle in text construction
                        locName += " as Material";
                    }
                }

                steps.push({
                    text: `${text} ${locName === "Overlay Material" ? "" : locName}`.trim(),
                    card: getAlias(step.details.code),
                    to: getZoneName(step.details.newLocation, step.details.newSequence)
                });
            }
        }
    }

    // Fetch Card Data
    const cardMap = await fetchCardData(Array.from(cardIds));

    // Build Cards Array
    const cards: CardDetail[] = [];
    for (const id of Array.from(cardIds)) {
        const card = cardMap.get(id);
        let zone = "zone-deck";
        let simpleType = "monster";

        if (card) {
            const typeLower = card.type.toLowerCase();

            if (typeLower.includes("spell")) {
                simpleType = "spell";
            } else if (typeLower.includes("trap")) {
                simpleType = "trap";
            } else if (typeLower.includes("fusion") || typeLower.includes("synchro") ||
                typeLower.includes("xyz") || typeLower.includes("link")) {
                simpleType = "extra";
                zone = "zone-extra";
            }
        }

        cards.push({
            id: getAlias(id),
            name: card ? card.name : `Unknown Card ${id}`,
            type: simpleType,
            zone: zone
        });
    }

    // Update Step Texts with Card Names
    for (const s of steps) {
        const alias = s.card;
        if (alias) {
            const c = cards.find(x => x.id === alias);
            if (c) {
                s.text += ` ${c.name}`;

                // Add cause information if this summon was from a chain resolution
                const chainCardCode = (s as any).chainCard;
                if (chainCardCode) {
                    const cardId = parseInt(alias.replace('card_', ''));
                    const chainCardAlias = getAlias(chainCardCode);
                    const chainCard = cards.find(x => x.id === chainCardAlias);

                    // If the chain card is the same as the summoned card, it's a self-effect
                    if (chainCardCode === cardId) {
                        // Check if it's a union monster by looking at card type
                        const cardData = cardMap.get(cardId);
                        if (cardData && cardData.type.toLowerCase().includes("union")) {
                            s.text += " (Union Effect)";
                        } else {
                            s.text += " (own effect)";
                        }
                    } else if (chainCard) {
                        // Different card caused the summon
                        s.text += ` (via ${chainCard.name})`;
                    }
                }
            }
        }
    }

    const output: ComboOutput = {
        archetype: "ABC",
        combos: {
            "combo1": {
                title: "Imported Combo",
                description: "Automatically distilled from replay file.",
                cards: cards,
                steps: steps
            }
        }
    };

    return output;
}

// Wrapper for standalone execution
async function distillCombo(inputFile: string, outputFile: string) {
    console.log(`Reading ${inputFile}...`);
    const replayJson: ReplayData = await fs.readJson(inputFile);
    const output = await distillReplayData(replayJson);
    await fs.writeJson(outputFile, output, { spaces: 4 });
    console.log(`Distilled combo saved to ${outputFile}`);
}

// Run if executed directly
if (require.main === module) {
    const inputFile = "replays/parsed/ABC XYZ combo X - with TTG.yrpX.json";
    const outputFile = "output/distilled_combo.json";
    distillCombo(inputFile, outputFile).catch(console.error);
}
