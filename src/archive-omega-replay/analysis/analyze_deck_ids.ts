import * as fs from 'fs';
import * as path from 'path';

const decodedFile = path.join(__dirname, '../replays/YGO OMEGA REPLAY1.decoded.json');
const outFile = 'deck_id_analysis.txt';

try {
    const decoded = JSON.parse(fs.readFileSync(decodedFile, 'utf8'));
    const deck = decoded.decks[1]; // Player 1 deck
    const steps = decoded.steps;

    const out = fs.createWriteStream(outFile);
    const log = (msg: string) => { out.write(msg + '\n'); console.log(msg); };

    log("=== Deck IDs ===");
    log("Main deck IDs: " + JSON.stringify(deck.main));
    log("\nExtra deck IDs: " + JSON.stringify(deck.extra));

    // Look for any messages with "code" field that might be actual card codes
    log("\n=== Searching for Card Codes in Messages ===");
    const cardCodes = new Set<number>();

    for (const step of steps) {
        if (step.details) {
            // Check for code fields
            if (step.details.code !== undefined && step.details.code > 10000) {
                cardCodes.add(step.details.code);
            }

            // Check for cards array
            if (step.details.cards && Array.isArray(step.details.cards)) {
                for (const card of step.details.cards) {
                    if (card.code && card.code > 10000) {
                        cardCodes.add(card.code);
                    }
                }
            }
        }
    }

    log(`\nFound ${cardCodes.size} potential card codes:`);
    const sortedCodes = Array.from(cardCodes).sort((a, b) => a - b);
    sortedCodes.forEach(c => log(`  ${c}`));

    // Hypothesis: Check if deck IDs might be indexes or offsets
    log("\n=== Deck ID Statistics ===");
    const allDeckIds = [...deck.main, ...deck.extra];
    const uniqueDeckIds = new Set(allDeckIds);
    log(`Total cards: ${allDeckIds.length}`);
    log(`Unique IDs: ${uniqueDeckIds.size}`);
    log(`Min ID: ${Math.min(...allDeckIds)}`);
    log(`Max ID: ${Math.max(...allDeckIds)}`);

    // Check for patterns - are they sequential?
    const sortedIds = Array.from(uniqueDeckIds).sort((a, b) => a - b);
    log(`\nSorted unique IDs: ${sortedIds.join(', ')}`);

    // Hypothesis: Omega might use custom card database with sequential IDs
    // The actual mapping might be in a separate file or need to be discovered
    log("\n=== Hypothesis ===");
    log("These appear to be Omega's internal card database IDs.");
    log("They are NOT standard YGO passcodes (which are 8-digit numbers).");
    log("To map them, we would need:");
    log("  1. Omega's card database file (cards.cdb or similar)");
    log("  2. A mapping table from Omega's server");
    log("  3. Analysis of card names in the replay (if present)");

    out.end();

} catch (e: any) {
    console.error("Error:", e.message);
}
