import { ReplayDecoder } from '../src/replay_decoder';

const MSG_MOVE = 50;
const rawHex = "e66dea05000128000000080000000008030000000500000000000000";
const buffer = Buffer.from(rawHex, 'hex');

// @ts-ignore
const decoder = ReplayDecoder.parsers[MSG_MOVE];

if (decoder) {
    const result = decoder(buffer);
    console.log(JSON.stringify(result, null, 2));
} else {
    console.error("Parser for MSG_MOVE not found");
}
