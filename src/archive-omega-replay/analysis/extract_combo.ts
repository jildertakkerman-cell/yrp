import * as fs from 'fs';
import * as path from 'path';

const decodedFile = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.decoded.json');
const outputFile = 'extracted_combo.json';

interface ComboStep {
    text: string;
    card?: string;
    to?: string;
    actions?: { card: string; to: string }[];
}

try {
    const decoded = JSON.parse(fs.readFileSync(decodedFile, 'utf8'));
    const steps = decoded.steps;

    const cards: any[] = [];
    const comboSteps: ComboStep[] = [];
    const cardMap = new Map<number, string>();

    const getZoneName = (loc: number, seq: number): string => {
        const zones: any = {
            1: 'zone-deck',
            2: 'zone-hand',
            4: seq === 0 ? 'zone-m1' : seq === 1 ? 'zone-m2' : seq === 2 ? 'zone-m3' :
                seq === 3 ? 'zone-m4' : seq === 4 ? 'zone-m5' : 'zone-m' + seq,
            8: `zone-s${seq + 1}`,
            16: 'zone-gy',
            32: 'zone-banish',
            64: 'zone-extra'
        };
        return zones[loc] || `zone-${loc}-${seq}`;
    };

    const getCardId = (code: number): string => {
        if (!cardMap.has(code)) {
            const id = `card_${code}`;
            cardMap.set(code, id);
            cards.push({
                id,
                name: `Card ${code}`,
                type: 'unknown',
                zone: 'zone-deck'
            });
        }
        return cardMap.get(code)!;
    };

    // Analyze steps
    for (const step of steps) {
        try {
            const type = step.type;
            const details = step.details || {};

            if (type === 'MSG_DRAW') {
                const count = details.count || 0;
                const cards = details.cards || [];
                for (const card of cards) {
                    if (card.code) {
                        comboSteps.push({
                            text: `Draw ${card.code}`,
                            card: getCardId(card.code),
                            to: 'zone-hand'
                        });
                    }
                }
            }

            else if (type === 'MSG_MOVE') {
                const code = details.code;
                const toLocation = details.toLocation;
                const toSequence = details.toSequence || 0;
                if (code) {
                    const zone = getZoneName(toLocation, toSequence);
                    comboSteps.push({
                        text: `Move ${code} to ${zone}`,
                        card: getCardId(code),
                        to: zone
                    });
                }
            }

            else if (type === 'MSG_SUMMONING' || type === 'MSG_SPSUMMONING') {
                const code = details.code;
                const location = details.location || 4;
                const sequence = details.sequence || 0;
                if (code) {
                    const action = type === 'MSG_SUMMONING' ? 'Normal Summon' : 'Special Summon';
                    const zone = getZoneName(location, sequence);
                    comboSteps.push({
                        text: `${action} ${code}`,
                        actions: [
                            { card: getCardId(code), to: zone },
                            { card: getCardId(code), to: zone }
                        ]
                    });
                }
            }

            else if (type === 'MSG_CHAINING') {
                const code = details.code;
                if (code) {
                    comboSteps.push({
                        text: `Activate Effect ${code}`,
                        card: getCardId(code),
                        to: 'zone-field'
                    });
                }
            }

        } catch (e) {
            // Skip errors
        }
    }

    const combo = {
        archetype: "Unknown",
        combos: {
            combo1: {
                title: "Extracted Replay Combo",
                description: "Automatically extracted from Omega replay file.",
                cards: cards.slice(0, 20), // Limit to first 20 cards
                steps: comboSteps.slice(0, 100) // Limit to first 100 steps
            }
        }
    };

    fs.writeFileSync(outputFile, JSON.stringify(combo, null, 2));
    console.log(`\nExtracted combo with ${cards.length} cards and ${comboSteps.length} steps.`);
    console.log(`Saved to ${outputFile}`);

} catch (e: any) {
    console.error("Error:", e.message);
}
