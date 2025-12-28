/**
 * Test script for YGO Omega Replay Parser
 */

import { OmegaReplayParser } from './omega_replay_parser';
import * as fs from 'fs-extra';

async function main() {
    console.log('=== Testing YGO Omega Replay Parser ===\n');

    // Test with the .bytes file
    const bytesFile = './replays/25_12_27-20_36_35.bytes';

    if (await fs.pathExists(bytesFile)) {
        console.log(`Loading: ${bytesFile}`);

        const parser = await OmegaReplayParser.fromFile(bytesFile);
        const replay = parser.parse();

        console.log('\n=== Game Settings ===');
        console.log(JSON.stringify(replay.gameSettings, null, 2));

        console.log('\n=== Player IDs ===');
        console.log('Player 0:', replay.player0Id);
        console.log('Player 1:', replay.player1Id);

        console.log('\n=== Deck 0 ===');
        console.log('Main deck cards:', replay.deck0.main.length);
        if (replay.deck0.main.length > 0) {
            console.log('First 10 card IDs:', replay.deck0.main.slice(0, 10));
        }

        console.log('\n=== Deck 1 ===');
        console.log('Main deck cards:', replay.deck1.main.length);
        if (replay.deck1.main.length > 0) {
            console.log('First 10 card IDs:', replay.deck1.main.slice(0, 10));
        }

        console.log('\n=== YRP-Compatible Interface ===');
        console.log('Header:', JSON.stringify(parser.getHeaderInformation(), (k, v) => {
            if (v instanceof Buffer) return `<Buffer ${v.length} bytes>`;
            return v;
        }, 2));
        console.log('Players:', parser.getPlayerNames());
        console.log('Params:', parser.getParameters());
        console.log('Decks count:', parser.getDecks().length);

        const replayData = parser.getReplayData();
        console.log('Replay data size:', replayData ? replayData.length + ' bytes' : 'null');

    } else {
        console.log('Test file not found:', bytesFile);
    }

    // Test with Base64 string if available
    const base64File = './replays/YGO OMEGA REPLAY1.txt';
    if (await fs.pathExists(base64File)) {
        console.log('\n\n=== Testing Base64 Input ===');
        console.log(`Loading: ${base64File}`);

        const base64String = (await fs.readFile(base64File, 'utf-8')).trim();
        const parser = OmegaReplayParser.fromBase64(base64String);

        try {
            const replay = parser.parse();
            console.log('Successfully parsed Base64 replay!');
            console.log('Game Settings:', JSON.stringify(replay.gameSettings, null, 2));
        } catch (e) {
            console.error('Failed to parse Base64 replay:', e);
        }
    }
}

main().catch(console.error);
