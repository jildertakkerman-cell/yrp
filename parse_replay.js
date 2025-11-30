const fs = require('fs');
const lzma = require('lzma-purejs');

const FILENAME = 'ABC XYZ combo X.yrpX';

// Constants from ocgapi_constants.h
const MSG_NAMES = {
    1: "MSG_RETRY",
    2: "MSG_HINT",
    3: "MSG_WAITING",
    4: "MSG_START",
    5: "MSG_WIN",
    6: "MSG_UPDATE_DATA",
    7: "MSG_UPDATE_CARD",
    8: "MSG_REQUEST_DECK",
    10: "MSG_SELECT_BATTLECMD",
    11: "MSG_SELECT_IDLECMD",
    12: "MSG_SELECT_EFFECTYN",
    13: "MSG_SELECT_YESNO",
    14: "MSG_SELECT_OPTION",
    15: "MSG_SELECT_CARD",
    16: "MSG_SELECT_CHAIN",
    18: "MSG_SELECT_PLACE",
    19: "MSG_SELECT_POSITION",
    20: "MSG_SELECT_TRIBUTE",
    21: "MSG_SORT_CHAIN",
    22: "MSG_SELECT_COUNTER",
    23: "MSG_SELECT_SUM",
    24: "MSG_SELECT_DISFIELD",
    25: "MSG_SORT_CARD",
    26: "MSG_SELECT_UNSELECT_CARD",
    30: "MSG_CONFIRM_DECKTOP",
    31: "MSG_CONFIRM_CARDS",
    32: "MSG_SHUFFLE_DECK",
    33: "MSG_SHUFFLE_HAND",
    34: "MSG_REFRESH_DECK",
    35: "MSG_SWAP_GRAVE_DECK",
    36: "MSG_SHUFFLE_SET_CARD",
    37: "MSG_REVERSE_DECK",
    38: "MSG_DECK_TOP",
    39: "MSG_SHUFFLE_EXTRA",
    40: "MSG_NEW_TURN",
    41: "MSG_NEW_PHASE",
    42: "MSG_CONFIRM_EXTRATOP",
    50: "MSG_MOVE",
    53: "MSG_POS_CHANGE",
    54: "MSG_SET",
    55: "MSG_SWAP",
    56: "MSG_FIELD_DISABLED",
    60: "MSG_SUMMONING",
    61: "MSG_SUMMONED",
    62: "MSG_SPSUMMONING",
    63: "MSG_SPSUMMONED",
    64: "MSG_FLIPSUMMONING",
    65: "MSG_FLIPSUMMONED",
    70: "MSG_CHAINING",
    71: "MSG_CHAINED",
    72: "MSG_CHAIN_SOLVING",
    73: "MSG_CHAIN_SOLVED",
    74: "MSG_CHAIN_END",
    75: "MSG_CHAIN_NEGATED",
    76: "MSG_CHAIN_DISABLED",
    80: "MSG_CARD_SELECTED",
    81: "MSG_RANDOM_SELECTED",
    83: "MSG_BECOME_TARGET",
    90: "MSG_DRAW",
    91: "MSG_DAMAGE",
    92: "MSG_RECOVER",
    93: "MSG_EQUIP",
    94: "MSG_LPUPDATE",
    95: "MSG_UNEQUIP",
    96: "MSG_CARD_TARGET",
    97: "MSG_CANCEL_TARGET",
    100: "MSG_PAY_LPCOST",
    101: "MSG_ADD_COUNTER",
    102: "MSG_REMOVE_COUNTER",
    110: "MSG_ATTACK",
    111: "MSG_BATTLE",
    112: "MSG_ATTACK_DISABLED",
    113: "MSG_DAMAGE_STEP_START",
    114: "MSG_DAMAGE_STEP_END",
    120: "MSG_MISSED_EFFECT",
    121: "MSG_BE_CHAIN_TARGET",
    122: "MSG_CREATE_RELATION",
    123: "MSG_RELEASE_RELATION",
    130: "MSG_TOSS_COIN",
    131: "MSG_TOSS_DICE",
    132: "MSG_ROCK_PAPER_SCISSORS",
    133: "MSG_HAND_RES",
    140: "MSG_ANNOUNCE_RACE",
    141: "MSG_ANNOUNCE_ATTRIB",
    142: "MSG_ANNOUNCE_CARD",
    143: "MSG_ANNOUNCE_NUMBER",
    160: "MSG_CARD_HINT",
    161: "MSG_TAG_SWAP",
    162: "MSG_RELOAD_FIELD",
    163: "MSG_AI_NAME",
    164: "MSG_SHOW_HINT",
    165: "MSG_PLAYER_HINT",
    170: "MSG_MATCH_KILL",
    180: "MSG_CUSTOM_MSG",
    190: "MSG_REMOVE_CARDS"
};

