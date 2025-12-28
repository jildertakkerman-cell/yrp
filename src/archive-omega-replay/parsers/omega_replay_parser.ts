import * as fs from "fs";
import * as zlib from "zlib";
import { RawReplayDecoder } from "./raw_replay_decoder";

/**
 * YGO Omega Replay Parser
 * 
 * Omega replays are stored as raw deflate-compressed data containing
 * a BSON-like structure with field names and values.
 */

export interface OmegaGameSettings {
    region: number;
    masterRule: number;
    mode: number;
    startHand: number;
    drawCount: number;
    timer: number;
    startLP: number;
    duelRule: number;
    isPublic: boolean;
    releasedFrom?: number;
    releasedUntil?: number;
    extraRule?: number;
    budget?: number;
}

export interface OmegaDeck {
    main: number[];
    extra: number[];
    side: number[];
}

export interface OmegaReplay {
    gameSettings: OmegaGameSettings;
    player0Id: string;
    player1Id: string;
    deck0: OmegaDeck;
    deck1: OmegaDeck;
    gameMessagesRaw?: Buffer;  // Raw game message data for future parsing
    rawDecompressed?: Buffer;  // Store raw data for debugging
}

export class OmegaReplayParser {
    private buffer: Buffer;
    private cursor: number = 0;
    private decompressed: Buffer | null = null;

