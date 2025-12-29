import fs from "fs-extra";
// @ts-ignore
import * as lzma from "lzma-purejs";

const REPLAY_COMPRESSED = 0x1;
const REPLAY_TAG = 0x2;
const REPLAY_DECODED = 0x4;
const REPLAY_SINGLE_MODE = 0x8;
const REPLAY_LUA64 = 0x10;
const REPLAY_NEWREPLAY = 0x20;
const REPLAY_HAND_TEST = 0x40;
const REPLAY_DIRECT_SEED = 0x80;
const REPLAY_64BIT_DUELFLAG = 0x100;
const REPLAY_EXTENDED_HEADER = 0x200;

const REPLAY_YRP1 = 0x31707279;
const REPLAY_YRPX = 0x58707279;

export interface ReplayHeader {
    id: number;
    version: number;
    flag: number;
    seed: number;
    dataSize: number;
    hash: number;
    props: Buffer;
}

export class ReplayParserTS {
    public header: ReplayHeader;
    public playerNames: string[] = [];
    public scriptName: string = "";
    public params: any = {};
    public decks: any[] = [];
    public replayData: Buffer | null = null;

    private buffer: Buffer;
    private cursor: number = 0;
    private decompressed: Buffer | null = null;
    private decCursor: number = 0;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.header = this.parseHeader();
    }

    public static async fromFile(path: string): Promise<ReplayParserTS> {
        const buffer = await fs.readFile(path);
        const parser = new ReplayParserTS(buffer);
        await parser.parse();
        return parser;
    }

    private parseHeader(): ReplayHeader {
        this.cursor = 0;
        const id = this.buffer.readUInt32LE(0);
        const version = this.buffer.readUInt32LE(4);

        // Heuristic detection of shifted header (Omega/YRPX specific)
        let shift = 0;
        const potentialPropsStandard = this.buffer.readUInt8(24);
        const potentialPropsShifted = this.buffer.readUInt8(28);

        // Only shift if standard props are INVALID (>225) and shifted are VALID (<225)
        // AND checks for flag 0x817 (which led to false positive) are REMOVED.
        if (potentialPropsStandard > 225 && potentialPropsShifted < 225) {
            console.log("Detected shifted replay header structure (offset +4)");
            shift = 4;
        }

        const flag = this.buffer.readUInt32LE(8 + shift);
        const seed = this.buffer.readUInt32LE(12 + shift);
        const dataSize = this.buffer.readUInt32LE(16 + shift);
        const hash = this.buffer.readUInt32LE(20 + shift);
        const props = this.buffer.slice(24 + shift, 32 + shift);
        this.cursor = 32 + shift;

        if (flag & REPLAY_EXTENDED_HEADER) {
            this.cursor += 40;
        }

        return { id, version, flag, seed, dataSize, hash, props };
    }

    public async parse() {
        console.log("Parsing replay...");

        // Auto-detect compression if Props[0] is 0x5d (LZMA standard)
        // even if flag says otherwise.
        const isCompressed = (this.header.flag & REPLAY_COMPRESSED) || (this.header.props[0] === 0x5d);

        if (isCompressed) {
            console.log("Decompressing...");
            this.decompress();
            console.log("Decompression finished.");
        } else {
            this.decompressed = this.buffer.slice(this.cursor);
        }


        if (!this.decompressed) {
            console.log("Decompression failed or empty.");
            return;
        }

        // DEBUG: Dump first 16 bytes
        try {
            const head = this.decompressed.slice(0, 16).toString('hex');
            fs.writeFileSync('debug_parser_dump.txt', `Decompressed Head: ${head}\n`);

            // Heuristic: If starts with 01 00 00 00, it's a 4-byte count prefix. Strip it.
            // If starts with 00 e8 02 00 (or just 00 e8), it's an 8-byte junk header. Strip 8.
            if (this.decompressed[0] === 0x01 && this.decompressed[1] === 0x00 && this.decompressed[2] === 0x00 && this.decompressed[3] === 0x00) {
                fs.appendFileSync('debug_parser_dump.txt', "Leader (01 00 00 00) detected. Stripping 4 bytes.\n");
                console.log("Stripping 4-byte leader...");
                this.decompressed = this.decompressed.slice(4);
            } else if (this.decompressed[0] === 0x00 && this.decompressed[1] === 0xe8) {
                fs.appendFileSync('debug_parser_dump.txt', "Junk header (00 e8 ...) detected. Stripping 8 bytes.\n");
                console.log("Stripping 8-byte junk header...");
                this.decompressed = this.decompressed.slice(8);
            }
        } catch (e) { }

        console.log("Parsing names...");
        this.parseNames();
        console.log("Parsing params...");
        this.parseParams();
        if (this.header.id === REPLAY_YRP1) {
            console.log("Parsing decks...");
            this.parseDecks();
        }

        // Slice replay data
        this.replayData = this.decompressed.slice(this.decCursor);
        this.alignReplayData();
        console.log(`Replay data size: ${this.replayData.length}`);
    }

    private alignReplayData() {
        if (!this.replayData || this.replayData.length < 5) return;

        // Scan for MSG_START (0x04) in first 200 bytes
        // Structure: [04] [Len: 4 bytes] ...
        // Len for MSG_START is typically non-zero (params) or zero.
        for (let i = 0; i < Math.min(200, this.replayData.length - 5); i++) {
            if (this.replayData[i] === 0x04) {
                const len = this.replayData.readUInt32LE(i + 1);
                // Check if len is reasonable (e.g. < 100 for START msg)
                if (len < 100) {
                    if (i > 0) {
                        console.log(`[ReplayParser] Found MSG_START at offset ${i}. Aligning replay data.`);
                        this.replayData = this.replayData.slice(i);
                    }
                    return;
                }
            }
        }
        // Fallback: If starts with 00 00 80 00 (8MB junk), skip 4 (legacy fix attempt)
        // or 00 e8 02 00 (unknown junk), skip 8
        // But scan should catch it if 04 follows.
    }

    private decompress() {
        const compressedData = this.buffer.slice(this.cursor);
        // FORCE Standard Props for YGOPro: 5d 00 00 80 00 (LC=3, LP=0, PB=2, Dict=8MB)
        // Ignoring file props because they seem to produce empty output (104 bytes)
        const props = Buffer.from([0x5d, 0x00, 0x00, 0x80, 0x00]);

        const header = Buffer.alloc(13);
        props.copy(header as any, 0);

        let size = BigInt(this.header.dataSize);
        // If size is 0 OR very small (likely wrong for a compressed file), use Unknown
        if (size < BigInt(200)) {
            console.log("DataSize is suspect (<200), forcing Unknown Size (-1) & Standard Props");
            size = BigInt("0xFFFFFFFFFFFFFFFF");
        }
        header.writeBigUInt64LE(size, 5);

        const stream = Buffer.concat([header, compressedData] as any);

        console.log(`Compressed stream size: ${stream.length}`);
        // lzma-purejs decompressFile returns Buffer synchronously
        try {
            this.decompressed = lzma.decompressFile(stream as any);
            console.log(`Decompressed size: ${this.decompressed?.length}`);
        } catch (e) {
            console.error("LZMA Decompression error:", e);
            fs.writeFileSync("lzma_error.txt", String(e));
            throw e;
        }
    }

    private parseNames() {
        if (!this.decompressed) return;

        let homeCount = 1;
        let awayCount = 1;

        if (this.header.flag & REPLAY_SINGLE_MODE) {
            homeCount = 1;
            awayCount = 1;
        } else if (this.header.flag & REPLAY_TAG) {
            homeCount = 2;
            awayCount = 2;
        }

        const readName = () => {
            let buf = this.decompressed!.slice(this.decCursor, this.decCursor + 40);
            fs.appendFileSync('debug_parser_dump.txt', `Name @ ${this.decCursor}: ${buf.toString('hex')}\n`);
            this.decCursor += 40;

            // Check for and strip 4-byte leader (01 00 00 00) within the name buffer
            if (buf[0] === 0x01 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x00) {
                buf = buf.slice(4);
            }

            let str = buf.toString('utf16le');
            const nullIdx = str.indexOf('\0');
            if (nullIdx >= 0) str = str.substring(0, nullIdx);
            return str;
        };

        for (let i = 0; i < homeCount; i++) this.playerNames.push(readName());
        for (let i = 0; i < awayCount; i++) this.playerNames.push(readName());
    }

    private parseParams() {
        if (!this.decompressed) return;

        if (this.header.id === REPLAY_YRP1) {
            this.params.startLP = this.decompressed.readUInt32LE(this.decCursor); this.decCursor += 4;
            this.params.startHand = this.decompressed.readUInt32LE(this.decCursor); this.decCursor += 4;
            this.params.drawCount = this.decompressed.readUInt32LE(this.decCursor); this.decCursor += 4;
        }

        if (this.header.flag & REPLAY_64BIT_DUELFLAG) {
            this.params.duelFlags = this.decompressed.readBigUInt64LE(this.decCursor); this.decCursor += 8;
        } else {
            this.params.duelFlags = this.decompressed.readUInt32LE(this.decCursor); this.decCursor += 4;
        }

        if (this.header.flag & REPLAY_SINGLE_MODE && this.header.id === REPLAY_YRP1) {
            const len = this.decompressed.readUInt16LE(this.decCursor); this.decCursor += 2;
            this.scriptName = this.decompressed.slice(this.decCursor, this.decCursor + len).toString('utf8');
            this.decCursor += len;
        }
    }

    private parseDecks() {
        if (!this.decompressed) return;

        const bufferLen = this.decompressed.length;

        const readDeck = (): { main: number[], extra: number[] } | null => {
            // Check if we have at least 4 bytes for mainCount
            if (this.decCursor + 4 > bufferLen) {
                console.log(`[parseDecks] Not enough bytes for mainCount at offset ${this.decCursor}`);
                return null;
            }

            const mainCount = this.decompressed!.readUInt32LE(this.decCursor); this.decCursor += 4;

            // Sanity check: mainCount should be reasonable (0-60 for deck)
            if (mainCount > 100) {
                console.log(`[parseDecks] Unreasonable mainCount: ${mainCount}, likely corrupt data`);
                this.decCursor -= 4; // Revert cursor
                return null;
            }

            // Check if we have enough bytes for all main deck cards + extraCount
            if (this.decCursor + (mainCount * 4) + 4 > bufferLen) {
                console.log(`[parseDecks] Not enough bytes for main deck (${mainCount} cards)`);
                this.decCursor -= 4; // Revert cursor
                return null;
            }

            const main = [];
            for (let k = 0; k < mainCount; k++) {
                main.push(this.decompressed!.readUInt32LE(this.decCursor)); this.decCursor += 4;
            }

            const extraCount = this.decompressed!.readUInt32LE(this.decCursor); this.decCursor += 4;

            // Sanity check: extraCount should be reasonable (0-15 for extra deck)
            if (extraCount > 30) {
                console.log(`[parseDecks] Unreasonable extraCount: ${extraCount}, likely corrupt data`);
                return { main, extra: [] }; // Return partial result
            }

            // Check if we have enough bytes for all extra deck cards
            if (this.decCursor + (extraCount * 4) > bufferLen) {
                console.log(`[parseDecks] Not enough bytes for extra deck (${extraCount} cards)`);
                return { main, extra: [] }; // Return partial result
            }

            const extra = [];
            for (let k = 0; k < extraCount; k++) {
                extra.push(this.decompressed!.readUInt32LE(this.decCursor)); this.decCursor += 4;
            }
            return { main, extra };
        };

        let count = 2;
        if (this.header.flag & REPLAY_TAG) count = 4;

        try {
            for (let i = 0; i < count; i++) {
                const deck = readDeck();
                if (deck) {
                    this.decks.push(deck);
                } else {
                    console.log(`[parseDecks] Failed to read deck ${i + 1}, stopping deck parsing`);
                    break;
                }
            }

            if (this.header.flag & REPLAY_NEWREPLAY && !(this.header.flag & REPLAY_HAND_TEST)) {
                if (this.decCursor + 4 <= bufferLen) {
                    const rules = this.decompressed.readUInt32LE(this.decCursor);
                    this.decCursor += 4;
                    if (this.decCursor + (rules * 4) <= bufferLen) {
                        this.decCursor += rules * 4;
                    }
                }
            }
        } catch (e) {
            console.log(`[parseDecks] Error parsing decks: ${e}. Decks parsed so far: ${this.decks.length}`);
        }
    }

    // NativeReplay interface implementation
    getHeaderInformation() { return this.header; }
    getPlayerNames() { return this.playerNames; }
    getParameters() { return this.params; }
    getScriptName() { return this.scriptName; }
    getDecks() { return this.decks; }
    getReplayData() { return this.replayData; }
}
