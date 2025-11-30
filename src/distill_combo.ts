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

// Main distillation function

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
            if (seq < 5) return `zone-m${seq + 1}`;
            if (seq === 5) return "zone-em-left";
            if (seq === 6) return "zone-em-right";
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

// Card Instance Tracking
interface CardInstance {
    instanceId: string;
    code: number;
    originalCode: number; // For alias handling if needed
}

class CardInstanceTracker {
    private instances = new Map<string, CardInstance>();
    private grid = new Map<string, string>(); // "loc_seq" -> instanceId
    private hand: CardInstance[] = []; // Cards in hand (sequence is not reliable for unique ID)
    private nextInstanceId = 1;

    // Create a new instance
    createInstance(code: number): CardInstance {
        const instanceId = `card_${code}_${this.nextInstanceId++}`;
        const instance: CardInstance = { instanceId, code, originalCode: code };
        this.instances.set(instanceId, instance);
        return instance;
    }

    // Register a card at a specific location
    set(loc: number, seq: number, instance: CardInstance) {
        // Location Constants
        const LOCATION_HAND = 0x02;

        if (loc & LOCATION_HAND) {
            this.hand.push(instance);
        } else {
            const key = `${loc}_${seq}`;
            this.grid.set(key, instance.instanceId);
        }
    }

    // Add to floating hand (unknown sequence) - effectively same as set for Hand now
    addToHand(instance: CardInstance) {
        this.hand.push(instance);
    }

    // Get instance at location
    get(loc: number, seq: number, code?: number): CardInstance | undefined {
        const LOCATION_HAND = 0x02;

        if (loc & LOCATION_HAND) {
            // Find a card in hand with matching code
            // We prefer one that hasn't been "used" if we were tracking usage,
            // but for now just finding one is better than nothing.
            // Ideally we find one that matches the code.
            if (code) {
                return this.hand.find(c => c.code === code);
            }
            // If no code provided, we can't really guess which one in hand it is without more info
            return undefined;
        }

        const key = `${loc}_${seq}`;
        const instanceId = this.grid.get(key);

        if (instanceId) {
            return this.instances.get(instanceId);
        }

        return undefined;
    }

    // Move a card
    move(oldLoc: number, oldSeq: number, newLoc: number, newSeq: number, code: number): CardInstance {
        const LOCATION_HAND = 0x02;
        let instance: CardInstance | undefined;

        // Try to find existing instance
        if (oldLoc & LOCATION_HAND) {
            // Find and remove from hand
            const idx = this.hand.findIndex(c => c.code === code);
            if (idx !== -1) {
                instance = this.hand[idx];
                this.hand.splice(idx, 1);
            }
        } else {
            instance = this.get(oldLoc, oldSeq, code);
        }

        if (!instance) {
            // If coming from Deck (0x01) or Extra (0x40) or Unknown, create new
            // Also if we just can't find it, we have to create it to proceed
            instance = this.createInstance(code);
        }

        // Remove from old spot (if grid)
        if (!(oldLoc & LOCATION_HAND)) {
            const oldKey = `${oldLoc}_${oldSeq}`;
            if (this.grid.get(oldKey) === instance.instanceId) {
                this.grid.delete(oldKey);
            }
        }

        // Place in new spot
        this.set(newLoc, newSeq, instance);

        return instance;
    }

    getAllInstances(): CardInstance[] {
        return Array.from(this.instances.values());
    }
}

