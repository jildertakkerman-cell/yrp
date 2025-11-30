import { ReplayHeader, ReplayParameter, Deck } from './index';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lzma = require('lzma-purejs');

const REPLAY_COMPRESSED = 0x1;
const REPLAY_TAG = 0x2;
const REPLAY_DECODED = 0x4;
const REPLAY_SINGLE_MODE = 0x8;
const REPLAY_LUA64 = 0x10;
const REPLAY_NEWREPLAY = 0x20;
const REPLAY_HAND_TEST = 0x40;
const REPLAY_DIRECT_SEED = 0x80;
const REPLAY_64BIT_DUELFLAG = 0x100;

export class YrpxParser {
    private buffer: Buffer;
    private cursor: number = 0;
    private header: ReplayHeader;
    private playerNames: string[] = [];
    private parameters: ReplayParameter = { startLP: 0, startHand: 0, drawCount: 0, duelFlags: 0 };
    private scriptName: string = "";
    private decks: Deck[] = [];
    private homePlayerCount: number = 0;
    private awayPlayerCount: number = 0;

    private constructor(buffer: Buffer, header: ReplayHeader) {
        this.buffer = buffer;
        this.header = header;
        this.cursor = 0;
    }

    public static async create(buffer: Buffer): Promise<YrpxParser> {
        const header = YrpxParser.readHeaderStatic(buffer);

        console.log("Header parsed:", header);
        console.log("Compressed flag:", !!(header.flag & REPLAY_COMPRESSED));

        let dataBuffer: Buffer;

        if (header.flag & REPLAY_COMPRESSED) {
            console.log("Replay is compressed with LZMA.");

            // Extract LZMA properties and size from header
            const props = buffer.slice(24, 29); // 5 bytes: LZMA properties
            const compressedData = buffer.slice(32); // Data after 32-byte header

            // Construct standard .lzma header (13 bytes total)
            // Format: [properties:5][uncompressed_size:8 (little-endian)]
            const lzmaHeader = Buffer.alloc(13);
            props.copy(lzmaHeader, 0);

            // Write uncompressed size as 64-bit little-endian
            lzmaHeader.writeUInt32LE(header.dataSize, 5);
            lzmaHeader.writeUInt32LE(0, 9); // High 32 bits (size is < 4GB)

            // Combine header with compressed data
            const lzmaStream = Buffer.concat([lzmaHeader, compressedData]);

            try {
                // Decompress using lzma-purejs
                const decompressed = lzma.decompressFile(lzmaStream);
                dataBuffer = Buffer.from(decompressed);
                console.log(`Decompressed ${compressedData.length} bytes to ${dataBuffer.length} bytes`);
            } catch (e) {
                console.error("LZMA decompression failed:", e);
                throw new Error("Failed to decompress .yrpX file");
            }
        } else {
            console.log("Replay is not compressed, reading directly");
            dataBuffer = buffer.slice(32);
        }

        const parser = new YrpxParser(dataBuffer, header);
        parser.parsePlayerNames();
        parser.parseParams();
        parser.parseDecks();
        return parser;
    }

    private static readHeaderStatic(buffer: Buffer): ReplayHeader {
        const id = buffer.readUInt32LE(0);
        const version = buffer.readUInt32LE(4);
        const flag = buffer.readUInt32LE(8);
        const seed = buffer.readUInt32LE(12);
        const dataSize = buffer.readUInt32LE(16);
        const hash = buffer.readUInt32LE(20);
        const props = buffer.slice(24, 32);

        return { id, version, flag, seed, dataSize, hash, props };
    }

    public getHeaderInformation(): ReplayHeader {
        return this.header;
    }

    public getPlayerNames(): string[] {
        return this.playerNames;
    }

    public getParameters(): ReplayParameter {
        return this.parameters;
    }

    public getScriptName(): string {
        return this.scriptName;
    }

    public getDecks(): Deck[] {
        return this.decks;
    }

    public getReplayData(): Buffer {
        return this.buffer.slice(this.cursor);
    }

    private checkBounds(bytes: number) {
        if (this.cursor + bytes > this.buffer.length) {
            console.warn(`Out of bounds read attempt. Cursor: ${this.cursor}, Bytes: ${bytes}, Buffer Length: ${this.buffer.length}`);
            return false;
        }
        return true;
    }

    private readUInt32(): number {
        if (!this.checkBounds(4)) return 0;
        const val = this.buffer.readUInt32LE(this.cursor);
        this.cursor += 4;
        return val;
    }

    private readName(): string {
        if (!this.checkBounds(40)) return "";
        const nameBuf = this.buffer.slice(this.cursor, this.cursor + 40);
        this.cursor += 40;
        let name = nameBuf.toString('utf16le');
        const nullIndex = name.indexOf('\0');
        if (nullIndex !== -1) {
            name = name.substring(0, nullIndex);
        }
        return name;
    }

    private parsePlayerNames() {
        if (this.header.flag & REPLAY_SINGLE_MODE) {
            for (let i = 0; i < 2; ++i) {
                this.playerNames.push(this.readName());
            }
            this.homePlayerCount = 1;
            this.awayPlayerCount = 1;
        } else {
            const parseCount = (): number => {
                let count = 1;
                if (this.header.flag & REPLAY_NEWREPLAY) {
                    count = this.readUInt32();
                } else if (this.header.flag & REPLAY_TAG) {
                    count = 2;
                }

                if (count > 20) {
                    console.warn(`Player count ${count} seems excessive, capping at 20`);
                    count = 20;
                }

                for (let i = 0; i < count; i++) {
                    this.playerNames.push(this.readName());
                }
                return count;
            };

            this.homePlayerCount = parseCount();
            this.awayPlayerCount = parseCount();
        }
    }

    private parseParams() {
        this.parameters.startLP = this.readUInt32();
        this.parameters.startHand = this.readUInt32();
        this.parameters.drawCount = this.readUInt32();

        if (this.header.flag & REPLAY_64BIT_DUELFLAG) {
            const low = this.readUInt32();
            const high = this.readUInt32();
            this.parameters.duelFlags = low;
        } else {
            this.parameters.duelFlags = this.readUInt32();
        }
    }

    private parseDecks() {
        const totalPlayers = this.homePlayerCount + this.awayPlayerCount;
        console.log(`Parsing decks for ${totalPlayers} players`);

        if (totalPlayers > 40) {
            console.warn("Total players > 40, aborting deck parse");
            return;
        }

        for (let i = 0; i < totalPlayers; ++i) {
            const main: number[] = [];
            const extra: number[] = [];

            let mainCount = this.readUInt32();
            console.log(`Player ${i} main deck count: ${mainCount}`);

            if (mainCount > 1000) {
                console.warn(`Main deck count ${mainCount} seems excessive, capping at 1000`);
                mainCount = 1000;
            }

            for (let j = 0; j < mainCount; j++) {
                main.push(this.readUInt32());
            }

            let extraCount = this.readUInt32();
            console.log(`Player ${i} extra deck count: ${extraCount}`);

            if (extraCount > 1000) {
                console.warn(`Extra deck count ${extraCount} seems excessive, capping at 1000`);
                extraCount = 1000;
            }

            for (let j = 0; j < extraCount; j++) {
                extra.push(this.readUInt32());
            }

            this.decks.push({ main, extra });
        }
    }
}
