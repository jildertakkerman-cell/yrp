"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayParserTS = void 0;
var tslib_1 = require("tslib");
var fs = tslib_1.__importStar(require("fs-extra"));
// @ts-ignore
var lzma = tslib_1.__importStar(require("lzma-purejs"));
var REPLAY_COMPRESSED = 0x1;
var REPLAY_TAG = 0x2;
var REPLAY_DECODED = 0x4;
var REPLAY_SINGLE_MODE = 0x8;
var REPLAY_LUA64 = 0x10;
var REPLAY_NEWREPLAY = 0x20;
var REPLAY_HAND_TEST = 0x40;
var REPLAY_DIRECT_SEED = 0x80;
var REPLAY_64BIT_DUELFLAG = 0x100;
var REPLAY_EXTENDED_HEADER = 0x200;
var REPLAY_YRP1 = 0x31707279;
var REPLAY_YRPX = 0x58707279;
var ReplayParserTS = /** @class */ (function () {
    function ReplayParserTS(buffer) {
        this.playerNames = [];
        this.scriptName = "";
        this.params = {};
        this.decks = [];
        this.replayData = null;
        this.cursor = 0;
        this.decompressed = null;
        this.decCursor = 0;
        this.buffer = buffer;
        this.header = this.parseHeader();
    }
    ReplayParserTS.fromFile = function (path) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var buffer, parser;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs.readFile(path)];
                    case 1:
                        buffer = _a.sent();
                        parser = new ReplayParserTS(buffer);
                        return [4 /*yield*/, parser.parse()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, parser];
                }
            });
        });
    };
    ReplayParserTS.prototype.parseHeader = function () {
        this.cursor = 0;
        var id = this.buffer.readUInt32LE(0);
        var version = this.buffer.readUInt32LE(4);
        var flag = this.buffer.readUInt32LE(8);
        var seed = this.buffer.readUInt32LE(12);
        var dataSize = this.buffer.readUInt32LE(16);
        var hash = this.buffer.readUInt32LE(20);
        var props = this.buffer.slice(24, 32);
        this.cursor = 32;
        if (flag & REPLAY_EXTENDED_HEADER) {
            this.cursor += 40;
        }
        return { id: id, version: version, flag: flag, seed: seed, dataSize: dataSize, hash: hash, props: props };
    };
    ReplayParserTS.prototype.parse = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                console.log("Parsing replay...");
                if (this.header.flag & REPLAY_COMPRESSED) {
                    console.log("Decompressing...");
                    this.decompress();
                    console.log("Decompression finished.");
                }
                else {
                    this.decompressed = this.buffer.slice(this.cursor);
                }
                if (!this.decompressed) {
                    console.log("Decompression failed or empty.");
                    return [2 /*return*/];
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
                console.log("Replay data size: ".concat(this.replayData.length));
                return [2 /*return*/];
            });
        });
    };
    ReplayParserTS.prototype.decompress = function () {
        var _a;
        var compressedData = this.buffer.slice(this.cursor);
        var props = this.header.props.slice(0, 5);
        var header = Buffer.alloc(13);
        props.copy(header, 0);
        var size = BigInt(this.header.dataSize);
        header.writeBigUInt64LE(size, 5);
        var stream = Buffer.concat([header, compressedData]);
        console.log("Compressed stream size: ".concat(stream.length));
        // lzma-purejs decompressFile returns Buffer synchronously
        try {
            this.decompressed = lzma.decompressFile(stream);
            console.log("Decompressed size: ".concat((_a = this.decompressed) === null || _a === void 0 ? void 0 : _a.length));
        }
        catch (e) {
            console.error("LZMA Decompression error:", e);
            fs.writeFileSync("lzma_error.txt", String(e));
            throw e;
        }
    };
    ReplayParserTS.prototype.parseNames = function () {
        var _this = this;
        if (!this.decompressed)
            return;
        var homeCount = 1;
        var awayCount = 1;
        if (this.header.flag & REPLAY_SINGLE_MODE) {
            homeCount = 1;
            awayCount = 1;
        }
        else if (this.header.flag & REPLAY_TAG) {
            homeCount = 2;
            awayCount = 2;
        }
        var readName = function () {
            var buf = _this.decompressed.slice(_this.decCursor, _this.decCursor + 40);
            _this.decCursor += 40;
            var str = buf.toString('utf16le');
            var nullIdx = str.indexOf('\0');
            if (nullIdx >= 0)
                str = str.substring(0, nullIdx);
            return str;
        };
        for (var i = 0; i < homeCount; i++)
            this.playerNames.push(readName());
        for (var i = 0; i < awayCount; i++)
            this.playerNames.push(readName());
    };
    ReplayParserTS.prototype.parseParams = function () {
        if (!this.decompressed)
            return;
        if (this.header.id === REPLAY_YRP1) {
            this.params.startLP = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
            this.params.startHand = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
            this.params.drawCount = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
        }
        if (this.header.flag & REPLAY_64BIT_DUELFLAG) {
            this.params.duelFlags = this.decompressed.readBigUInt64LE(this.decCursor);
            this.decCursor += 8;
        }
        else {
            this.params.duelFlags = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
        }
        if (this.header.flag & REPLAY_SINGLE_MODE && this.header.id === REPLAY_YRP1) {
            var len = this.decompressed.readUInt16LE(this.decCursor);
            this.decCursor += 2;
            this.scriptName = this.decompressed.slice(this.decCursor, this.decCursor + len).toString('utf8');
            this.decCursor += len;
        }
    };
    ReplayParserTS.prototype.parseDecks = function () {
        var _this = this;
        if (!this.decompressed)
            return;
        var readDeck = function () {
            var mainCount = _this.decompressed.readUInt32LE(_this.decCursor);
            _this.decCursor += 4;
            var main = [];
            for (var k = 0; k < mainCount; k++) {
                main.push(_this.decompressed.readUInt32LE(_this.decCursor));
                _this.decCursor += 4;
            }
            var extraCount = _this.decompressed.readUInt32LE(_this.decCursor);
            _this.decCursor += 4;
            var extra = [];
            for (var k = 0; k < extraCount; k++) {
                extra.push(_this.decompressed.readUInt32LE(_this.decCursor));
                _this.decCursor += 4;
            }
            return { main: main, extra: extra };
        };
        var count = 2;
        if (this.header.flag & REPLAY_TAG)
            count = 4;
        for (var i = 0; i < count; i++) {
            this.decks.push(readDeck());
        }
        if (this.header.flag & REPLAY_NEWREPLAY && !(this.header.flag & REPLAY_HAND_TEST)) {
            var rules = this.decompressed.readUInt32LE(this.decCursor);
            this.decCursor += 4;
            this.decCursor += rules * 4;
        }
    };
    return ReplayParserTS;
}());
exports.ReplayParserTS = ReplayParserTS;
//# sourceMappingURL=replay_parser_ts.js.map