function parseReplay(filePath) {
    const buffer = fs.readFileSync(filePath);

    const id = buffer.readUInt32LE(0);
    const version = buffer.readUInt32LE(4);
    const flag = buffer.readUInt32LE(8);
    const timestamp = buffer.readUInt32LE(12);
    const datasize = buffer.readUInt32LE(16);
    const hash = buffer.readUInt32LE(20);
    const props = buffer.slice(24, 32);

    console.log("Replay ID:", id.toString(16));
    console.log("Version:", version);
    console.log("Flag:", flag.toString(16));
    console.log("Data Size:", datasize);

    const REPLAY_YRPX = 0x58707279;
    const REPLAY_EXTENDED_HEADER = 0x200;

    if (id !== REPLAY_YRPX) {
        console.error("Not a valid YRPX file.");
        return;
    }

    let headerSize = 32;
    if (flag & REPLAY_EXTENDED_HEADER) {
        headerSize = 72;
    }

    // Try offset 72
    const compressedData = buffer.slice(72);

    const lzmaHeader = Buffer.alloc(13);
    props.copy(lzmaHeader, 0, 0, 5);
    lzmaHeader.writeUInt32LE(datasize, 5);
    lzmaHeader.writeUInt32LE(0, 9);

    const fullLzmaStream = Buffer.concat([lzmaHeader, compressedData]);

    try {
        const decompressed = lzma.decompressFile(fullLzmaStream);
        console.log("Decompression successful! Size:", decompressed.length);
        const replayData = {
            header: {
                id: id.toString(16),
                version: version,
                flag: flag,
                timestamp: timestamp,
                datasize: datasize,
                hash: hash
            },
            packets: parseStream(decompressed)
        };

        fs.writeFileSync('replay_dump.json', JSON.stringify(replayData, null, 2));
        console.log("Wrote parsed data to replay_dump.json");

    } catch (e) {
        console.error("Decompression failed:", e);
        // Retry with offset 80
        try {
            console.log("Retrying with offset 80...");
            const compressedData80 = buffer.slice(80);
            const fullLzmaStream80 = Buffer.concat([lzmaHeader, compressedData80]);
            const decompressed80 = lzma.decompressFile(fullLzmaStream80);
            console.log("Decompression successful with offset 80! Size:", decompressed80.length);

            const replayData = {
                header: {
                    id: id.toString(16),
                    version: version,
                    flag: flag,
                    timestamp: timestamp,
                    datasize: datasize,
                    hash: hash,
                    offsetUsed: 80
                },
                packets: parseStream(decompressed80)
            };

            fs.writeFileSync('replay_dump.json', JSON.stringify(replayData, null, 2));
            console.log("Wrote parsed data to replay_dump.json");

        } catch (e2) {
            console.error("Retry failed:", e2);
        }
    }
}