    constructor(buffer: Buffer | string) {
        this.buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as string);
    }

    /**
     * Load from a .bytes file
     */
    public static async fromFile(path: string): Promise<OmegaReplayParser> {
        const buffer = await fs.promises.readFile(path);
        return new OmegaReplayParser(buffer);
    }

    /**
     * Load from a Base64 encoded string (as shared in YGO Omega)
     */
    public static fromBase64(base64String: string): OmegaReplayParser {
        const buffer = Buffer.from(base64String, 'base64');
        return new OmegaReplayParser(buffer);
    }

    /**
     * Decompress the replay data using raw deflate
     */
    private decompress(): Buffer {
        if (this.decompressed) {
            return this.decompressed;
        }

        try {
            this.decompressed = zlib.inflateRawSync(this.buffer as any) as Buffer;
            return this.decompressed;
        } catch (e) {
            throw new Error(`Failed to decompress Omega replay: ${e}`);
        }
    }

    /**
     * Read a null-terminated string from the buffer
     */
    private readNullTerminatedString(): string {
        const data = this.decompressed!;
        let end = this.cursor;
        while (end < data.length && data[end] !== 0) {
            end++;
        }
        const str = data.slice(this.cursor, end).toString('utf8');
        this.cursor = end + 1; // Skip the null terminator
        return str;
    }

    /**
     * Read an int32 LE from the buffer
     */
    private readInt32LE(): number {
        const val = this.decompressed!.readInt32LE(this.cursor);
        this.cursor += 4;
        return val;
    }

    /**
     * Read a byte from the buffer
     */
    private readByte(): number {
        return this.decompressed![this.cursor++];
    }

    /**
     * Read bytes
     */
    private readBytes(count: number): Buffer {
        const data = this.decompressed!.slice(this.cursor, this.cursor + count);
        this.cursor += count;
        return data;
    }

    /**
     * Find the offset of a field name in the decompressed data
     */
    private findField(fieldName: string, startOffset: number = 0): number {
        const data = this.decompressed!;
        const target = Buffer.from(fieldName + '\0');

        for (let i = startOffset; i < data.length - target.length; i++) {
            if (Buffer.compare(data.subarray(i, i + target.length) as any, target) === 0) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Read a field value (int32) by name
     */
    private readFieldInt32(fieldName: string, startOffset: number = 0): number | null {
        const offset = this.findField(fieldName, startOffset);
        if (offset === -1) return null;

        // Field value follows the null-terminated field name
        const valueOffset = offset + fieldName.length + 1;
        return this.decompressed!.readInt32LE(valueOffset);
    }

    /**
     * Read a field value (byte/bool) by name
     */
    private readFieldByte(fieldName: string, startOffset: number = 0): number | null {
        const offset = this.findField(fieldName, startOffset);
        if (offset === -1) return null;

        const valueOffset = offset + fieldName.length + 1;
        return this.decompressed![valueOffset];
    }

    /**
     * Parse game settings from the decompressed data
     */
    private parseGameSettings(): OmegaGameSettings {
        return {
            region: this.readFieldInt32('Region') ?? 0,
            masterRule: this.readFieldInt32('MasterRule') ?? 5,
            mode: this.readFieldInt32('Mode') ?? 1,
            startHand: this.readFieldInt32('StartHand') ?? 5,
            drawCount: this.readFieldInt32('DrawCount') ?? 1,
            timer: this.readFieldInt32('Timer') ?? 180,
            startLP: this.readFieldInt32('StartLP') ?? 8000,
            duelRule: this.readFieldInt32('DuelRule') ?? 0,
            isPublic: (this.readFieldByte('IsPublic') ?? 0) !== 0,
            extraRule: this.readFieldInt32('ExtraRule') ?? undefined,
            budget: this.readFieldInt32('Budget') ?? undefined,
        };
    }

    /**
     * Find and extract a Base64-encoded deck string
     * Format: fieldName\0 + uint32_le length + base64 data
     */
    private extractDeckBase64(deckFieldName: string): string | null {
        const data = this.decompressed!;
        const offset = this.findField(deckFieldName);
        if (offset === -1) return null;

        // After the null-terminated field name comes a 4-byte length prefix
        const lengthOffset = offset + deckFieldName.length + 1;
        if (lengthOffset + 4 > data.length) return null;

        const base64Length = data.readUInt32LE(lengthOffset);
        if (base64Length <= 0 || base64Length > 10000) return null;  // Sanity check

        const base64Start = lengthOffset + 4;
        if (base64Start + base64Length > data.length) return null;

        return data.slice(base64Start, base64Start + base64Length).toString('utf8');
    }

    /**
     * Read a varint from the buffer at the given offset
     * Returns the value and the new offset after reading
     */
    private readVarint(buffer: Buffer, offset: number): { value: number; newOffset: number } {
        let result = 0;
        let shift = 0;
        let newOffset = offset;

        while (newOffset < buffer.length) {
            const byte = buffer[newOffset++];
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }

        return { value: result, newOffset };
    }

    /**
     * Decode a Base64-encoded deck string
     * The deck format uses raw deflate compression followed by varint-encoded card IDs
     */
    private decodeDeck(base64String: string): OmegaDeck {
        const deck: OmegaDeck = { main: [], extra: [], side: [] };

        try {
            const deckData = Buffer.from(base64String, 'base64');

            // Decompress using raw deflate
            let uncompressed: Buffer;
            try {
                uncompressed = zlib.inflateRawSync(deckData as any) as Buffer;
            } catch {
                try {
                    uncompressed = zlib.inflateSync(deckData as any) as Buffer;
                } catch {
                    uncompressed = deckData;
                }
            }

            // Parse varint-encoded values
            // The format appears to have some header values followed by card IDs
            let offset = 0;
            const allValues: number[] = [];

            while (offset < uncompressed.length) {
                const { value, newOffset } = this.readVarint(uncompressed, offset);
                if (newOffset === offset) break; // No progress, stop
                allValues.push(value);
                offset = newOffset;
            }

            // Filter for valid card IDs (typically 6-8 digit numbers)
            // Card IDs like 10945789, 9718890, 6721433 are valid
            // Start Debug
            console.log(`[DECK DEBUG] Raw decoded values: ${allValues.join(', ')}`);
            // End Debug

            // Heuristic Parsing based on Observed Data
            // Format appears to be: [TotalCount] [ExtraCount] [ ... Card Entries ... ]
            // where Card Entry seems to be [ID] [Metadata...] or similar.
            // We need to extract `mainCount` and `extraCount` IDs.

            if (allValues.length >= 2) {
                const totalCount = allValues[0];
                const extraCount = allValues[1];
                const mainCount = totalCount - extraCount;

                let current = 2;

                // Fill Main Deck
                // We assume IDs are values > 10 (skipping small metadata like 0, 4, 5)
                // EXCEPT if the ID itself is small (like 52). 
                // But 4 and 5 appeared in sequences `52, 119, 120, 4`.
                // So 4 is likely metadata. 52 is likely ID.
                // Threshold of 10 seems safe for now given 52 is the smallest suspect ID.

                while (deck.main.length < mainCount && current < allValues.length) {
                    const val = allValues[current++];
                    if (val > 10) {
                        deck.main.push(val);
                    }
                }

                // Fill Extra Deck
                while (deck.extra.length < extraCount && current < allValues.length) {
                    const val = allValues[current++];
                    if (val > 10) {
                        deck.extra.push(val);
                    }
                }
            } else {
                // Fallback for empty or malformed
                console.warn("Deck data too short to parse fields");
            }

        } catch (e) {
            console.warn(`Failed to decode deck: ${e}`);
        }

        return deck;
    }

    /**
     * Parse the replay and extract all data
     */
    public parse(): OmegaReplay {
        const data = this.decompress();

        const gameSettings = this.parseGameSettings();

        // Extract player IDs (stored as hex after Player0/Player1 fields)
        const player0Offset = this.findField('Player0');
        const player1Offset = this.findField('Player1');

        let player0Id = '';
        let player1Id = '';

        if (player0Offset !== -1) {
            const idOffset = player0Offset + 'Player0'.length + 1;
            player0Id = data.slice(idOffset, idOffset + 8).toString('hex');
        }

        if (player1Offset !== -1) {
            const idOffset = player1Offset + 'Player1'.length + 1;
            player1Id = data.slice(idOffset, idOffset + 8).toString('hex');
        }

        // Extract and decode decks
        const deck0Base64 = this.extractDeckBase64('Deck0');
        const deck1Base64 = this.extractDeckBase64('Deck1');

        const deck0 = deck0Base64 ? this.decodeDeck(deck0Base64) : { main: [], extra: [], side: [] };
        const deck1 = deck1Base64 ? this.decodeDeck(deck1Base64) : { main: [], extra: [], side: [] };

        // Extract game messages for future parsing
        const gameMessagesOffset = this.findField('GameMessages');
        let gameMessagesRaw: Buffer | undefined;

        if (gameMessagesOffset !== -1) {
            // GameMessages is followed by a length field
            const lengthOffset = gameMessagesOffset + 'GameMessages'.length + 1;
            const messagesLength = data.readUInt32LE(lengthOffset);
            if (messagesLength > 0 && messagesLength < data.length) {
                gameMessagesRaw = data.slice(lengthOffset + 4, lengthOffset + 4 + messagesLength);
            }
        }

        return {
            gameSettings,
            player0Id,
            player1Id,
            deck0,
            deck1,
            gameMessagesRaw,
            rawDecompressed: data,
        };
    }

    /**
     * Get header information compatible with existing YRP interface
     */
    public getHeaderInformation(): any {
        const replay = this.parse();
        return {
            id: 0, // Omega doesn't use YRP magic
            version: 0,
            flag: 0,
            seed: 0,
            dataSize: this.decompressed?.length ?? 0,
            hash: 0,
            props: Buffer.alloc(8),
            // Omega-specific
            isOmegaReplay: true,
            gameSettings: replay.gameSettings,
        };
    }

    /**
     * Get player names (IDs in Omega case)
     */
    public getPlayerNames(): string[] {
        const replay = this.parse();
        return [replay.player0Id, replay.player1Id];
    }

    /**
     * Get duel parameters compatible with existing YRP interface
     */
    public getParameters(): any {
        const replay = this.parse();
        return {
            startLP: replay.gameSettings.startLP,
            startHand: replay.gameSettings.startHand,
            drawCount: replay.gameSettings.drawCount,
            duelFlags: 0,
            // Omega-specific
            masterRule: replay.gameSettings.masterRule,
            timer: replay.gameSettings.timer,
            mode: replay.gameSettings.mode,
            region: replay.gameSettings.region,
        };
    }

    /**
     * Get decks compatible with existing YRP interface
     */
    public getDecks(): any[] {
        const replay = this.parse();
        return [
            { main: replay.deck0.main, extra: replay.deck0.extra },
            { main: replay.deck1.main, extra: replay.deck1.extra },
        ];
    }

    /**
     * Get raw game messages buffer
     */
    public getReplayData(): Buffer | null {
        const replay = this.parse();
        return replay.gameMessagesRaw ?? null;
    }

    /**
     * Get parsed replay steps
     */
    public getParsedReplayData(): any[] {
        const raw = this.getReplayData();
        return raw ? RawReplayDecoder.decode(raw) : [];
    }
}

// Export a simple function for parsing Omega replays
export async function parseOmegaReplay(pathOrBase64: string): Promise<OmegaReplay> {
    let parser: OmegaReplayParser;

    // Check if it's a file path or Base64 string
    if (pathOrBase64.includes('/') || pathOrBase64.includes('\\') || pathOrBase64.endsWith('.bytes')) {
        parser = await OmegaReplayParser.fromFile(pathOrBase64);
    } else {
        parser = OmegaReplayParser.fromBase64(pathOrBase64);
    }

    return parser.parse();
}
