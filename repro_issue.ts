
import { distillReplayData } from "./src/distill_combo";

// Mock the ReplayData interface
const mockReplayData = {
    header: {},
    parsedReplayData: [
        // 1. Add Card A (Code 100) to Hand (Seq 0) - e.g. Draw
        {
            type: "MSG_DRAW",
            details: {
                cards: [{ code: 100, location: 0x02, sequence: 0 }]
            }
        },
        // 2. Add Card B (Code 100) to Hand (Seq 0) - e.g. Search
        {
            type: "MSG_MOVE",
            details: {
                code: 100,
                oldLocation: 0x01, oldSequence: 0, // Deck
                newLocation: 0x02, newSequence: 0, // Hand
                reasonName: "EFFECT"
            }
        },
        // 3. Move Card from Hand to MZone (Seq 0)
        {
            type: "MSG_MOVE",
            details: {
                code: 100,
                oldLocation: 0x02, oldSequence: 0,
                newLocation: 0x04, newSequence: 0, // MZone 1
                reasonName: "SUMMON"
            }
        },
        // 4. Move Card from Hand to MZone (Seq 1)
        {
            type: "MSG_MOVE",
            details: {
                code: 100,
                oldLocation: 0x02, oldSequence: 0,
                newLocation: 0x04, newSequence: 1, // MZone 2
                reasonName: "SUMMON"
            }
        }
    ]
};

async function run() {
    console.log("Running reproduction...");
    // @ts-ignore
    const result = await distillReplayData(mockReplayData);

    console.log("Cards created:");
    result.combos.combo1.cards.forEach(c => console.log(`- ${c.id} (${c.name})`));

    console.log("\nSteps:");
    result.combos.combo1.steps.forEach(s => {
        console.log(`- ${s.text} [Card: ${s.card}] -> ${s.to}`);
        if (s.actions) {
            s.actions.forEach(a => console.log(`  Action: ${a.card} -> ${a.to}`));
        }
    });
}

run();
