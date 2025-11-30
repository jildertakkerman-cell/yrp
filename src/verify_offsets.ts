
const hex = "12e80200401f0000000000000000000000000000000000280000000000000000000000000000000f00000000000000401f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
const d = Buffer.from(hex, 'hex');

console.log("Length:", d.length);
console.log("Offset 0 (Flags):", d.readUInt32LE(0));
console.log("Offset 4 (P1 LP):", d.readUInt32LE(4));
console.log("Offset 28 (P1 Deck):", d.readUInt32LE(28));
console.log("Offset 48 (P2 LP):", d.readUInt32LE(48));
console.log("Offset 49 (P2 LP + 1):", d.readUInt32LE(49));
