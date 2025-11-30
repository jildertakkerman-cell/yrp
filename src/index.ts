import * as fs from "fs-extra";
import cloneDeep from "lodash.clonedeep";
import { ReplayParserTS } from "./replay_parser_ts";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require("bindings")("yrp.node");
const NativeReplay: { new(buffer: Buffer): NativeReplay } = addon.Replay;

interface NativeReplay {
    getHeaderInformation(): ReplayHeader;
    getPlayerNames(): string[];
    getParameters(): ReplayParameter;
    getScriptName(): string;
    getDecks(): Deck[];
}

export interface ReplayHeader {
    id: number;
    version: number;
    flag: number;
    seed: number;
    dataSize: number;
    hash: number;
    props: Buffer;
}

export interface ReplayParameter {
    startLP: number;
    startHand: number;
    drawCount: number;
    duelFlags: number;
}

export interface Deck {
    main: number[];
    extra: number[];
}

export class Replay {
    public static async fromFile(path: string) {
        const buffer = await fs.readFile(path);
        return Replay.fromBuffer(buffer);
    }
    public static async fromBuffer(buffer: Buffer) {
        if (buffer.length >= 4) {
            const id = buffer.readUInt32LE(0);
            if (id === 0x58707279) { // YRPX
                const parser = new ReplayParserTS(buffer);
                await parser.parse();
                return new Replay(parser as unknown as NativeReplay);
            }
        }
        return new Replay(new NativeReplay(buffer));
    }

    private readonly native: NativeReplay;
    private readonly header: ReplayHeader;
    private readonly parameter: ReplayParameter;
    private readonly decks: Deck[];
    private readonly scriptName: string;
    private readonly playerNames: string[];

    private constructor(nativeReplay: NativeReplay) {
        this.native = nativeReplay;
        this.header = this.native.getHeaderInformation();
        this.parameter = this.native.getParameters();
        this.playerNames = this.native.getPlayerNames();
        this.scriptName = this.native.getScriptName();
        this.decks = this.native.getDecks();
    }

    public getHeader() {
        return { ...this.header };
    }
    public getPlayerNames() {
        return [...this.playerNames];
    }
    public getParameter() {
        return { ...this.parameter };
    }
    public getScriptName() {
        return this.scriptName;
    }
    public getDecks() {
        return cloneDeep(this.decks);
    }
    public getReplayData(): Buffer | null {
        if ('getReplayData' in this.native) {
            return (this.native as any).getReplayData();
        }
        return null;
    }
}