function parseStream(buffer) {
    let offset = 0;
    const packets = [];

    function read(bytes) {
        if (offset + bytes > buffer.length) return null;
        const res = buffer.slice(offset, offset + bytes);
        offset += bytes;
        return res;
    }

    function readUInt32() {
        const b = read(4);
        if (!b) return null;
        return b.readUInt32LE(0);
    }

    function readUInt8() {
        const b = read(1);
        if (!b) return null;
        return b.readUInt8(0);
    }

    function readUInt16() {
        const b = read(2);
        if (!b) return null;
        return b.readUInt16LE(0);
    }

    // Based on Flag 0x17B (379):
    // REPLAY_SINGLE_MODE (0x8) is SET -> 2 players (Home: 1, Opposing: 1).
    // Names: 2 * 40 bytes = 80 bytes.
    // REPLAY_64BIT_DUELFLAG (0x100) is SET -> duel_flags is 8 bytes.
    // Total Skip: 80 + 8 = 88 bytes.

    offset = 88;

    // Payload Parsers
    const parsers = {
        40: (d) => ({ // MSG_NEW_TURN
            player: d.readUInt8(0)
        }),
        41: (d) => ({ // MSG_NEW_PHASE
            phase: d.readUInt16LE(0)
        }),
        5: (d) => ({ // MSG_WIN
            player: d.readUInt8(0),
            type: d.readUInt8(1)
        }),
        90: (d) => { // MSG_DRAW
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                if (2 + i * 4 + 4 <= d.length) {
                    cards.push(d.readUInt32LE(2 + i * 4));
                }
            }
            return { player, count, cards };
        },
        32: (d) => ({ // MSG_SHUFFLE_DECK
            player: d.readUInt8(0)
        }),
        33: (d) => { // MSG_SHUFFLE_HAND
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                if (2 + i * 4 + 4 <= d.length) {
                    cards.push(d.readUInt32LE(2 + i * 4));
                }
            }
            return { player, count, cards };
        },
        161: (d) => { // MSG_TAG_SWAP
            const player = d.readUInt8(0);
            const mcount = d.readUInt8(1);
            const ecount = d.readUInt8(2);
            const pcount = d.readUInt8(3);
            const hcount = d.readUInt8(4);
            const top = d.readUInt32LE(5);
            return { player, mcount, ecount, pcount, hcount, top };
        },
        6: (d) => { // MSG_UPDATE_DATA
            const player = d.readUInt8(0);
            const location = d.readUInt8(1);
            const dataLen = d.readUInt32LE(2);
            const data = d.slice(6);

            const result = { player, location, dataLen, data: data.toString('hex') };

            if ((location === 0x01 || location === 0x02) && dataLen % 4 === 0) {
                const cards = [];
                for (let i = 0; i < dataLen; i += 4) {
                    if (i + 4 <= data.length) {
                        cards.push(data.readUInt32LE(i));
                    }
                }
                result.cards = cards;
            }
            return result;
        },
        50: (d) => ({ // MSG_MOVE
            code: d.readUInt32LE(0),
            oldController: d.readUInt8(4),
            oldLocation: d.readUInt8(5),
            oldSequence: d.readUInt8(6),
            oldPosition: d.readUInt8(7),
            newController: d.readUInt8(8),
            newLocation: d.readUInt8(9),
            newSequence: d.readUInt8(10),
            newPosition: d.readUInt8(11),
            reason: d.readUInt32LE(12)
        }),
        60: (d) => { // MSG_SUMMONING
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt8(6);
            const position = d.readUInt8(7);
            return { code, controller, location, sequence, position };
        },
        61: (d) => ({}), // MSG_SUMMONED
        62: (d) => { // MSG_SPSUMMONING
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt8(6);
            const position = d.readUInt8(7);
            return { code, controller, location, sequence, position };
        },
        63: (d) => ({}), // MSG_SPSUMMONED
        64: (d) => { // MSG_FLIPSUMMONING
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt8(6);
            const position = d.readUInt8(7);
            return { code, controller, location, sequence, position };
        },
        65: (d) => ({}), // MSG_FLIPSUMMONED
        52: (d) => { // MSG_SET
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt8(6);
            const position = d.readUInt8(7);
            return { code, controller, location, sequence, position };
        },
        70: (d) => { // MSG_CHAINING
            const code = d.readUInt32LE(0);
            const pcode = d.readUInt32LE(4);
            const functionCode = d.readUInt32LE(8);
            const triggerController = d.readUInt8(12);
            const triggerLocation = d.readUInt8(13);
            const triggerSequence = d.readUInt8(14);
            const controller = d.readUInt8(15);
            const location = d.readUInt8(16);
            const sequence = d.readUInt8(17);
            const desc = d.readUInt32LE(18);
            return {
                code, pcode, function: functionCode,
                triggerController, triggerLocation, triggerSequence,
                controller, location, sequence, desc
            };
        },
        110: (d) => { // MSG_ATTACK
            const attackerController = d.readUInt8(0);
            const attackerLocation = d.readUInt8(1);
            const attackerSequence = d.readUInt8(2);
            const attackerPosition = d.readUInt8(3);
            const defenderController = d.readUInt8(4);
            const defenderLocation = d.readUInt8(5);
            const defenderSequence = d.readUInt8(6);
            const defenderPosition = d.readUInt8(7);
            return {
                attacker: { controller: attackerController, location: attackerLocation, sequence: attackerSequence, position: attackerPosition },
                defender: { controller: defenderController, location: defenderLocation, sequence: defenderSequence, position: defenderPosition }
            };
        },
        91: (d) => ({ // MSG_DAMAGE
            player: d.readUInt8(0),
            amount: d.readUInt32LE(1)
        }),
        100: (d) => ({ // MSG_PAY_LPCOST
            player: d.readUInt8(0),
            amount: d.readUInt32LE(1)
        }),
        94: (d) => ({ // MSG_LPUPDATE
            player: d.readUInt8(0),
            lp: d.readUInt32LE(1)
        }),
        162: (d) => { // MSG_RELOAD_FIELD
            const player = d.readUInt8(0);
            const val = d.slice(1);
            return { player, val: val.toString('hex') };
        }
    };

    while (offset < buffer.length) {
        const msg = readUInt8();
        if (msg === null) break;

        const len = readUInt32();
        if (len === null) break;

        if (len > 100000) {
            console.error(`[ERROR] Packet length ${len} seems invalid at offset ${offset - 5}. Aborting.`);
            break;
        }

        const data = read(len);

        const msgName = MSG_NAMES[msg] || `UNKNOWN_MSG_${msg}`;

        const packet = {
            id: msg,
            name: msgName,
            length: len,
            data: data ? data.toString('hex') : null
        };

        if (data && parsers[msg]) {
            try {
                packet.decoded = parsers[msg](data);
            } catch (e) {
                packet.decodeError = e.message;
            }
        } else if (msgName === "MSG_AI_NAME") {
            if (data && data.length >= 2) {
                const nameLen = data.readUInt16LE(0);
                const nameBuf = data.slice(2, 2 + nameLen);
                packet.decoded = { name: nameBuf.toString('utf8') };
            }
        }

        packets.push(packet);
    }
    return packets;
}

parseReplay(FILENAME);
