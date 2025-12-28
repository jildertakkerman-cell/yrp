# Omega Replay Parser (Archived)

This directory contains experimental code for parsing YGO Omega replay files. **This work has been archived** as it was determined that Omega's replay format does not contain sufficient functional data for meaningful combo extraction.

## Directory Structure

### `parsers/`
Core parsing implementations:
- `omega_replay_parser.ts` - Main Omega replay file parser (BSON-like structure)
- `raw_replay_decoder.ts` - Stream decoder for Omega's custom message format
- `decode_omega_replay.ts` - Initial decoder implementation
- `decode_omega_replay_v2.ts` - Enhanced decoder with better error handling
- `test_omega_parser.ts` - Parser test suite

### `analysis/`
Analysis and investigation scripts:
- `analyze_deck_ids.ts` - Deck ID to card code mapping investigation
- `analyze_msg0.ts` - MSG_SERVER_GENERIC (ID 0) analysis
- `analyze_msg49.ts` - MSG_SERVER_49 sequence ID analysis
- `analyze_msg108.ts` - MSG_SERVER_108 packet analysis
- `analyze_msg235.ts` - MSG_SERVER_235 packet analysis
- `analyze_packet_format.ts` - Packet format verification
- `analyze_payloads.ts` - General payload analysis
- `analyze_replay_stream.ts` - Stream structure analysis
- `verify_format.ts` - Format verification (vs standard YRPX)
- `extract_combo.ts` - Attempted combo extraction (incomplete)

## Key Findings

### Format
- **Encoding**: Base64 text file
- **Compression**: Raw deflate (no zlib wrapper)
- **Structure**: BSON-like with custom varint encoding
- **Packet Format**: `[Length: 1b] [MsgID: 1b] [Payload]` + 4-byte alignment (NOT standard YRPX)

### Omega-Specific Messages
Custom server message IDs identified:
- `0` - MSG_SERVER_GENERIC (multiple variants)
- `9` - MSG_SERVER_DEBUG_9
- `48` - MSG_SERVER_48
- `49` - MSG_SERVER_49 (sequence/frame counter)
- `52` - MSG_SERVER_52
- `57` - MSG_SERVER_57
- `108` - MSG_SERVER_108 (2-byte flag or 64-byte data)
- `159` - MSG_SERVER_PACKET_159 (255-byte sync packet)
- `235` - MSG_SERVER_235 (255-byte server data)
- `255` - MSG_SERVER_255

### Limitations
1. **No gameplay data** - Replays contain mostly server sync packets, no MSG_DRAW, MSG_SUMMONING, etc.
2. **Internal card IDs** - Deck uses Omega's internal database IDs (52, 119, 120...), not standard passcodes
3. **No card mapping** - Cannot map internal IDs to actual YGO cards without Omega's `cards.cdb`
4. **Test/sync replay** - Files appear to be server synchronization replays, not full duel recordings

## Why Archived
The Omega replay files analyzed do not contain meaningful gameplay data. They primarily consist of:
- Server synchronization packets
- Retry/acknowledge messages  
- Internal state snapshots

Without standard YGOPro gameplay messages or a card database mapping, these replays cannot be used for combo extraction or meaningful analysis.

## For Future Reference
If working with Omega replays again:
1. Verify the replay contains actual gameplay (not just sync data)
2. Obtain Omega's `cards.cdb` or card mapping table
3. Check if Omega has switched to standard YRPX format in newer versions
4. Consider using standard YGOPro/EDOPro replays instead

---
*Archived: 2025-12-28*
