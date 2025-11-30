import * as fs from "fs-extra";
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
        const flag = this.buffer.readUInt32LE(8);
        const seed = this.buffer.readUInt32LE(12);
        const dataSize = this.buffer.readUInt32LE(16);
        const hash = this.buffer.readUInt32LE(20);
        const props = this.buffer.slice(24, 32);
        this.cursor = 32;

        if (flag & REPLAY_EXTENDED_HEADER) {
            this.cursor += 40;
        }

        return { id, version, flag, seed, dataSize, hash, props };
    }

    public async parse() {
        console.log("Parsing replay...");
        if (this.header.flag & REPLAY_COMPRESSED) {
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

        console.log("Parsing names...");
        this.parseNames();
        console.log("Parsing params...");
        this.parseParams();
        if (this.header.id === REPLAY_YRP1) {
            console.log("Parsing decks...");
            this.parseDecks();
        }

        // The rest is replay data
        this.replayData = this.decompressed.slice(this.decCursor);
        console.log(`Replay data size: ${this.replayData.length}`);
    }

    private decompress() {
        const compressedData = this.buffer.slice(this.cursor);
        const props = this.header.props.slice(0, 5);

        const header = Buffer.alloc(13);
        props.copy(header as any, 0);
        const size = BigInt(this.header.dataSize);
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
            const buf = this.decompressed!.slice(this.decCursor, this.decCursor + 40);
            this.decCursor += 40;
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

        const readDeck = () => {
            const mainCount = this.decompressed!.readUInt32LE(this.decCursor); this.decCursor += 4;
            const main = [];
            for (let k = 0; k < mainCount; k++) {
                main.push(this.decompressed!.readUInt32LE(this.decCursor)); this.decCursor += 4;
            }

            const extraCount = this.decompressed!.readUInt32LE(this.decCursor); this.decCursor += 4;
            const extra = [];
            for (let k = 0; k < extraCount; k++) {
                extra.push(this.decompressed!.readUInt32LE(this.decCursor)); this.decCursor += 4;
            }
            return { main, extra };
        };

        let count = 2;
        if (this.header.flag & REPLAY_TAG) count = 4;

        for (let i = 0; i < count; i++) {
            this.decks.push(readDeck());
        }

        if (this.header.flag & REPLAY_NEWREPLAY && !(this.header.flag & REPLAY_HAND_TEST)) {
            const rules = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
            this.decCursor += rules * 4;
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