export async function distillReplayData(replayJson: ReplayData): Promise<ComboOutput> {
    console.log("[DEBUG] distillReplayData called - NEW CODE VERSION");
    const steps: ComboStep[] = [];
    const tracker = new CardInstanceTracker();

    // Buffer for pending actions (materials, moves before summons)
    const actionBuffer: Array<{ card: string; to: string }> = [];

    // Helper to flush buffer as individual steps
    const flushBuffer = () => {
        for (const action of actionBuffer) {
            steps.push({
                text: `Move`,
                card: action.card,
                to: action.to
            });
        }
        actionBuffer.length = 0;
    };

    for (const step of replayJson.parsedReplayData) {
        if (!step.details) continue;

        if (step.type === "MSG_SUMMONING" || step.type === "MSG_SPSUMMONING") {
            if (step.details.code) {
                // Resolve instance
                const instance = tracker.get(step.details.location, step.details.sequence, step.details.code)
                    || tracker.createInstance(step.details.code); // Fallback if not found

                let summonType = step.type === "MSG_SUMMONING" ? "Normal Summon" : "Special Summon";
                let isExtraDeckSummon = false;
                let summonReason = 0;

                // Infer specific Special Summon type
                if (step.type === "MSG_SPSUMMONING") {
                    // Look backwards for the corresponding MSG_MOVE to get reason and previous location
                    for (let i = replayJson.parsedReplayData.indexOf(step) - 1; i >= Math.max(0, replayJson.parsedReplayData.indexOf(step) - 10); i--) {
                        const prevStep = replayJson.parsedReplayData[i];
                        if (prevStep.type === "MSG_MOVE" && prevStep.details.code === step.details.code) {
                            summonReason = prevStep.details.reason || 0;
                            const oldLoc = prevStep.details.oldLocation || 0;

                            // Reason Constants (matching replay_decoder.ts)
                            const REASON_FUSION = 0x40000;
                            const REASON_SYNCHRO = 0x80000;
                            const REASON_XYZ = 0x200000;
                            const REASON_LINK = 0x10000000;
                            const LOCATION_EXTRA = 0x40;

                            if (summonReason & REASON_LINK) summonType = "Link Summon";
                            else if (summonReason & REASON_XYZ) summonType = "Xyz Summon";
                            else if (summonReason & REASON_SYNCHRO) summonType = "Synchro Summon";
                            else if (summonReason & REASON_FUSION) summonType = "Fusion Summon";
                            else if (oldLoc & LOCATION_EXTRA) {
                                isExtraDeckSummon = true;
                                summonType = "Special Summon (Extra)"; // Placeholder
                            }
                            break;
                        }
                    }
                }

                // If we have buffered actions, combine them with the summon
                if (actionBuffer.length > 0) {
                    // Add the summon itself to the actions
                    actionBuffer.push({
                        card: instance.instanceId,
                        to: getZoneName(step.details.location, step.details.sequence)
                    });

                    // Create a multi-action step
                    steps.push({
                        text: summonType,
                        actions: [...actionBuffer]
                    });

                    actionBuffer.length = 0;
                } else {
                    // No buffered actions, create a normal summon step
                    steps.push({
                        text: summonType,
                        card: instance.instanceId,
                        to: getZoneName(step.details.location, step.details.sequence)
                    });
                }
            }
        } else if (step.type === "MSG_CHAINING") {
            // Flush buffer on barrier events
            flushBuffer();

            if (step.details.code) {
                const instance = tracker.get(step.details.location, step.details.sequence, step.details.code)
                    || tracker.createInstance(step.details.code);

                let targetZone = getZoneName(step.details.location, step.details.sequence);

                steps.push({
                    text: `Activate Effect`,
                    card: instance.instanceId,
                    to: targetZone
                });
            }
        } else if (step.type === "MSG_EQUIP") {
            // Flush buffer on barrier events
            flushBuffer();

            if (step.details.location !== undefined && step.details.sequence !== undefined) {
                const targetZone = getZoneName(step.details.targetLocation, step.details.targetSequence);

                // Helper to find card code by looking backwards
                const findCardCode = (loc: number, seq: number): number | undefined => {
                    for (let i = replayJson.parsedReplayData.indexOf(step) - 1; i >= 0; i--) {
                        const s = replayJson.parsedReplayData[i];
                        if (!s.details) continue;
                        if (s.type === "MSG_MOVE" && s.details.newLocation === loc && s.details.newSequence === seq) return s.details.code;
                        if ((s.type === "MSG_SUMMONING" || s.type === "MSG_SPSUMMONING" || s.type === "MSG_FLIPSUMMONING") &&
                            s.details.location === loc && s.details.sequence === seq) return s.details.code;
                        if (s.type === "MSG_DRAW" && s.details.cards) {
                            for (const c of s.details.cards) {
                                if (c.location === loc && c.sequence === seq) return c.code;
                            }
                        }
                    }
                    return undefined;
                };

                const equipCode = findCardCode(step.details.location, step.details.sequence);
                const targetCode = findCardCode(step.details.targetLocation, step.details.targetSequence);

                const equipInstance = equipCode ? tracker.get(step.details.location, step.details.sequence, equipCode) : undefined;
                const targetInstance = targetCode ? tracker.get(step.details.targetLocation, step.details.targetSequence, targetCode) : undefined;

                let text = "Equip Card";

                steps.push({
                    text: text,
                    card: equipInstance ? equipInstance.instanceId : undefined,
                    to: getZoneName(step.details.location, step.details.sequence),
                    // @ts-ignore
                    _equipTargetId: targetInstance ? targetInstance.instanceId : undefined
                });
            }
        } else if (step.type === "MSG_DRAW") {
            // Flush buffer on barrier events
            flushBuffer();

            if (step.details.cards && Array.isArray(step.details.cards)) {
                for (const card of step.details.cards) {
                    if (card.code) {
                        const instance = tracker.createInstance(card.code);
                        // If sequence is 0/undefined, treat as floating in hand
                        if (!card.sequence) {
                            tracker.addToHand(instance);
                        } else {
                            tracker.set(card.location, card.sequence, instance);
                        }

                        steps.push({
                            text: `Draw`,
                            card: instance.instanceId,
                            to: getZoneName(card.location, card.sequence || 0)
                        });
                    }
                }
            }
        } else if (step.type === "MSG_MOVE") {
            if (step.details.code) {
                const instance = tracker.move(
                    step.details.oldLocation, step.details.oldSequence,
                    step.details.newLocation, step.details.newSequence,
                    step.details.code
                );

                const newLoc = step.details.newLocation;
                let locName = "Unknown Location";
                let text = "Move to";
                let shouldBuffer = false;

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
                    shouldBuffer = true;
                } else if (newLoc & LOCATION_DECK) locName = "Deck";
                else if (newLoc & LOCATION_HAND) locName = "Hand";
                else if (newLoc & LOCATION_MZONE) locName = "Main Monster Zone";
                else if (newLoc & LOCATION_SZONE) locName = "Spell/Trap Zone";
                else if (newLoc & LOCATION_GRAVE) locName = "Graveyard";
                else if (newLoc & LOCATION_REMOVED) locName = "Banished";
                else if (newLoc & LOCATION_EXTRA) locName = "Extra Deck";

                const isMaterialOrSummon = step.details.reasonName && (step.details.reasonName.includes("MATERIAL") || step.details.reasonName.includes("SUMMON"));
                const isSummonMove = (newLoc & LOCATION_MZONE) && (step.details.oldLocation & (LOCATION_HAND | LOCATION_EXTRA));

                if (isMaterialOrSummon || isSummonMove) {
                    shouldBuffer = true;
                    if (newLoc & LOCATION_OVERLAY) {
                        text = "Attach as Material";
                    } else if (step.details.reasonName && step.details.reasonName.includes("MATERIAL")) {
                        text = "Send to";
                        locName += " as Material";
                    }
                }

                if (shouldBuffer) {
                    actionBuffer.push({
                        card: instance.instanceId,
                        to: getZoneName(step.details.newLocation, step.details.newSequence)
                    });
                } else {
                    flushBuffer();

                    steps.push({
                        text: `${text} ${locName === "Overlay Material" ? "" : locName}`.trim(),
                        card: instance.instanceId,
                        to: getZoneName(step.details.newLocation, step.details.newSequence)
                    });
                }
            }
        }
    }

    // Flush any remaining buffer at the end
    flushBuffer();

    // Fetch Card Data
    const allInstances = tracker.getAllInstances();
    const uniqueCodes = Array.from(new Set(allInstances.map(i => i.code)));
    const cardMap = await fetchCardData(uniqueCodes);

    // Build Cards Array
    const cards: CardDetail[] = [];
    for (const instance of allInstances) {
        const card = cardMap.get(instance.code);
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
            id: instance.instanceId,
            name: card ? card.name : `Unknown Card ${instance.code}`,
            type: simpleType,
            zone: zone
        });
    }

    // Update Step Texts with Card Names and Refine Summon Types
    for (const s of steps) {
        let cardId: string | undefined;
        if (s.actions) {
            const lastAction = s.actions[s.actions.length - 1];
            if (lastAction) cardId = lastAction.card;
        } else {
            cardId = s.card;
        }

        if (cardId) {
            const c = cards.find(x => x.id === cardId);
            if (c) {
                // Refine "Special Summon (Extra)" based on card type
                if (s.text === "Special Summon (Extra)") {
                    const instance = allInstances.find(i => i.instanceId === cardId);
                    const rawCard = instance ? cardMap.get(instance.code) : undefined;

                    if (rawCard) {
                        const typeLower = rawCard.type.toLowerCase();
                        if (typeLower.includes("link")) s.text = "Link Summon";
                        else if (typeLower.includes("xyz")) s.text = "Xyz Summon";
                        else if (typeLower.includes("synchro")) s.text = "Synchro Summon";
                        else if (typeLower.includes("fusion")) s.text = "Contact Fusion";
                        else s.text = "Special Summon";
                    } else {
                        s.text = "Special Summon";
                    }
                }

                if (s.text === "Equip Card") {
                    s.text = `Equip ${c.name}`;
                    // @ts-ignore
                    if (s._equipTargetId) {
                        // @ts-ignore
                        const targetCard = cards.find(x => x.id === s._equipTargetId);
                        if (targetCard) {
                            s.text += ` to ${targetCard.name}`;
                        }
                    }
                    // Clean up temp property
                    // @ts-ignore
                    delete s._equipTargetId;
                } else {
                    s.text += ` ${c.name}`;
                }
            }
        }
    }

    // Debug logging
    const drakes = cards.filter(c => c.name === "B-Buster Drake");
    console.log(`[DEBUG] Distilled ${cards.length} cards. Found ${drakes.length} B-Buster Drake instances.`);
    drakes.forEach(d => console.log(`[DEBUG] - ${d.id} (${d.zone})`));

    return {
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
}

// Standalone execution if run directly
if (require.main === module) {
    const inputFile = "replays/ABC XYZ combo X - with TTG.yrpX.json";
    const outputFile = "distilled_combo.json";

    (async () => {
        try {
            console.log(`Reading ${inputFile}...`);
            const replayJson: ReplayData = await fs.readJson(inputFile);
            const output = await distillReplayData(replayJson);
            await fs.writeJson(outputFile, output, { spaces: 4 });
            console.log(`Distilled combo saved to ${outputFile}`);
        } catch (error) {
            console.error(error);
        }
    })();
}
