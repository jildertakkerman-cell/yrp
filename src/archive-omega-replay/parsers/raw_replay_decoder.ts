import { ReplayDecoder, ReplayStep } from "./replay_decoder";

export class RawReplayDecoder {

    /**
     * Decode a stream of packets formatted as:
     * [Length: 1 byte] [MsgID: 1 byte] [Payload: Length bytes]
     * 
     * Length = Size of Payload (excluding MsgID).
     */
    public static decode(buffer: Buffer): ReplayStep[] {
        const steps: ReplayStep[] = [];
        let cursor = 0;

        while (cursor < buffer.length) {
            const startCursor = cursor;
            // Check for end of buffer
            if (cursor + 2 > buffer.length) break;

            const len = buffer.readUInt8(cursor);
            cursor += 1;

            if (len === 0) {
                console.log(`[RAW] ${startCursor}: Len 0. Skipping.`);
                continue;
            }

            if (cursor >= buffer.length) break;
            const msgId = buffer.readUInt8(cursor);
            cursor += 1;

            console.log(`[RAW] ${startCursor}: Len ${len}, ID ${msgId} (0x${msgId.toString(16)}).`);

            if (cursor + len > buffer.length) {
                console.warn(`Incomplete packet for MsgID ${msgId} at ${cursor - 2}. Needed ${len}, has ${buffer.length - cursor}.`);
                break;
            }

            const data = buffer.subarray(cursor, cursor + len);
            cursor += len;

            const msgName = (ReplayDecoder as any).getMsgName ? (ReplayDecoder as any).getMsgName(msgId) : `MSG_${msgId}`;

            const step: ReplayStep = {
                type: msgName,
                msgId: msgId,
                len: len,
                raw: data.toString('hex')
            };

            // Attempt to parse details using standard ReplayDecoder parsers
            if ((ReplayDecoder as any).parsers && (ReplayDecoder as any).parsers[msgId]) {
                try {
                    // Check if data length matches expected minimum for parser
                    // Some parsers might expect more data than provided (e.g. MSG_SHUFFLE_DECK 0 len vs 1 expected)
                    // We wrap in try-catch to be safe.
                    if (data.length > 0 || len === 0) {
                        step.details = (ReplayDecoder as any).parsers[msgId](data);
                    }
                } catch (e) {
                    step.error = String(e);
                }
            }

            steps.push(step);

            // Enforce 4-byte padding alignment of packets
            // Omega replay streams seem to align packets to 4-byte boundaries.
            // Packet size = 1 (Len) + 1 (ID) + Len (Payload) = 2 + Len.
            // If (cursor - startCursor) % 4 != 0, skip padding.
            // But since we just want next packet to start at aligned address relative to 0?
            // Actually, cursor is absolute.
            const remainder = cursor % 4;
            if (remainder !== 0) {
                cursor += (4 - remainder);
            }
        }

        return steps;
    }
}
