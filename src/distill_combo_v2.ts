import * as fs from "fs-extra";
import * as path from "path";
import * as https from "https";

// Interfaces for the Input JSON (Replay Parser Output)
interface ReplayData {
    header: any;
    parsedReplayData: ReplayStep[];
    playerNames?: string[];
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
    playerName?: string;
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

// Location Constants (module-level for use across functions)
const LOC_DECK = 0x01;
const LOC_HAND = 0x02;
const LOC_MZONE = 0x04;
const LOC_SZONE = 0x08;
const LOC_GRAVE = 0x10;
const LOC_REMOVED = 0x20;
const LOC_EXTRA = 0x40;
const LOC_OVERLAY = 0x80;

// Main distillation function

const getZoneName = (loc: number, seq: number): string => {
    // Handle Overlay: Map to the base zone (under the Xyz monster)
    if (loc & LOC_OVERLAY) {
        const baseLoc = loc & ~LOC_OVERLAY;
        if (baseLoc & LOC_EXTRA) {
            // Special case: Overlay on Extra Deck monster (or during summon)
            // Map to MZONE based on sequence (usually matches the Xyz monster's zone)
            if (seq < 5) return `zone-m${seq + 1}`;
            if (seq === 5) return "zone-em-left";
            if (seq === 6) return "zone-em-right";
        }
        loc = baseLoc;
    }

    if (loc & LOC_HAND) return "zone-hand";
    if (loc & LOC_DECK) return "zone-deck";
    if (loc & LOC_GRAVE) return "zone-gy";
    if (loc & LOC_REMOVED) return "zone-banish";
    if (loc & LOC_EXTRA) return "zone-extra";

    if (loc & LOC_MZONE) {
        if (seq < 5) return `zone-m${seq + 1}`; // 0->m1, 4->m5
        if (seq === 5) return "zone-em-left";
        if (seq === 6) return "zone-em-right";
    }

    if (loc & LOC_SZONE) {
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
    currentLocation?: { loc: number; seq: number; overlayIndex?: number }; // Track current position
}

class CardInstanceTracker {
    private instances = new Map<string, CardInstance>();
    private grid = new Map<string, string>(); // "loc_seq" -> instanceId (for MZONE, SZONE only)
    private overlayGrid = new Map<string, string>(); // "overlay_baseSeq_overlayIndex" -> instanceId
    private hand: CardInstance[] = []; // Cards in hand (sequence is not reliable)
    private deck = new Map<number, CardInstance[]>(); // code -> instances in deck (FIFO)
    private extra = new Map<number, CardInstance[]>(); // code -> instances in extra deck
    private grave = new Map<number, CardInstance[]>(); // code -> instances in GY (FIFO)
    private banished = new Map<number, CardInstance[]>(); // code -> instances banished (FIFO)
    private nextInstanceId = 1;

    // Create a new instance
    createInstance(code: number): CardInstance {
        const instanceId = `card_${code}_${this.nextInstanceId++}`;
        const instance: CardInstance = { instanceId, code, originalCode: code };
        this.instances.set(instanceId, instance);
        return instance;
    }

    // Get the location key for overlay materials
    private getOverlayKey(baseSeq: number, overlayIndex: number): string {
        return `overlay_${baseSeq}_${overlayIndex}`;
    }

    // Get the location key for regular grid
    private getGridKey(loc: number, seq: number): string {
        // Strip overlay flag for grid key to get base location
        const baseLoc = loc & ~LOC_OVERLAY;
        return `${baseLoc}_${seq}`;
    }

    // Register a card at a specific location
    set(loc: number, seq: number, instance: CardInstance, overlayIndex?: number) {
        // Update instance's current location
        instance.currentLocation = { loc, seq, overlayIndex };

        if (loc & LOC_OVERLAY) {
            // Overlay material - use the sequence (zone of XYZ) and position (overlay index)
            const key = this.getOverlayKey(seq, overlayIndex ?? 0);
            this.overlayGrid.set(key, instance.instanceId);
        } else if (loc & LOC_HAND) {
            this.hand.push(instance);
        } else if (loc & LOC_DECK) {
            // Add to deck by code
            if (!this.deck.has(instance.code)) {
                this.deck.set(instance.code, []);
            }
            this.deck.get(instance.code)!.push(instance);
        } else if (loc & LOC_EXTRA) {
            // Add to extra by code
            if (!this.extra.has(instance.code)) {
                this.extra.set(instance.code, []);
            }
            this.extra.get(instance.code)!.push(instance);
        } else if (loc & LOC_GRAVE) {
            // Add to GY by code (sequence not reliable)
            if (!this.grave.has(instance.code)) {
                this.grave.set(instance.code, []);
            }
            this.grave.get(instance.code)!.push(instance);
        } else if (loc & LOC_REMOVED) {
            // Add to banished by code (sequence not reliable)
            if (!this.banished.has(instance.code)) {
                this.banished.set(instance.code, []);
            }
            this.banished.get(instance.code)!.push(instance);
        } else {
            // MZONE, SZONE - use grid with loc_seq key
            const key = this.getGridKey(loc, seq);
            this.grid.set(key, instance.instanceId);
        }
    }

    // Add to floating hand (unknown sequence)
    addToHand(instance: CardInstance) {
        instance.currentLocation = { loc: LOC_HAND, seq: 0 };
        this.hand.push(instance);
    }

    // Get instance at location
    get(loc: number, seq: number, code?: number, overlayIndex?: number): CardInstance | undefined {
        if (loc & LOC_OVERLAY) {
            // For overlay materials, we need to find by code since the exact index may not match
            // First try exact match
            const key = this.getOverlayKey(seq, overlayIndex ?? 0);
            const instanceId = this.overlayGrid.get(key);
            if (instanceId) {
                const instance = this.instances.get(instanceId);
                if (instance && (!code || instance.code === code)) {
                    return instance;
                }
            }
            // If not found by exact key, search all overlays on this zone by code
            if (code) {
                const entries = Array.from(this.overlayGrid.entries());
                for (let i = 0; i < entries.length; i++) {
                    const [oKey, id] = entries[i];
                    if (oKey.startsWith(`overlay_${seq}_`)) {
                        const instance = this.instances.get(id);
                        if (instance && instance.code === code) {
                            return instance;
                        }
                    }
                }
            }
            return undefined;
        }

        if (loc & LOC_HAND) {
            if (code) {
                return this.hand.find(c => c.code === code);
            }
            return undefined;
        }

        if (loc & LOC_DECK) {
            if (code && this.deck.has(code)) {
                const instances = this.deck.get(code)!;
                return instances.length > 0 ? instances[0] : undefined;
            }
            return undefined;
        }

        if (loc & LOC_EXTRA) {
            if (code && this.extra.has(code)) {
                const instances = this.extra.get(code)!;
                return instances.length > 0 ? instances[0] : undefined;
            }
            return undefined;
        }

        if (loc & LOC_GRAVE) {
            if (code && this.grave.has(code)) {
                const instances = this.grave.get(code)!;
                return instances.length > 0 ? instances[0] : undefined;
            }
            return undefined;
        }

        if (loc & LOC_REMOVED) {
            if (code && this.banished.has(code)) {
                const instances = this.banished.get(code)!;
                return instances.length > 0 ? instances[0] : undefined;
            }
            return undefined;
        }

        // MZONE, SZONE - use grid
        const key = this.getGridKey(loc, seq);
        const instanceId = this.grid.get(key);

        if (instanceId) {
            return this.instances.get(instanceId);
        }

        return undefined;
    }

    // Find any overlay material by card code (regardless of which zone it's stored under)
    // This handles cases where XYZ monsters move zones but overlays aren't updated
    findOverlayByCode(code: number): CardInstance | undefined {
        const entries = Array.from(this.overlayGrid.entries());
        for (let i = 0; i < entries.length; i++) {
            const [, id] = entries[i];
            const instance = this.instances.get(id);
            if (instance && instance.code === code) {
                return instance;
            }
        }
        return undefined;
    }

    // Remove instance from its current location
    private removeFromCurrentLocation(instance: CardInstance) {
        const loc = instance.currentLocation;
        if (!loc) return;

        if (loc.loc & LOC_OVERLAY) {
            const key = this.getOverlayKey(loc.seq, loc.overlayIndex ?? 0);
            if (this.overlayGrid.get(key) === instance.instanceId) {
                this.overlayGrid.delete(key);
            }
        } else if (loc.loc & LOC_HAND) {
            const idx = this.hand.findIndex(c => c.instanceId === instance.instanceId);
            if (idx !== -1) {
                this.hand.splice(idx, 1);
            }
        } else if (loc.loc & LOC_DECK) {
            const instances = this.deck.get(instance.code);
            if (instances) {
                const idx = instances.findIndex(c => c.instanceId === instance.instanceId);
                if (idx !== -1) {
                    instances.splice(idx, 1);
                }
            }
        } else if (loc.loc & LOC_EXTRA) {
            const instances = this.extra.get(instance.code);
            if (instances) {
                const idx = instances.findIndex(c => c.instanceId === instance.instanceId);
                if (idx !== -1) {
                    instances.splice(idx, 1);
                }
            }
        } else if (loc.loc & LOC_GRAVE) {
            const instances = this.grave.get(instance.code);
            if (instances) {
                const idx = instances.findIndex(c => c.instanceId === instance.instanceId);
                if (idx !== -1) {
                    instances.splice(idx, 1);
                }
            }
        } else if (loc.loc & LOC_REMOVED) {
            const instances = this.banished.get(instance.code);
            if (instances) {
                const idx = instances.findIndex(c => c.instanceId === instance.instanceId);
                if (idx !== -1) {
                    instances.splice(idx, 1);
                }
            }
        } else {
            // MZONE, SZONE
            const key = this.getGridKey(loc.loc, loc.seq);
            if (this.grid.get(key) === instance.instanceId) {
                this.grid.delete(key);
            }
        }
    }

    // Move a card - now includes oldPosition for overlay index when detaching
    move(oldLoc: number, oldSeq: number, newLoc: number, newSeq: number, code: number, oldPosition?: number, newPosition?: number): CardInstance {
        let instance: CardInstance | undefined;

        // Try to find existing instance based on old location
        if (oldLoc & LOC_OVERLAY) {
            // Coming from overlay - the XYZ monster may have moved, so the overlay might be stored under a different zone
            // First try exact match, then search ALL overlays by code
            instance = this.get(oldLoc, oldSeq, code, oldPosition);
            if (!instance) {
                // Search all overlay materials by code (handles XYZ monster zone changes)
                instance = this.findOverlayByCode(code);
            }
        } else if (oldLoc & LOC_HAND) {
            const idx = this.hand.findIndex(c => c.code === code);
            if (idx !== -1) {
                instance = this.hand[idx];
            }
        } else if (oldLoc & LOC_DECK) {
            const instances = this.deck.get(code);
            if (instances && instances.length > 0) {
                instance = instances[0];
            }
        } else if (oldLoc & LOC_EXTRA) {
            const instances = this.extra.get(code);
            if (instances && instances.length > 0) {
                instance = instances[0];
            }
        } else if (oldLoc & LOC_GRAVE) {
            const instances = this.grave.get(code);
            if (instances && instances.length > 0) {
                instance = instances[0];
            }
        } else if (oldLoc & LOC_REMOVED) {
            const instances = this.banished.get(code);
            if (instances && instances.length > 0) {
                instance = instances[0];
            }
        } else {
            // MZONE, SZONE
            instance = this.get(oldLoc, oldSeq, code);
        }

        if (!instance) {
            // Create new if not found (e.g., first time seeing this card)
            instance = this.createInstance(code);
        } else {
            // Remove from old location
            this.removeFromCurrentLocation(instance);
        }

        // Determine overlay index for new location
        let overlayIndex: number | undefined;
        if (newLoc & LOC_OVERLAY) {
            // When attaching as material, newPosition is the overlay index
            overlayIndex = newPosition ?? 0;
        }

        // Place in new spot
        this.set(newLoc, newSeq, instance, overlayIndex);

        return instance;
    }

    // Update overlay positions when XYZ monster moves (e.g., Extra -> MZONE)
    updateOverlayZone(oldSeq: number, newSeq: number) {
        const toMove: { oldKey: string; newKey: string; instanceId: string }[] = [];

        // Find all overlays attached to the old zone
        const entries = Array.from(this.overlayGrid.entries());
        for (let i = 0; i < entries.length; i++) {
            const [key, instanceId] = entries[i];
            if (key.startsWith(`overlay_${oldSeq}_`)) {
                const overlayIndex = parseInt(key.split('_')[2]);
                const newKey = this.getOverlayKey(newSeq, overlayIndex);
                toMove.push({ oldKey: key, newKey, instanceId });
            }
        }

        // Move them to new zone
        for (const { oldKey, newKey, instanceId } of toMove) {
            this.overlayGrid.delete(oldKey);
            this.overlayGrid.set(newKey, instanceId);
            const instance = this.instances.get(instanceId);
            if (instance && instance.currentLocation) {
                instance.currentLocation.seq = newSeq;
            }
        }
    }

    getAllInstances(): CardInstance[] {
        return Array.from(this.instances.values());
    }

    // Debug helper
    debugPrint() {
        console.log("[DEBUG] CardInstanceTracker state:");
        console.log("  Grid:", Object.fromEntries(this.grid));
        console.log("  Overlay:", Object.fromEntries(this.overlayGrid));
        console.log("  Hand:", this.hand.map(c => `${c.instanceId}(${c.code})`));
    }
}

export async function distillReplayData(replayJson: ReplayData): Promise<ComboOutput> {
    console.log("[DEBUG] distillReplayData called - NEW CODE VERSION");
    const steps: ComboStep[] = [];
    const tracker = new CardInstanceTracker();

    // The player whose combo we're tracking (usually player 0)
    const COMBO_PLAYER = 0;

    // Buffer for pending actions (materials, moves before summons)
    const actionBuffer: Array<{ card: string; to: string; isOverlay?: boolean; fromZone?: string }> = [];

    // Helper to flush buffer as individual steps (only non-overlay items)
    // Overlay materials should only be cleared when consumed by a summon
    const flushBuffer = (includeOverlays: boolean = false) => {
        const toFlush = includeOverlays 
            ? actionBuffer.splice(0, actionBuffer.length)
            : actionBuffer.filter(a => !a.isOverlay);
        
        // Remove flushed items from buffer (if not including overlays)
        if (!includeOverlays) {
            for (let i = actionBuffer.length - 1; i >= 0; i--) {
                if (!actionBuffer[i].isOverlay) {
                    actionBuffer.splice(i, 1);
                }
            }
        }

        for (const action of toFlush) {
            steps.push({
                text: `Move`,
                card: action.card,
                to: action.to
            });
        }
    };

    for (const step of replayJson.parsedReplayData) {
        if (!step.details) continue;

        if (step.type === "MSG_SUMMONING" || step.type === "MSG_SPSUMMONING") {
            // Filter: only track combo player's summons
            if (step.details.controller !== undefined && step.details.controller !== COMBO_PLAYER) continue;
            
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
                    const summonZone = getZoneName(step.details.location, step.details.sequence);

                    // Fixup overlay materials to match the summon zone
                    for (const action of actionBuffer) {
                        if (action.isOverlay) {
                            action.to = summonZone;

                            // Retroactive fix for materials coming from MZONE
                            // Only look back at recent moves, not past previous summons
                            if (action.fromZone && action.fromZone !== summonZone) {
                                // Find the step that placed this card in fromZone
                                for (let i = steps.length - 1; i >= 0; i--) {
                                    const s = steps[i];

                                    // Stop if we hit a summon step (even for a different card)
                                    // This prevents modifying zones from previous summon sequences
                                    if (s.text && (s.text.includes("Summon") || s.text.includes("Fusion"))) {
                                        break;
                                    }

                                    // Check single card step
                                    if (s.card === action.card) {
                                        if (s.to === action.fromZone) {
                                            s.to = summonZone;
                                        } else {
                                            break; // Card found in different zone, stop
                                        }
                                    }

                                    // Check multi-action step (e.g. Xyz Summon)
                                    if (s.actions) {
                                        const lastAction = s.actions[s.actions.length - 1];
                                        if (lastAction && lastAction.card === action.card) {
                                            if (lastAction.to === action.fromZone) {
                                                // Update all actions in this step to the new zone
                                                for (const a of s.actions) {
                                                    a.to = summonZone;
                                                }
                                            } else {
                                                break; // Card found in different zone, stop
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Add the summon itself to the actions
                    actionBuffer.push({
                        card: instance.instanceId,
                        to: summonZone
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

            // Filter: only track combo player's effect activations
            if (step.details.controller !== undefined && step.details.controller !== COMBO_PLAYER) continue;

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

            // Filter: only track combo player's equips (check controller of the equip card location)
            if (step.details.controller !== undefined && step.details.controller !== COMBO_PLAYER) continue;

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

            // Filter: only track combo player's draws
            if (step.details.player !== COMBO_PLAYER) continue;

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
            // Filter: only track combo player's card movements
            // A card belongs to a player if oldController matches (for existing cards)
            // or newController matches (for cards entering play)
            const oldController = step.details.oldController;
            const newController = step.details.newController;
            if (oldController !== COMBO_PLAYER && newController !== COMBO_PLAYER) continue;

            if (step.details.code) {
                // Pass oldPosition and newPosition for overlay index tracking
                const instance = tracker.move(
                    step.details.oldLocation, step.details.oldSequence,
                    step.details.newLocation, step.details.newSequence,
                    step.details.code,
                    step.details.oldPosition, // overlay index when detaching
                    step.details.newPosition  // overlay index when attaching
                );

                const oldLoc = step.details.oldLocation;
                const newLoc = step.details.newLocation;
                let locName = "Unknown Location";
                let text = "Move to";
                let shouldBuffer = false;
                let isOverlay = false;
                let isDetach = false;

                // Location Constants (using module-level constants)
                // LOC_DECK, LOC_HAND, LOC_MZONE, LOC_SZONE, LOC_GRAVE, LOC_REMOVED, LOC_EXTRA, LOC_OVERLAY

                // Check if this is a detachment from overlay
                if (oldLoc & LOC_OVERLAY) {
                    isDetach = true;
                    // Detaching XYZ material
                    if (newLoc & LOC_OVERLAY) {
                        // Overlay-to-overlay transfer (XYZ upgrade: material transferred to new XYZ monster)
                        // This should be buffered as an overlay material for the next summon
                        locName = "Overlay Material";
                        text = "Transfer Material";
                        shouldBuffer = true;
                        isOverlay = true;
                        isDetach = false; // Not a detachment, but a transfer
                    } else if (newLoc & LOC_GRAVE) {
                        locName = "Graveyard";
                        // Check if it's a cost (effect activation) vs destruction
                        if (step.details.reasonName?.includes("COST")) {
                            text = "Detach Material to";
                        } else {
                            text = "Send to";
                        }
                    } else if (newLoc & LOC_REMOVED) {
                        locName = "Banished";
                        text = "Detach Material to";
                    } else if (newLoc & LOC_HAND) {
                        locName = "Hand";
                        text = "Detach Material to";
                    }
                } else if (newLoc & LOC_OVERLAY) {
                    locName = "Overlay Material";
                    text = "Attach as Material";
                    shouldBuffer = true;
                    isOverlay = true;
                } else if (newLoc & LOC_DECK) locName = "Deck";
                else if (newLoc & LOC_HAND) locName = "Hand";
                else if (newLoc & LOC_MZONE) locName = "Main Monster Zone";
                else if (newLoc & LOC_SZONE) locName = "Spell/Trap Zone";
                else if (newLoc & LOC_GRAVE) locName = "Graveyard";
                else if (newLoc & LOC_REMOVED) locName = "Banished";
                else if (newLoc & LOC_EXTRA) locName = "Extra Deck";

                const isMaterialOrSummon = step.details.reasonName && (step.details.reasonName.includes("MATERIAL") || step.details.reasonName.includes("SUMMON"));
                const isSummonMove = (newLoc & LOC_MZONE) && (oldLoc & (LOC_HAND | LOC_EXTRA));

                if ((isMaterialOrSummon || isSummonMove) && !isDetach) {
                    shouldBuffer = true;
                    if (newLoc & LOC_OVERLAY) {
                        text = "Attach as Material";
                    } else if (step.details.reasonName && step.details.reasonName.includes("MATERIAL")) {
                        text = "Send to";
                        locName += " as Material";
                    }
                }

                if (shouldBuffer) {
                    actionBuffer.push({
                        card: instance.instanceId,
                        to: getZoneName(step.details.newLocation, step.details.newSequence),
                        isOverlay: isOverlay,
                        fromZone: (oldLoc & LOC_MZONE) ? getZoneName(oldLoc, step.details.oldSequence) : undefined
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

    // Flush any remaining buffer at the end (including overlays that were never consumed)
    flushBuffer(true);

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

    // Get the player name from the replay (first player is typically the combo performer)
    const playerName = replayJson.playerNames?.[0] || undefined;

    return {
        archetype: "ABC",
        playerName,
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
    const inputFile = "replays/ABC XYZ combo Hangar.yrpX.json";
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
