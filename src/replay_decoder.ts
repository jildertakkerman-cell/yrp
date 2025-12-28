export interface ReplayStep {
    type: string;
    raw: string;
    msgId?: number;
    len?: number;
    details?: any;
    error?: string;
}

console.log("ReplayDecoder module loaded");

// YGOPro Message IDs
const MSG_RETRY = 1;
const MSG_HINT = 2;
const MSG_WAITING = 3;
const MSG_START = 4;
const MSG_WIN = 5;
const MSG_UPDATE_DATA = 6;
const MSG_UPDATE_CARD = 7;
const MSG_REQUEST_DECK = 8;
const MSG_SELECT_BATTLECMD = 10;
const MSG_SELECT_IDLECMD = 11;
const MSG_SELECT_EFFECTYN = 12;
const MSG_SELECT_YESNO = 13;
const MSG_SELECT_OPTION = 14;
const MSG_SELECT_CARD = 15;
const MSG_SELECT_CHAIN = 16;
const MSG_SELECT_PLACE = 18;
const MSG_SELECT_POSITION = 19;
const MSG_SELECT_TRIBUTE = 20;
const MSG_SORT_CHAIN = 21;
const MSG_SELECT_COUNTER = 22;
const MSG_SELECT_SUM = 23;
const MSG_SELECT_DISFIELD = 24;
const MSG_SORT_CARD = 25;
const MSG_SELECT_UNSELECT_CARD = 26;
const MSG_CONFIRM_DECKTOP = 30;
const MSG_CONFIRM_CARDS = 31;
const MSG_SHUFFLE_DECK = 32;
const MSG_SHUFFLE_HAND = 33;
const MSG_REFRESH_DECK = 34;
const MSG_SWAP_GRAVE_DECK = 35;
const MSG_SHUFFLE_SET_CARD = 36;
const MSG_REVERSE_DECK = 37;
const MSG_DECK_TOP = 38;
const MSG_SHUFFLE_EXTRA = 39;
const MSG_NEW_TURN = 40;
const MSG_NEW_PHASE = 41;
const MSG_CONFIRM_EXTRATOP = 42;
const MSG_MOVE = 50;
const MSG_POS_CHANGE = 53;
const MSG_SET = 54;
const MSG_SWAP = 55;
const MSG_FIELD_DISABLED = 56;
const MSG_SUMMONING = 60;
const MSG_SUMMONED = 61;
const MSG_SPSUMMONING = 62;
const MSG_SPSUMMONED = 63;
const MSG_FLIPSUMMONING = 64;
const MSG_FLIPSUMMONED = 65;
const MSG_CHAINING = 70;
const MSG_CHAINED = 71;
const MSG_CHAIN_SOLVING = 72;
const MSG_CHAIN_SOLVED = 73;
const MSG_CHAIN_END = 74;
const MSG_CHAIN_NEGATED = 75;
const MSG_CHAIN_DISABLED = 76;
const MSG_CARD_SELECTED = 80;
const MSG_RANDOM_SELECTED = 81;
const MSG_BECOME_TARGET = 83;
const MSG_DRAW = 90;
const MSG_DAMAGE = 91;
const MSG_RECOVER = 92;
const MSG_EQUIP = 93;
const MSG_LPUPDATE = 94;
const MSG_UNEQUIP = 95;
const MSG_CARD_TARGET = 96;
const MSG_CANCEL_TARGET = 97;
const MSG_PAY_LPCOST = 100;
const MSG_ADD_COUNTER = 101;
const MSG_REMOVE_COUNTER = 102;
const MSG_ATTACK = 110;
const MSG_BATTLE = 111;
const MSG_ATTACK_DISABLED = 112;
const MSG_DAMAGE_STEP_START = 113;
const MSG_DAMAGE_STEP_END = 114;
const MSG_MISSED_EFFECT = 120;
const MSG_BE_CHAIN_TARGET = 121;
const MSG_CREATE_RELATION = 122;
const MSG_RELEASE_RELATION = 123;
const MSG_TOSS_COIN = 130;
const MSG_TOSS_DICE = 131;
const MSG_ROCK_PAPER_SCISSORS = 132;
const MSG_HAND_RES = 133;
const MSG_ANNOUNCE_RACE = 140;
const MSG_ANNOUNCE_ATTRIB = 141;
const MSG_ANNOUNCE_CARD = 142;
const MSG_ANNOUNCE_NUMBER = 143;
const MSG_CARD_HINT = 160;
const MSG_TAG_SWAP = 161;
const MSG_RELOAD_FIELD = 162;
const MSG_AI_NAME = 163;
const MSG_SHOW_HINT = 164;
const MSG_PLAYER_HINT = 165;
const MSG_MATCH_KILL = 170;
const MSG_CUSTOM_MSG = 180;
const MSG_REMOVE_CARDS = 190;




const REPLAY_YRP1 = 0x31707279;
const REPLAY_YRPX = 0x58707279;

// OCG Types
const OCG_LOG_TYPE_ERROR = 0;
const OCG_LOG_TYPE_FROM_SCRIPT = 1;
const OCG_LOG_TYPE_FOR_DEBUG = 2;
const OCG_LOG_TYPE_UNDEFINED = 3;

const OCG_DUEL_CREATION_SUCCESS = 0;
const OCG_DUEL_CREATION_NO_OUTPUT = 1;
const OCG_DUEL_CREATION_NOT_CREATED = 2;
const OCG_DUEL_CREATION_NULL_DATA_READER = 3;
const OCG_DUEL_CREATION_NULL_SCRIPT_READER = 4;

const OCG_DUEL_STATUS_END = 0;
const OCG_DUEL_STATUS_AWAITING = 1;
const OCG_DUEL_STATUS_CONTINUE = 2;

// OCG Constants
const LOCATION_DECK = 0x01;
const LOCATION_HAND = 0x02;
const LOCATION_MZONE = 0x04;
const LOCATION_SZONE = 0x08;
const LOCATION_GRAVE = 0x10;
const LOCATION_REMOVED = 0x20;
const LOCATION_EXTRA = 0x40;
const LOCATION_OVERLAY = 0x80;
const LOCATION_ONFIELD = (LOCATION_MZONE | LOCATION_SZONE);

const POS_FACEUP_ATTACK = 0x1;
const POS_FACEDOWN_ATTACK = 0x2;
const POS_FACEUP_DEFENSE = 0x4;
const POS_FACEDOWN_DEFENSE = 0x8;
const POS_FACEUP = (POS_FACEUP_ATTACK | POS_FACEUP_DEFENSE);
const POS_FACEDOWN = (POS_FACEDOWN_ATTACK | POS_FACEDOWN_DEFENSE);
const POS_ATTACK = (POS_FACEUP_ATTACK | POS_FACEDOWN_ATTACK);
const POS_DEFENSE = (POS_FACEUP_DEFENSE | POS_FACEDOWN_DEFENSE);

const TYPE_MONSTER = 0x1;
const TYPE_SPELL = 0x2;
const TYPE_TRAP = 0x4;
const TYPE_NORMAL = 0x10;
const TYPE_EFFECT = 0x20;
const TYPE_FUSION = 0x40;
const TYPE_RITUAL = 0x80;
const TYPE_TRAPMONSTER = 0x100;
const TYPE_SPIRIT = 0x200;
const TYPE_UNION = 0x400;
const TYPE_GEMINI = 0x800;
const TYPE_TUNER = 0x1000;
const TYPE_SYNCHRO = 0x2000;
const TYPE_TOKEN = 0x4000;
const TYPE_MAXIMUM = 0x8000;
const TYPE_QUICKPLAY = 0x10000;
const TYPE_CONTINUOUS = 0x20000;
const TYPE_EQUIP = 0x40000;
const TYPE_FIELD = 0x80000;
const TYPE_COUNTER = 0x100000;
const TYPE_FLIP = 0x200000;
const TYPE_TOON = 0x400000;
const TYPE_XYZ = 0x800000;
const TYPE_PENDULUM = 0x1000000;
const TYPE_SPSUMMON = 0x2000000;
const TYPE_LINK = 0x4000000;

const ATTRIBUTE_EARTH = 0x01;
const ATTRIBUTE_WATER = 0x02;
const ATTRIBUTE_FIRE = 0x04;
const ATTRIBUTE_WIND = 0x08;
const ATTRIBUTE_LIGHT = 0x10;
const ATTRIBUTE_DARK = 0x20;
const ATTRIBUTE_DIVINE = 0x40;
const ATTRIBUTE_ALL = (ATTRIBUTE_DARK | ATTRIBUTE_DIVINE | ATTRIBUTE_EARTH | ATTRIBUTE_FIRE | ATTRIBUTE_LIGHT | ATTRIBUTE_WATER | ATTRIBUTE_WIND);

const RACE_WARRIOR = 0x1;
const RACE_SPELLCASTER = 0x2;
const RACE_FAIRY = 0x4;
const RACE_FIEND = 0x8;
const RACE_ZOMBIE = 0x10;
const RACE_MACHINE = 0x20;
const RACE_AQUA = 0x40;
const RACE_PYRO = 0x80;
const RACE_ROCK = 0x100;
const RACE_WINGEDBEAST = 0x200;
const RACE_PLANT = 0x400;
const RACE_INSECT = 0x800;
const RACE_THUNDER = 0x1000;
const RACE_DRAGON = 0x2000;
const RACE_BEAST = 0x4000;
const RACE_BEASTWARRIOR = 0x8000;
const RACE_DINOSAUR = 0x10000;
const RACE_FISH = 0x20000;
const RACE_SEASERPENT = 0x40000;
const RACE_REPTILE = 0x80000;
const RACE_PSYCHIC = 0x100000;
const RACE_DIVINE = 0x200000;
const RACE_CREATORGOD = 0x400000;
const RACE_WYRM = 0x800000;
const RACE_CYBERSE = 0x1000000;
const RACE_ILLUSION = 0x2000000;
const RACE_CYBORG = 0x4000000;
const RACE_MAGICALKNIGHT = 0x8000000;
const RACE_HIGHDRAGON = 0x10000000;
const RACE_OMEGAPSYCHIC = 0x20000000;
const RACE_CELESTIALWARRIOR = 0x40000000;
const RACE_GALAXY = 0x80000000;
const RACE_YOKAI = BigInt("0x4000000000000000");
const RACE_MAX = RACE_GALAXY;
// RACE_ALL is tricky because it mixes number and BigInt. Let's define it as BigInt to be safe if we ever use it.
// ((RACE_MAX << 1) - 1) | RACE_YOKAI
// RACE_MAX is 0x80000000 (2147483648). 
// (2147483648 << 1) - 1 = 4294967295 (0xFFFFFFFF)
// 0xFFFFFFFF | 0x4000000000000000 = 0x40000000FFFFFFFF
const RACE_ALL = BigInt("0x40000000FFFFFFFF");

const REASON_DESTROY = 0x1;
const REASON_RELEASE = 0x2;
const REASON_TEMPORARY = 0x4;
const REASON_MATERIAL = 0x8;
const REASON_SUMMON = 0x10;
const REASON_BATTLE = 0x20;
const REASON_EFFECT = 0x40;
const REASON_COST = 0x80;
const REASON_ADJUST = 0x100;
const REASON_LOST_TARGET = 0x200;
const REASON_RULE = 0x400;
const REASON_SPSUMMON = 0x800;
const REASON_DISSUMMON = 0x1000;
const REASON_FLIP = 0x2000;
const REASON_DISCARD = 0x4000;
const REASON_RDAMAGE = 0x8000;
const REASON_RRECOVER = 0x10000;
const REASON_RETURN = 0x20000;
const REASON_FUSION = 0x40000;
const REASON_SYNCHRO = 0x80000;
const REASON_RITUAL = 0x100000;
const REASON_XYZ = 0x200000;
const REASON_REPLACE = 0x1000000;
const REASON_DRAW = 0x2000000;
const REASON_REDIRECT = 0x4000000;
const REASON_LINK = 0x10000000;

const STATUS_DISABLED = 0x1;
const STATUS_TO_ENABLE = 0x2;
const STATUS_TO_DISABLE = 0x4;
const STATUS_PROC_COMPLETE = 0x8;
const STATUS_SET_TURN = 0x10;
const STATUS_NO_LEVEL = 0x20;
const STATUS_BATTLE_RESULT = 0x40;
const STATUS_SPSUMMON_STEP = 0x80;
const STATUS_FORM_CHANGED = 0x100;
const STATUS_SUMMONING = 0x200;
const STATUS_EFFECT_ENABLED = 0x400;
const STATUS_SUMMON_TURN = 0x800;
const STATUS_DESTROY_CONFIRMED = 0x1000;
const STATUS_LEAVE_CONFIRMED = 0x2000;
const STATUS_BATTLE_DESTROYED = 0x4000;
const STATUS_COPYING_EFFECT = 0x8000;
const STATUS_CHAINING = 0x10000;
const STATUS_SUMMON_DISABLED = 0x20000;
const STATUS_ACTIVATE_DISABLED = 0x40000;
const STATUS_EFFECT_REPLACED = 0x80000;
const STATUS_FUTURE_FUSION = 0x100000;
const STATUS_ATTACK_CANCELED = 0x200000;
const STATUS_INITIALIZING = 0x400000;
const STATUS_JUST_POS = 0x1000000;
const STATUS_CONTINUOUS_POS = 0x2000000;
const STATUS_FORBIDDEN = 0x4000000;
const STATUS_ACT_FROM_HAND = 0x8000000;
const STATUS_OPPO_BATTLE = 0x10000000;
const STATUS_FLIP_SUMMON_TURN = 0x20000000;
const STATUS_SPSUMMON_TURN = 0x40000000;

const QUERY_CODE = 0x1;
const QUERY_POSITION = 0x2;
const QUERY_ALIAS = 0x4;
const QUERY_TYPE = 0x8;
const QUERY_LEVEL = 0x10;
const QUERY_RANK = 0x20;
const QUERY_ATTRIBUTE = 0x40;
const QUERY_RACE = 0x80;
const QUERY_ATTACK = 0x100;
const QUERY_DEFENSE = 0x200;
const QUERY_BASE_ATTACK = 0x400;
const QUERY_BASE_DEFENSE = 0x800;
const QUERY_REASON = 0x1000;
const QUERY_REASON_CARD = 0x2000;
const QUERY_EQUIP_CARD = 0x4000;
const QUERY_TARGET_CARD = 0x8000;
const QUERY_OVERLAY_CARD = 0x10000;
const QUERY_COUNTERS = 0x20000;
const QUERY_OWNER = 0x40000;
const QUERY_STATUS = 0x80000;
const QUERY_IS_PUBLIC = 0x100000;
const QUERY_LSCALE = 0x200000;
const QUERY_RSCALE = 0x400000;
const QUERY_LINK = 0x800000;
const QUERY_IS_HIDDEN = 0x1000000;
const QUERY_COVER = 0x2000000;
const QUERY_END = 0x80000000;

const LINK_MARKER_BOTTOM_LEFT = 0o001;
const LINK_MARKER_BOTTOM = 0o002;
const LINK_MARKER_BOTTOM_RIGHT = 0o004;
const LINK_MARKER_LEFT = 0o010;
const LINK_MARKER_RIGHT = 0o040;
const LINK_MARKER_TOP_LEFT = 0o100;
const LINK_MARKER_TOP = 0o200;
const LINK_MARKER_TOP_RIGHT = 0o400;

const PHASE_DRAW = 0x01;
const PHASE_STANDBY = 0x02;
const PHASE_MAIN1 = 0x04;
const PHASE_BATTLE_START = 0x08;
const PHASE_BATTLE_STEP = 0x10;
const PHASE_DAMAGE = 0x20;
const PHASE_DAMAGE_CAL = 0x40;
const PHASE_BATTLE = 0x80;
const PHASE_MAIN2 = 0x100;
const PHASE_END = 0x200;

const PLAYER_NONE = 2;
const PLAYER_ALL = 3;

const HINT_EVENT = 1;
const HINT_MESSAGE = 2;
const HINT_SELECTMSG = 3;
const HINT_OPSELECTED = 4;
const HINT_EFFECT = 5;
const HINT_RACE = 6;
const HINT_ATTRIB = 7;
const HINT_CODE = 8;
const HINT_NUMBER = 9;
const HINT_CARD = 10;
const HINT_ZONE = 11;

const CHINT_TURN = 1;
const CHINT_CARD = 2;
const CHINT_RACE = 3;
const CHINT_ATTRIBUTE = 4;
const CHINT_NUMBER = 5;
const CHINT_DESC_ADD = 6;
const CHINT_DESC_REMOVE = 7;

const PHINT_DESC_ADD = 6;
const PHINT_DESC_REMOVE = 7;

const EFFECT_CLIENT_MODE_NORMAL = 0;
const EFFECT_CLIENT_MODE_RESOLVE = 1;
const EFFECT_CLIENT_MODE_RESET = 2;

const OPCODE_ADD = BigInt("0x4000000000000000");
const OPCODE_SUB = BigInt("0x4000000100000000");
const OPCODE_MUL = BigInt("0x4000000200000000");
const OPCODE_DIV = BigInt("0x4000000300000000");
const OPCODE_AND = BigInt("0x4000000400000000");
const OPCODE_OR = BigInt("0x4000000500000000");
const OPCODE_NEG = BigInt("0x4000000600000000");
const OPCODE_NOT = BigInt("0x4000000700000000");
const OPCODE_BAND = BigInt("0x4000000800000000");
const OPCODE_BOR = BigInt("0x4000000900000000");
const OPCODE_BNOT = BigInt("0x4000001000000000");
const OPCODE_BXOR = BigInt("0x4000001100000000");
const OPCODE_LSHIFT = BigInt("0x4000001200000000");
const OPCODE_RSHIFT = BigInt("0x4000001300000000");
const OPCODE_ALLOW_ALIASES = BigInt("0x4000001400000000");
const OPCODE_ALLOW_TOKENS = BigInt("0x4000001500000000");
const OPCODE_ISCODE = BigInt("0x4000010000000000");
const OPCODE_ISSETCARD = BigInt("0x4000010100000000");
const OPCODE_ISTYPE = BigInt("0x4000010200000000");
const OPCODE_ISRACE = BigInt("0x4000010300000000");
const OPCODE_ISATTRIBUTE = BigInt("0x4000010400000000");
const OPCODE_GETCODE = BigInt("0x4000010500000000");
const OPCODE_GETSETCARD = BigInt("0x4000010600000000");
const OPCODE_GETTYPE = BigInt("0x4000010700000000");
const OPCODE_GETRACE = BigInt("0x4000010800000000");
const OPCODE_GETATTRIBUTE = BigInt("0x4000010900000000");

const DUEL_TEST_MODE = 0x01;
const DUEL_ATTACK_FIRST_TURN = 0x02;
const DUEL_USE_TRAPS_IN_NEW_CHAIN = 0x04;
const DUEL_6_STEP_BATLLE_STEP = 0x08;
const DUEL_PSEUDO_SHUFFLE = 0x10;
const DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE = 0x20;
const DUEL_SIMPLE_AI = 0x40;
const DUEL_RELAY = 0x80;
const DUEL_OCG_OBSOLETE_IGNITION = 0x100;
const DUEL_1ST_TURN_DRAW = 0x200;
const DUEL_1_FACEUP_FIELD = 0x400;
const DUEL_PZONE = 0x800;
const DUEL_SEPARATE_PZONE = 0x1000;
const DUEL_EMZONE = 0x2000;
const DUEL_FSX_MMZONE = 0x4000;
const DUEL_TRAP_MONSTERS_NOT_USE_ZONE = 0x8000;
const DUEL_RETURN_TO_DECK_TRIGGERS = 0x10000;
const DUEL_TRIGGER_ONLY_IN_LOCATION = 0x20000;
const DUEL_SPSUMMON_ONCE_OLD_NEGATE = 0x40000;
const DUEL_CANNOT_SUMMON_OATH_OLD = 0x80000;
const DUEL_NO_STANDBY_PHASE = 0x100000;
const DUEL_NO_MAIN_PHASE_2 = 0x200000;
const DUEL_3_COLUMNS_FIELD = 0x400000;
const DUEL_DRAW_UNTIL_5 = 0x800000;
const DUEL_NO_HAND_LIMIT = 0x1000000;
const DUEL_UNLIMITED_SUMMONS = 0x2000000;
const DUEL_INVERTED_QUICK_PRIORITY = 0x4000000;
const DUEL_EQUIP_NOT_SENT_IF_MISSING_TARGET = 0x8000000;
const DUEL_0_ATK_DESTROYED = 0x10000000;
const DUEL_STORE_ATTACK_REPLAYS = 0x20000000;
const DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP = 0x40000000;
const DUEL_CAN_REPOS_IF_NON_SUMPLAYER = 0x80000000;
const DUEL_TCG_SEGOC_NONPUBLIC = BigInt("0x100000000");
const DUEL_TCG_SEGOC_FIRSTTRIGGER = BigInt("0x200000000");
const DUEL_TCG_FAST_EFFECT_IGNITION = BigInt("0x400000000");
const DUEL_EXTRA_DECK_RITUAL = BigInt("0x800000000");
const DUEL_NORMAL_SUMMON_FACEUP_DEF = BigInt("0x1000000000");

const DUEL_MODE_SPEED = BigInt(DUEL_3_COLUMNS_FIELD) | BigInt(DUEL_NO_MAIN_PHASE_2) | BigInt(DUEL_TRAP_MONSTERS_NOT_USE_ZONE) | BigInt(DUEL_TRIGGER_ONLY_IN_LOCATION);
const DUEL_MODE_RUSH = BigInt(DUEL_3_COLUMNS_FIELD) | BigInt(DUEL_NO_MAIN_PHASE_2) | BigInt(DUEL_NO_STANDBY_PHASE) | BigInt(DUEL_1ST_TURN_DRAW) | BigInt(DUEL_INVERTED_QUICK_PRIORITY) | BigInt(DUEL_DRAW_UNTIL_5) | BigInt(DUEL_NO_HAND_LIMIT) | BigInt(DUEL_UNLIMITED_SUMMONS) | BigInt(DUEL_TRAP_MONSTERS_NOT_USE_ZONE) | BigInt(DUEL_TRIGGER_ONLY_IN_LOCATION) | DUEL_EXTRA_DECK_RITUAL;
const DUEL_MODE_MR1 = BigInt(DUEL_OCG_OBSOLETE_IGNITION) | BigInt(DUEL_1ST_TURN_DRAW) | BigInt(DUEL_1_FACEUP_FIELD) | BigInt(DUEL_SPSUMMON_ONCE_OLD_NEGATE) | BigInt(DUEL_RETURN_TO_DECK_TRIGGERS) | BigInt(DUEL_CANNOT_SUMMON_OATH_OLD);
const DUEL_MODE_GOAT = DUEL_MODE_MR1 | DUEL_TCG_FAST_EFFECT_IGNITION | BigInt(DUEL_USE_TRAPS_IN_NEW_CHAIN) | BigInt(DUEL_6_STEP_BATLLE_STEP) | BigInt(DUEL_TRIGGER_WHEN_PRIVATE_KNOWLEDGE) | BigInt(DUEL_EQUIP_NOT_SENT_IF_MISSING_TARGET) | BigInt(DUEL_0_ATK_DESTROYED) | BigInt(DUEL_STORE_ATTACK_REPLAYS) | BigInt(DUEL_SINGLE_CHAIN_IN_DAMAGE_SUBSTEP) | BigInt(DUEL_CAN_REPOS_IF_NON_SUMPLAYER) | DUEL_TCG_SEGOC_NONPUBLIC | DUEL_TCG_SEGOC_FIRSTTRIGGER;
const DUEL_MODE_MR2 = BigInt(DUEL_1ST_TURN_DRAW) | BigInt(DUEL_1_FACEUP_FIELD) | BigInt(DUEL_SPSUMMON_ONCE_OLD_NEGATE) | BigInt(DUEL_RETURN_TO_DECK_TRIGGERS) | BigInt(DUEL_CANNOT_SUMMON_OATH_OLD);
const DUEL_MODE_MR3 = BigInt(DUEL_PZONE) | BigInt(DUEL_SEPARATE_PZONE) | BigInt(DUEL_SPSUMMON_ONCE_OLD_NEGATE) | BigInt(DUEL_RETURN_TO_DECK_TRIGGERS) | BigInt(DUEL_CANNOT_SUMMON_OATH_OLD);
const DUEL_MODE_MR4 = BigInt(DUEL_PZONE) | BigInt(DUEL_EMZONE) | BigInt(DUEL_SPSUMMON_ONCE_OLD_NEGATE) | BigInt(DUEL_RETURN_TO_DECK_TRIGGERS) | BigInt(DUEL_CANNOT_SUMMON_OATH_OLD);
const DUEL_MODE_MR5 = BigInt(DUEL_PZONE) | BigInt(DUEL_EMZONE) | BigInt(DUEL_FSX_MMZONE) | BigInt(DUEL_TRAP_MONSTERS_NOT_USE_ZONE) | BigInt(DUEL_TRIGGER_ONLY_IN_LOCATION);

const DUEL_MODE_MR1_FORB = (TYPE_XYZ | TYPE_PENDULUM | TYPE_LINK);
const DUEL_MODE_MR2_FORB = (TYPE_PENDULUM | TYPE_LINK);
const DUEL_MODE_MR3_FORB = TYPE_LINK;
const DUEL_MODE_MR4_FORB = 0;
const DUEL_MODE_MR5_FORB = 0;

export interface OCG_CardData {
    code: number;
    alias: number;
    setcodes: number[];
    type: number;
    level: number;
    attribute: number;
    race: bigint;
    attack: number;
    defense: number;
    lscale: number;
    rscale: number;
    link_marker: number;
}

export interface OCG_Player {
    startingLP: number;
    startingDrawCount: number;
    drawCountPerTurn: number;
}

export interface OCG_DuelOptions {
    seed: bigint[];
    flags: bigint;
    team1: OCG_Player;
    team2: OCG_Player;
    cardReader: (payload: any, code: number, data: OCG_CardData) => void;
    payload1: any;
    scriptReader: (payload: any, duel: any, name: string) => number;
    payload2: any;
    logHandler: (payload: any, string: string, type: number) => void;
    payload3: any;
    cardReaderDone: (payload: any, data: OCG_CardData) => void;
    payload4: any;
    enableUnsafeLibraries: number;
}

export interface OCG_NewCardInfo {
    team: number;
    duelist: number;
    code: number;
    con: number;
    loc: number;
    seq: number;
    pos: number;
}

export interface OCG_QueryInfo {
    flags: number;
    con: number;
    loc: number;
    seq: number;
    overlay_seq: number;
}


function getRaceName(race: number | bigint): string {
    const races = [];
    const r = BigInt(race);
    if (r & BigInt(RACE_WARRIOR)) races.push("WARRIOR");
    if (r & BigInt(RACE_SPELLCASTER)) races.push("SPELLCASTER");
    if (r & BigInt(RACE_FAIRY)) races.push("FAIRY");
    if (r & BigInt(RACE_FIEND)) races.push("FIEND");
    if (r & BigInt(RACE_ZOMBIE)) races.push("ZOMBIE");
    if (r & BigInt(RACE_MACHINE)) races.push("MACHINE");
    if (r & BigInt(RACE_AQUA)) races.push("AQUA");
    if (r & BigInt(RACE_PYRO)) races.push("PYRO");
    if (r & BigInt(RACE_ROCK)) races.push("ROCK");
    if (r & BigInt(RACE_WINGEDBEAST)) races.push("WINGEDBEAST");
    if (r & BigInt(RACE_PLANT)) races.push("PLANT");
    if (r & BigInt(RACE_INSECT)) races.push("INSECT");
    if (r & BigInt(RACE_THUNDER)) races.push("THUNDER");
    if (r & BigInt(RACE_DRAGON)) races.push("DRAGON");
    if (r & BigInt(RACE_BEAST)) races.push("BEAST");
    if (r & BigInt(RACE_BEASTWARRIOR)) races.push("BEASTWARRIOR");
    if (r & BigInt(RACE_DINOSAUR)) races.push("DINOSAUR");
    if (r & BigInt(RACE_FISH)) races.push("FISH");
    if (r & BigInt(RACE_SEASERPENT)) races.push("SEASERPENT");
    if (r & BigInt(RACE_REPTILE)) races.push("REPTILE");
    if (r & BigInt(RACE_PSYCHIC)) races.push("PSYCHIC");
    if (r & BigInt(RACE_DIVINE)) races.push("DIVINE");
    if (r & BigInt(RACE_CREATORGOD)) races.push("CREATORGOD");
    if (r & BigInt(RACE_WYRM)) races.push("WYRM");
    if (r & BigInt(RACE_CYBERSE)) races.push("CYBERSE");
    if (r & BigInt(RACE_ILLUSION)) races.push("ILLUSION");
    if (r & BigInt(RACE_CYBORG)) races.push("CYBORG");
    if (r & BigInt(RACE_MAGICALKNIGHT)) races.push("MAGICALKNIGHT");
    if (r & BigInt(RACE_HIGHDRAGON)) races.push("HIGHDRAGON");
    if (r & BigInt(RACE_OMEGAPSYCHIC)) races.push("OMEGAPSYCHIC");
    if (r & BigInt(RACE_CELESTIALWARRIOR)) races.push("CELESTIALWARRIOR");
    if (r & BigInt(RACE_GALAXY)) races.push("GALAXY");
    if (r & RACE_YOKAI) races.push("YOKAI");
    return races.length > 0 ? races.join("|") : `UNKNOWN_RACE_${race}`;
}

function getAttributeName(attr: number): string {
    const attributes = [];
    if (attr & ATTRIBUTE_EARTH) attributes.push("EARTH");
    if (attr & ATTRIBUTE_WATER) attributes.push("WATER");
    if (attr & ATTRIBUTE_FIRE) attributes.push("FIRE");
    if (attr & ATTRIBUTE_WIND) attributes.push("WIND");
    if (attr & ATTRIBUTE_LIGHT) attributes.push("LIGHT");
    if (attr & ATTRIBUTE_DARK) attributes.push("DARK");
    if (attr & ATTRIBUTE_DIVINE) attributes.push("DIVINE");
    return attributes.length > 0 ? attributes.join("|") : `UNKNOWN_ATTRIBUTE_${attr}`;
}

function getTypeName(type: number): string {
    const types = [];
    if (type & TYPE_MONSTER) types.push("MONSTER");
    if (type & TYPE_SPELL) types.push("SPELL");
    if (type & TYPE_TRAP) types.push("TRAP");
    if (type & TYPE_NORMAL) types.push("NORMAL");
    if (type & TYPE_EFFECT) types.push("EFFECT");
    if (type & TYPE_FUSION) types.push("FUSION");
    if (type & TYPE_RITUAL) types.push("RITUAL");
    if (type & TYPE_TRAPMONSTER) types.push("TRAPMONSTER");
    if (type & TYPE_SPIRIT) types.push("SPIRIT");
    if (type & TYPE_UNION) types.push("UNION");
    if (type & TYPE_GEMINI) types.push("GEMINI");
    if (type & TYPE_TUNER) types.push("TUNER");
    if (type & TYPE_SYNCHRO) types.push("SYNCHRO");
    if (type & TYPE_TOKEN) types.push("TOKEN");
    if (type & TYPE_MAXIMUM) types.push("MAXIMUM");
    if (type & TYPE_QUICKPLAY) types.push("QUICKPLAY");
    if (type & TYPE_CONTINUOUS) types.push("CONTINUOUS");
    if (type & TYPE_EQUIP) types.push("EQUIP");
    if (type & TYPE_FIELD) types.push("FIELD");
    if (type & TYPE_COUNTER) types.push("COUNTER");
    if (type & TYPE_FLIP) types.push("FLIP");
    if (type & TYPE_TOON) types.push("TOON");
    if (type & TYPE_XYZ) types.push("XYZ");
    if (type & TYPE_PENDULUM) types.push("PENDULUM");
    if (type & TYPE_SPSUMMON) types.push("SPSUMMON");
    if (type & TYPE_LINK) types.push("LINK");
    return types.length > 0 ? types.join("|") : `UNKNOWN_TYPE_${type}`;
}

function getReasonName(reason: number): string {
    const reasons = [];
    if (reason & REASON_DESTROY) reasons.push("DESTROY");
    if (reason & REASON_RELEASE) reasons.push("RELEASE");
    if (reason & REASON_TEMPORARY) reasons.push("TEMPORARY");
    if (reason & REASON_MATERIAL) reasons.push("MATERIAL");
    if (reason & REASON_SUMMON) reasons.push("SUMMON");
    if (reason & REASON_BATTLE) reasons.push("BATTLE");
    if (reason & REASON_EFFECT) reasons.push("EFFECT");
    if (reason & REASON_COST) reasons.push("COST");
    if (reason & REASON_ADJUST) reasons.push("ADJUST");
    if (reason & REASON_LOST_TARGET) reasons.push("LOST_TARGET");
    if (reason & REASON_RULE) reasons.push("RULE");
    if (reason & REASON_SPSUMMON) reasons.push("SPSUMMON");
    if (reason & REASON_DISSUMMON) reasons.push("DISSUMMON");
    if (reason & REASON_FLIP) reasons.push("FLIP");
    if (reason & REASON_DISCARD) reasons.push("DISCARD");
    if (reason & REASON_RDAMAGE) reasons.push("RDAMAGE");
    if (reason & REASON_RRECOVER) reasons.push("RRECOVER");
    if (reason & REASON_RETURN) reasons.push("RETURN");
    if (reason & REASON_FUSION) reasons.push("FUSION");
    if (reason & REASON_SYNCHRO) reasons.push("SYNCHRO");
    if (reason & REASON_RITUAL) reasons.push("RITUAL");
    if (reason & REASON_XYZ) reasons.push("XYZ");
    if (reason & REASON_REPLACE) reasons.push("REPLACE");
    if (reason & REASON_DRAW) reasons.push("DRAW");
    if (reason & REASON_REDIRECT) reasons.push("REDIRECT");
    if (reason & REASON_LINK) reasons.push("LINK");
    return reasons.length > 0 ? reasons.join("|") : `UNKNOWN_REASON_${reason}`;
}

function getLocationName(loc: number): string {
    if (loc === 0) return "NONE";
    if (loc & LOCATION_OVERLAY) {
        const baseLoc = loc & ~LOCATION_OVERLAY;
        if (baseLoc === 0) return "OVERLAY";
        return `OVERLAY|${getLocationName(baseLoc)}`;
    }
    if (loc === LOCATION_DECK) return "DECK";
    if (loc === LOCATION_HAND) return "HAND";
    if (loc === LOCATION_MZONE) return "MZONE";
    if (loc === LOCATION_SZONE) return "SZONE";
    if (loc === LOCATION_GRAVE) return "GRAVE";
    if (loc === LOCATION_REMOVED) return "REMOVED";
    if (loc === LOCATION_EXTRA) return "EXTRA";
    return `UNKNOWN_LOCATION_${loc}`;
}

function getPositionName(pos: number): string {
    if (pos === 0) return "NO_POS";
    const positions = [];
    if (pos & POS_FACEUP_ATTACK) positions.push("FACEUP_ATTACK");
    if (pos & POS_FACEDOWN_ATTACK) positions.push("FACEDOWN_ATTACK");
    if (pos & POS_FACEUP_DEFENSE) positions.push("FACEUP_DEFENSE");
    if (pos & POS_FACEDOWN_DEFENSE) positions.push("FACEDOWN_DEFENSE");
    return positions.length > 0 ? positions.join("|") : `UNKNOWN_POS_${pos}`;
}

function getPhaseName(phase: number): string {
    switch (phase) {
        case PHASE_DRAW: return "PHASE_DRAW";
        case PHASE_STANDBY: return "PHASE_STANDBY";
        case PHASE_MAIN1: return "PHASE_MAIN1";
        case PHASE_BATTLE_START: return "PHASE_BATTLE_START";
        case PHASE_BATTLE_STEP: return "PHASE_BATTLE_STEP";
        case PHASE_DAMAGE: return "PHASE_DAMAGE";
        case PHASE_DAMAGE_CAL: return "PHASE_DAMAGE_CAL";
        case PHASE_BATTLE: return "PHASE_BATTLE";
        case PHASE_MAIN2: return "PHASE_MAIN2";
        case PHASE_END: return "PHASE_END";
        default: return `UNKNOWN_PHASE_${phase}`;
    }
}

export function getDuelModeName(flags: number | bigint): string {
    const f = BigInt(flags);
    if ((f & BigInt(DUEL_MODE_RUSH)) === BigInt(DUEL_MODE_RUSH)) return "RUSH";
    if ((f & BigInt(DUEL_MODE_SPEED)) === BigInt(DUEL_MODE_SPEED)) return "SPEED";
    if ((f & BigInt(DUEL_MODE_GOAT)) === BigInt(DUEL_MODE_GOAT)) return "GOAT";
    if ((f & BigInt(DUEL_MODE_MR5)) === BigInt(DUEL_MODE_MR5)) return "MR5";
    if ((f & BigInt(DUEL_MODE_MR4)) === BigInt(DUEL_MODE_MR4)) return "MR4";
    if ((f & BigInt(DUEL_MODE_MR3)) === BigInt(DUEL_MODE_MR3)) return "MR3";
    if ((f & BigInt(DUEL_MODE_MR2)) === BigInt(DUEL_MODE_MR2)) return "MR2";
    if ((f & BigInt(DUEL_MODE_MR1)) === BigInt(DUEL_MODE_MR1)) return "MR1";

    return "UNKNOWN_MODE";
}

function getHintName(type: number): string {
    switch (type) {
        case HINT_EVENT: return "HINT_EVENT";
        case HINT_MESSAGE: return "HINT_MESSAGE";
        case HINT_SELECTMSG: return "HINT_SELECTMSG";
        case HINT_OPSELECTED: return "HINT_OPSELECTED";
        case HINT_EFFECT: return "HINT_EFFECT";
        case HINT_RACE: return "HINT_RACE";
        case HINT_ATTRIB: return "HINT_ATTRIB";
        case HINT_CODE: return "HINT_CODE";
        case HINT_NUMBER: return "HINT_NUMBER";
        case HINT_CARD: return "HINT_CARD";
        case HINT_ZONE: return "HINT_ZONE";
        default: return `UNKNOWN_HINT_${type}`;
    }
}

function getCardHintName(type: number): string {
    switch (type) {
        case CHINT_TURN: return "CHINT_TURN";
        case CHINT_CARD: return "CHINT_CARD";
        case CHINT_RACE: return "CHINT_RACE";
        case CHINT_ATTRIBUTE: return "CHINT_ATTRIBUTE";
        case CHINT_NUMBER: return "CHINT_NUMBER";
        case CHINT_DESC_ADD: return "CHINT_DESC_ADD";
        case CHINT_DESC_REMOVE: return "CHINT_DESC_REMOVE";
        default: return `UNKNOWN_CHINT_${type}`;
    }
}

function getPlayerHintName(type: number): string {
    switch (type) {
        case PHINT_DESC_ADD: return "PHINT_DESC_ADD";
        case PHINT_DESC_REMOVE: return "PHINT_DESC_REMOVE";
        default: return `UNKNOWN_PHINT_${type}`;
    }
}

function getOpcodeNames(opcodes: bigint[]): string[] {
    const names: string[] = [];
    for (const op of opcodes) {
        if (op === OPCODE_ADD) names.push("OPCODE_ADD");
        else if (op === OPCODE_SUB) names.push("OPCODE_SUB");
        else if (op === OPCODE_MUL) names.push("OPCODE_MUL");
        else if (op === OPCODE_DIV) names.push("OPCODE_DIV");
        else if (op === OPCODE_AND) names.push("OPCODE_AND");
        else if (op === OPCODE_OR) names.push("OPCODE_OR");
        else if (op === OPCODE_NEG) names.push("OPCODE_NEG");
        else if (op === OPCODE_NOT) names.push("OPCODE_NOT");
        else if (op === OPCODE_BAND) names.push("OPCODE_BAND");
        else if (op === OPCODE_BOR) names.push("OPCODE_BOR");
        else if (op === OPCODE_BNOT) names.push("OPCODE_BNOT");
        else if (op === OPCODE_BXOR) names.push("OPCODE_BXOR");
        else if (op === OPCODE_LSHIFT) names.push("OPCODE_LSHIFT");
        else if (op === OPCODE_RSHIFT) names.push("OPCODE_RSHIFT");
        else if (op === OPCODE_ALLOW_ALIASES) names.push("OPCODE_ALLOW_ALIASES");
        else if (op === OPCODE_ALLOW_TOKENS) names.push("OPCODE_ALLOW_TOKENS");
        else if (op === OPCODE_ISCODE) names.push("OPCODE_ISCODE");
        else if (op === OPCODE_ISSETCARD) names.push("OPCODE_ISSETCARD");
        else if (op === OPCODE_ISTYPE) names.push("OPCODE_ISTYPE");
        else if (op === OPCODE_ISRACE) names.push("OPCODE_ISRACE");
        else if (op === OPCODE_ISATTRIBUTE) names.push("OPCODE_ISATTRIBUTE");
        else if (op === OPCODE_GETCODE) names.push("OPCODE_GETCODE");
        else if (op === OPCODE_GETSETCARD) names.push("OPCODE_GETSETCARD");
        else if (op === OPCODE_GETTYPE) names.push("OPCODE_GETTYPE");
        else if (op === OPCODE_GETRACE) names.push("OPCODE_GETRACE");
        else if (op === OPCODE_GETATTRIBUTE) names.push("OPCODE_GETATTRIBUTE");
        else names.push(op.toString());
    }
    return names;
}

export class ReplayDecoder {
    public static parsers: { [key: number]: (d: Buffer) => any } = {
        [MSG_NEW_TURN]: (d) => ({ player: d.readUInt8(0) }),
        [MSG_NEW_PHASE]: (d) => {
            const phase = d.readUInt16LE(0);
            return { phase, phaseName: getPhaseName(phase) };
        },
        [MSG_WIN]: (d) => ({ player: d.readUInt8(0), type: d.readUInt8(1) }),
        [MSG_DRAW]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt32LE(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 5 + i * 8;
                if (offset + 8 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        // The next 4 bytes (offset + 4) are unknown (value 10 in repro).
                        // Since this is a draw, location is implicitly HAND (2) for the player.
                        controller: player,
                        location: LOCATION_HAND,
                        locationName: "HAND",
                        // Sequence is likely the last one, but we don't know it from this message.
                        // We can leave it undefined or 0.
                        sequence: 0
                    });
                }
            }
            return { player, count, cards };
        },
        [MSG_START]: (d) => {
            const info: any = {};
            if (d.length >= 1) info.type = d.readUInt8(0);
            if (d.length >= 5) info.lp = d.readUInt32LE(1);
            if (d.length >= 9) info.lp2 = d.readUInt32LE(5);
            if (d.length >= 13) info.deckSize = d.readUInt16LE(9);
            if (d.length >= 15) info.extraSize = d.readUInt16LE(11);
            if (d.length >= 17) info.handSize = d.readUInt16LE(13);
            return info;
        },
        [MSG_HINT]: (d) => {
            const type = d.readUInt8(0);
            const player = d.readUInt8(1);
            const data = d.readUInt32LE(2);
            return {
                hex: d.toString('hex'),
                type,
                typeName: getHintName(type),
                player,
                data,
                dataNote: (type === HINT_MESSAGE || type === HINT_SELECTMSG) ? "String ID" : undefined
            };
        },
        [MSG_CARD_HINT]: (d) => ({
            controller: d.readUInt8(0),
            location: d.readUInt8(1),
            locationName: getLocationName(d.readUInt8(1)),
            sequence: d.readUInt32LE(2),
            position: d.readUInt32LE(6),
            positionName: getPositionName(d.readUInt32LE(6)),
            type: d.readUInt32LE(10),
            typeName: getCardHintName(d.readUInt32LE(10)),
            val: d.readUInt32LE(14)
        }),
        [MSG_PLAYER_HINT]: (d) => ({
            player: d.readUInt8(0),
            type: d.readUInt8(1),
            typeName: getPlayerHintName(d.readUInt8(1)),
            val: d.readUInt32LE(2)
        }),
        [MSG_ANNOUNCE_RACE]: (d) => {
            const available = d.readUInt32LE(2);
            return {
                player: d.readUInt8(0),
                count: d.readUInt8(1),
                available,
                availableNames: getRaceName(available)
            };
        },
        [MSG_ANNOUNCE_ATTRIB]: (d) => {
            const available = d.readUInt32LE(2);
            return {
                player: d.readUInt8(0),
                count: d.readUInt8(1),
                available,
                availableNames: getAttributeName(available)
            };
        },
        [MSG_ANNOUNCE_CARD]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const opcodes: bigint[] = [];
            let offset = 2;
            for (let i = 0; i < count; i++) {
                if (offset + 4 > d.length) break;
                opcodes.push(BigInt(d.readUInt32LE(offset)));
                offset += 4;
            }
            return { player, count, opcodes: opcodes.map(o => o.toString()), opcodeNames: getOpcodeNames(opcodes) };
        },
        [MSG_ANNOUNCE_NUMBER]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const opts = [];
            for (let i = 0; i < count; i++) {
                if (2 + i * 4 + 4 <= d.length) {
                    opts.push(d.readUInt32LE(2 + i * 4));
                }
            }
            return { player, count, opts };
        },
        [MSG_CONFIRM_DECKTOP]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt32LE(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                if (5 + i * 4 + 4 <= d.length) {
                    cards.push(d.readUInt32LE(5 + i * 4));
                }
            }
            return { player, count, cards };
        },
        [MSG_CONFIRM_CARDS]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt32LE(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                // code(4) + controller(1) + loc(1) + seq(1)
                const offset = 5 + i * 7;
                if (offset + 7 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6)
                    });
                }
            }
            return { player, count, cards };
        },
        [MSG_CONFIRM_EXTRATOP]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt32LE(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                if (5 + i * 4 + 4 <= d.length) {
                    cards.push(d.readUInt32LE(5 + i * 4));
                }
            }
            return { player, count, cards };
        },
        [MSG_SELECT_BATTLECMD]: (d) => {
            const player = d.readUInt8(0);
            const activatableCount = d.readUInt8(1);
            let offset = 2;
            const activatable = [];
            for (let i = 0; i < activatableCount; i++) {
                const code = d.readUInt32LE(offset);
                const desc = d.readUInt32LE(offset + 4);
                const count = d.readUInt8(offset + 8);
                offset += 9;
                const clients = [];
                for (let j = 0; j < count; j++) {
                    clients.push({
                        code: d.readUInt32LE(offset),
                        desc: d.readUInt32LE(offset + 4)
                    });
                    offset += 8;
                }
                activatable.push({ code, desc, clients });
            }
            const attackableCount = d.readUInt8(offset);
            offset += 1;
            const attackable = [];
            for (let i = 0; i < attackableCount; i++) {
                attackable.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6),
                    dirAtt: d.readUInt8(offset + 7)
                });
                offset += 8;
            }
            const mainPhase2 = d.readUInt8(offset);
            const toEp = d.readUInt8(offset + 1);
            return { player, activatable, attackable, mainPhase2, toEp };
        },
        [MSG_SELECT_IDLECMD]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            let offset = 2;
            const activatable = [];
            for (let i = 0; i < count; i++) {
                const code = d.readUInt32LE(offset);
                const desc = d.readUInt32LE(offset + 4);
                const clientCount = d.readUInt8(offset + 8);
                offset += 9;
                const clients = [];
                for (let j = 0; j < clientCount; j++) {
                    clients.push({
                        code: d.readUInt32LE(offset),
                        desc: d.readUInt32LE(offset + 4)
                    });
                    offset += 8;
                }
                activatable.push({ code, desc, clients });
            }
            const summonableCount = d.readUInt8(offset);
            offset += 1;
            const summonable = [];
            for (let i = 0; i < summonableCount; i++) {
                summonable.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6)
                });
                offset += 7;
            }
            const spsummonableCount = d.readUInt8(offset);
            offset += 1;
            const spsummonable = [];
            for (let i = 0; i < spsummonableCount; i++) {
                spsummonable.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6)
                });
                offset += 7;
            }
            const reposCount = d.readUInt8(offset);
            offset += 1;
            const repos = [];
            for (let i = 0; i < reposCount; i++) {
                repos.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6)
                });
                offset += 7;
            }
            const msetCount = d.readUInt8(offset);
            offset += 1;
            const mset = [];
            for (let i = 0; i < msetCount; i++) {
                mset.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6)
                });
                offset += 7;
            }
            const ssetCount = d.readUInt8(offset);
            offset += 1;
            const sset = [];
            for (let i = 0; i < ssetCount; i++) {
                sset.push({
                    code: d.readUInt32LE(offset),
                    controller: d.readUInt8(offset + 4),
                    location: d.readUInt8(offset + 5),
                    locationName: getLocationName(d.readUInt8(offset + 5)),
                    sequence: d.readUInt8(offset + 6)
                });
                offset += 7;
            }
            const bpAllowed = d.readUInt8(offset);
            const epAllowed = d.readUInt8(offset + 1);
            const shuffleAllowed = d.readUInt8(offset + 2);
            return { player, activatable, summonable, spsummonable, repos, mset, sset, bpAllowed, epAllowed, shuffleAllowed };
        },
        [MSG_SELECT_EFFECTYN]: (d) => ({
            player: d.readUInt8(0),
            code: d.readUInt32LE(1),
            location: d.readUInt8(5),
            locationName: getLocationName(d.readUInt8(5)),
            sequence: d.readUInt8(6),
            desc: d.readUInt32LE(7)
        }),
        [MSG_SELECT_YESNO]: (d) => ({
            player: d.readUInt8(0),
            desc: d.readUInt32LE(1)
        }),
        [MSG_SELECT_OPTION]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const options = [];
            for (let i = 0; i < count; i++) {
                if (2 + i * 4 + 4 <= d.length) {
                    options.push(d.readUInt32LE(2 + i * 4));
                }
            }
            return { player, count, options };
        },
        [MSG_SELECT_CARD]: (d) => {
            const player = d.readUInt8(0);
            const cancelable = d.readUInt8(1);
            const min = d.readUInt8(2);
            const max = d.readUInt8(3);
            const count = d.readUInt32LE(4);
            const cards = [];
            for (let i = 0; i < count; i++) {
                // code(4) + controller(1) + loc(1) + seq(1)
                const offset = 8 + i * 7;
                if (offset + 7 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6)
                    });
                }
            }
            return { player, cancelable, min, max, count, cards };
        },
        [MSG_SELECT_CHAIN]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const spe_count = d.readUInt8(2);
            const forced = d.readUInt8(3);
            const hint0 = d.readUInt32LE(4);
            const hint1 = d.readUInt32LE(8);
            const chains = [];
            // Chain structure: flag(1) + code(4) + controller(1) + loc(1) + seq(1) + desc(4)
            // Total 12 bytes per chain option?
            // Let's verify standard protocol. Usually it's 12 or 13 bytes.
            // flag(1), code(4), con(1), loc(1), seq(1), desc(4) = 12 bytes.
            for (let i = 0; i < count; i++) {
                const offset = 12 + i * 12; // 12 header bytes? No, 0-3 (4 bytes) + 4-7 (4 bytes) + 8-11 (4 bytes) = 12 bytes header.
                if (offset + 12 <= d.length) {
                    chains.push({
                        flag: d.readUInt8(offset),
                        code: d.readUInt32LE(offset + 1),
                        controller: d.readUInt8(offset + 5),
                        location: d.readUInt8(offset + 6),
                        locationName: getLocationName(d.readUInt8(offset + 6)),
                        sequence: d.readUInt8(offset + 7),
                        desc: d.readUInt32LE(offset + 8)
                    });
                }
            }
            return { player, count, spe_count, forced, hint0, hint1, chains };
        },
        [MSG_SELECT_PLACE]: (d) => ({
            player: d.readUInt8(0),
            count: d.readUInt8(1),
            mask: d.readUInt32LE(2)
        }),
        [MSG_SELECT_POSITION]: (d) => ({
            player: d.readUInt8(0),
            code: d.readUInt32LE(1),
            positions: d.readUInt8(5),
            positionsName: getPositionName(d.readUInt8(5))
        }),
        [MSG_SELECT_TRIBUTE]: (d) => {
            const player = d.readUInt8(0);
            const cancelable = d.readUInt8(1);
            const min = d.readUInt8(2);
            const max = d.readUInt8(3);
            const count = d.readUInt32LE(4);
            const cards = [];
            for (let i = 0; i < count; i++) {
                // code(4) + controller(1) + loc(1) + seq(1) + release_param(1)
                const offset = 8 + i * 8;
                if (offset + 8 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6),
                        releaseParam: d.readUInt8(offset + 7)
                    });
                }
            }
            return { player, cancelable, min, max, count, cards };
        },
        [MSG_SORT_CHAIN]: (d) => ({
            player: d.readUInt8(0),
            count: d.readUInt8(1)
        }),
        [MSG_SELECT_COUNTER]: (d) => {
            const player = d.readUInt8(0);
            const type = d.readUInt16LE(1);
            const count = d.readUInt16LE(3);
            const cards = [];
            const listCount = d.readUInt32LE(5);
            for (let i = 0; i < listCount; i++) {
                // code(4) + controller(1) + loc(1) + seq(1) + num(2)
                const offset = 9 + i * 9;
                if (offset + 9 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6),
                        num: d.readUInt16LE(offset + 7)
                    });
                }
            }
            return { player, type, count, cards };
        },
        [MSG_SELECT_SUM]: (d) => {
            const mode = d.readUInt8(0);
            const player = d.readUInt8(1);
            const val = d.readUInt32LE(2);
            const min = d.readUInt32LE(6);
            const max = d.readUInt32LE(10);
            const count = d.readUInt32LE(14);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 18 + i * 11; // code(4) + controller(1) + loc(1) + seq(1) + val(4)
                if (offset + 11 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6),
                        val: d.readUInt32LE(offset + 7)
                    });
                }
            }
            return { mode, player, val, min, max, count, cards };
        },
        [MSG_SELECT_DISFIELD]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const disfields = [];
            for (let i = 0; i < count; i++) {
                const offset = 2 + i * 6; // field(4) + filter(1)? No, usually place(2) + filter(4)?
                // Let's assume standard: place(4) + filter(4)?
                // Actually, it's often:
                // place(4) (encoded location)
                if (offset + 4 <= d.length) {
                    disfields.push(d.readUInt32LE(offset));
                }
            }
            return { player, count, disfields, raw: d.toString('hex') };
        },
        [MSG_SORT_CARD]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 2 + i * 7;
                if (offset + 7 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6)
                    });
                }
            }
            return { player, count, cards };
        },
        [MSG_SELECT_UNSELECT_CARD]: (d) => {
            const player = d.readUInt8(0);
            const finishable = d.readUInt8(1);
            const cancelable = d.readUInt8(2);
            const min = d.readUInt8(3);
            const max = d.readUInt8(4);
            const count = d.readUInt32LE(5);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 9 + i * 7;
                if (offset + 7 <= d.length) {
                    cards.push({
                        code: d.readUInt32LE(offset),
                        controller: d.readUInt8(offset + 4),
                        location: d.readUInt8(offset + 5),
                        locationName: getLocationName(d.readUInt8(offset + 5)),
                        sequence: d.readUInt8(offset + 6)
                    });
                }
            }
            return { player, finishable, cancelable, min, max, count, cards };
        },
        [MSG_SHUFFLE_DECK]: (d) => ({ player: d.readUInt8(0) }),
        [MSG_SHUFFLE_HAND]: (d) => {
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
        [MSG_SHUFFLE_SET_CARD]: (d) => {
            const count = d.readUInt8(0);
            const cards = [];
            for (let i = 0; i < count; ++i) {
                const offset = 1 + i * 8;
                if (offset + 8 <= d.length) {
                    cards.push({
                        location: d.readUInt8(offset),
                        locationName: getLocationName(d.readUInt8(offset)),
                        sequence: d.readUInt8(offset + 1),
                        code: d.readUInt32LE(offset + 4)
                    });
                }
            }
            return { count, cards };
        },
        [MSG_SHUFFLE_EXTRA]: (d) => ({ player: d.readUInt8(0), count: d.readUInt8(1) }),
        [MSG_TAG_SWAP]: (d) => {
            const player = d.readUInt8(0);
            const mcount = d.readUInt8(1);
            const ecount = d.readUInt8(2);
            const pcount = d.readUInt8(3);
            const hcount = d.readUInt8(4);
            const top = d.readUInt32LE(5);
            return { player, mcount, ecount, pcount, hcount, top };
        },
        [MSG_UPDATE_DATA]: (d) => {
            const player = d.readUInt8(0);
            const location = d.readUInt8(1);
            const dataLen = d.readUInt32LE(2);
            const data = d.slice(6);

            const result: any = {
                player,
                location,
                locationName: getLocationName(location),
                dataLen
            };

            // Heuristic: Parse as TLV chunks (u16 len + data)
            const cards = [];
            let currentCard: any = {};
            let cursor = 0;

            try {
                while (cursor < data.length) {
                    if (cursor + 2 > data.length) break;
                    const chunkLen = data.readUInt16LE(cursor);
                    cursor += 2;
                    if (cursor + chunkLen > data.length) break;

                    const chunk = data.slice(cursor, cursor + chunkLen);
                    cursor += chunkLen;

                    if (chunkLen === 8) {
                        const queryType = chunk.readUInt32LE(0);
                        const value = chunk.readUInt32LE(4);

                        if (queryType === QUERY_CODE) {
                            if (currentCard.code !== undefined) {
                                cards.push(currentCard);
                                currentCard = {};
                            }
                            currentCard.code = value;
                        } else if (queryType === QUERY_POSITION) currentCard.position = value;
                        else if (queryType === QUERY_ALIAS) currentCard.alias = value;
                        else if (queryType === QUERY_TYPE) currentCard.type = value;
                        else if (queryType === QUERY_LEVEL) currentCard.level = value;
                        else if (queryType === QUERY_RANK) currentCard.rank = value;
                        else if (queryType === QUERY_ATTRIBUTE) currentCard.attribute = value;
                        else if (queryType === QUERY_ATTACK) currentCard.attack = value;
                        else if (queryType === QUERY_DEFENSE) currentCard.defense = value;
                        else if (queryType === QUERY_BASE_ATTACK) currentCard.baseAttack = value;
                        else if (queryType === QUERY_BASE_DEFENSE) currentCard.baseDefense = value;
                        else if (queryType === QUERY_REASON) currentCard.reason = value;
                        else if (queryType === QUERY_STATUS) currentCard.status = value;
                        else if (queryType === QUERY_LSCALE) currentCard.lscale = value;
                        else if (queryType === QUERY_RSCALE) currentCard.rscale = value;
                        else if (queryType === QUERY_LINK) currentCard.link = value;
                        else if (queryType === QUERY_IS_PUBLIC) currentCard.isPublic = value;
                        else if (queryType === QUERY_IS_HIDDEN) currentCard.isHidden = value;
                        else if (queryType === QUERY_COVER) currentCard.cover = value;
                        else if (queryType === QUERY_EQUIP_CARD) currentCard.equipCard = value;
                        else if (queryType === QUERY_TARGET_CARD) currentCard.targetCard = value;
                        else if (queryType === QUERY_OVERLAY_CARD) currentCard.overlayCard = value;
                        else if (queryType === QUERY_COUNTERS) currentCard.counters = value;
                        else if (queryType === QUERY_OWNER) currentCard.owner = value;
                        else if (queryType === QUERY_END) currentCard.queryEnd = value;
                        else if (queryType === QUERY_REASON_CARD) currentCard.reasonCard = value;
                        else if (queryType === QUERY_END) currentCard.queryEnd = value;
                    } else if (chunkLen === 12) {
                        const queryType = chunk.readUInt32LE(0);
                        const valLow = chunk.readUInt32LE(4);
                        const valHigh = chunk.readUInt32LE(8);
                        const value = BigInt(valLow) + (BigInt(valHigh) << BigInt(32));
                        if (queryType === QUERY_RACE) {
                            currentCard.race = value.toString();
                            currentCard.raceName = getRaceName(value);
                        }
                    }
                }
                if (currentCard.code !== undefined || Object.keys(currentCard).length > 0) {
                    if (currentCard.position !== undefined) currentCard.positionName = getPositionName(currentCard.position);
                    if (currentCard.type !== undefined) currentCard.typeName = getTypeName(currentCard.type);
                    if (currentCard.attribute !== undefined) currentCard.attributeName = getAttributeName(currentCard.attribute);
                    if (currentCard.reason !== undefined) currentCard.reasonName = getReasonName(currentCard.reason);
                    if (currentCard.location !== undefined) currentCard.locationName = getLocationName(currentCard.location);
                    cards.push(currentCard);
                }
                result.cards = cards;
            } catch (e) {
                result.raw = data.toString('hex');
            }

            return result;
        },
        [MSG_MOVE]: (d) => {
            // Omega variant: Sometimes sends short 5-byte packets
            if (d.length === 5) {
                return {
                    hex: d.toString('hex'),
                    note: "Short MOVE (Omega)",
                    // Attempt to parse as much as possible
                    code: d.readUInt32LE(0),
                    flag: d.readUInt8(4)
                };
            }

            // Standard YGOPro format (28 bytes)
            if (d.length < 28) {
                return {
                    hex: d.toString('hex'),
                    note: `Incomplete MOVE packet (${d.length} bytes, expected 28)`
                };
            }

            const code = d.readUInt32LE(0);
            const oldController = d.readUInt8(4);
            const oldLocation = d.readUInt8(5);
            const oldSequence = d.readUInt32LE(6);
            const oldPosition = d.readUInt32LE(10);
            const newController = d.readUInt8(14);
            const newLocation = d.readUInt8(15);
            const newSequence = d.readUInt32LE(16);
            const newPosition = d.readUInt32LE(20);
            const reason = d.readUInt32LE(24);
            return {
                code,
                oldController,
                oldLocation, oldLocationName: getLocationName(oldLocation),
                oldSequence,
                oldPosition, oldPositionName: getPositionName(oldPosition),
                newController,
                newLocation, newLocationName: getLocationName(newLocation),
                newSequence,
                newPosition, newPositionName: getPositionName(newPosition),
                reason, reasonName: getReasonName(reason)
            };
        },
        [MSG_SUMMONING]: (d) => {
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt32LE(6);
            const position = d.readUInt32LE(10);
            return {
                code, controller,
                location, locationName: getLocationName(location),
                sequence,
                position, positionName: getPositionName(position)
            };
        },
        [MSG_SUMMONED]: (d) => ({}),
        [MSG_SPSUMMONING]: (d) => {
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt32LE(6);
            const position = d.readUInt32LE(10);
            return {
                code, controller,
                location, locationName: getLocationName(location),
                sequence,
                position, positionName: getPositionName(position)
            };
        },
        [MSG_SPSUMMONED]: (d) => ({}),
        [MSG_FLIPSUMMONING]: (d) => {
            const code = d.readUInt32LE(0);
            const controller = d.readUInt8(4);
            const location = d.readUInt8(5);
            const sequence = d.readUInt32LE(6);
            const position = d.readUInt32LE(10);
            return {
                code, controller,
                location, locationName: getLocationName(location),
                sequence,
                position, positionName: getPositionName(position)
            };
        },
        [MSG_RANDOM_SELECTED]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 2 + i * 4;
                if (offset + 4 <= d.length) {
                    cards.push(d.readUInt32LE(offset));
                }
            }
            return { player, count, cards };
        },
        [MSG_BECOME_TARGET]: (d) => {
            const count = d.readUInt8(0);
            const cards = [];
            for (let i = 0; i < count; i++) {
                const offset = 1 + i * 4;
                if (offset + 4 <= d.length) {
                    cards.push(d.readUInt32LE(offset));
                }
            }
            return { count, cards };
        },
        [MSG_ATTACK]: (d) => {
            const attackerController = d.readUInt8(0);
            const attackerLocation = d.readUInt8(1);
            const attackerSequence = d.readUInt8(2);
            const attackerPosition = d.readUInt8(3);
            const defenderController = d.readUInt8(4);
            const defenderLocation = d.readUInt8(5);
            const defenderSequence = d.readUInt8(6);
            const defenderPosition = d.readUInt8(7);
            return {
                attacker: {
                    controller: attackerController,
                    location: attackerLocation, locationName: getLocationName(attackerLocation),
                    sequence: attackerSequence,
                    position: attackerPosition, positionName: getPositionName(attackerPosition)
                },
                defender: {
                    controller: defenderController,
                    location: defenderLocation, locationName: getLocationName(defenderLocation),
                    sequence: defenderSequence,
                    position: defenderPosition, positionName: getPositionName(defenderPosition)
                }
            };
        },
        [MSG_BATTLE]: (d) => ({
            attacker: d.readUInt32LE(0),
            defender: d.readUInt32LE(4)
        }),
        [MSG_DAMAGE]: (d) => ({ player: d.readUInt8(0), amount: d.readUInt32LE(1) }),
        [MSG_RELOAD_FIELD]: (d) => {
            try {
                if (d.length < 4) return { data: d.toString('hex') };

                const duelFlags = d.readUInt32LE(0);
                const result: any = { duelFlags, duelMode: getDuelModeName(BigInt(duelFlags)) };

                if (d.length >= 44) {
                    result.p1 = {
                        lp: d.readUInt32LE(4),
                        handCount: d.readUInt32LE(8),
                        graveCount: d.readUInt32LE(12),
                        removeCount: d.readUInt32LE(16),
                        deckCount: d.readUInt32LE(28),
                        extraCount: d.readUInt32LE(36)
                    };
                }

                if (d.length >= 88) {
                    result.p2 = {
                        lp: d.readUInt32LE(44),
                        handCount: d.readUInt32LE(48),
                        graveCount: d.readUInt32LE(52),
                        removeCount: d.readUInt32LE(56),
                        deckCount: d.readUInt32LE(68),
                        extraCount: d.readUInt32LE(76)
                    };
                }

                result.raw = d.toString('hex');
                return result;
            } catch (e) {
                console.error("Error in MSG_RELOAD_FIELD:", e);
                throw e;
            }
        },
        [MSG_RETRY]: (d) => ({ data: d.toString('hex') }),
        [MSG_WAITING]: (d) => ({ data: d.toString('hex') }),
        [MSG_UPDATE_CARD]: (d) => {
            const player = d.readUInt8(0);
            const location = d.readUInt8(1);
            const sequence = d.readUInt8(2);
            // Offset 3-12 seems to be header data (position, padding, code?)
            // The first valid chunk (08 00) appears at offset 13 in the observed data.
            let cursor = 13;

            const card: any = {};
            try {
                while (cursor < d.length) {
                    if (cursor + 2 > d.length) break;
                    const chunkLen = d.readUInt16LE(cursor);
                    cursor += 2;
                    if (cursor + chunkLen > d.length) break;

                    const chunk = d.slice(cursor, cursor + chunkLen);
                    cursor += chunkLen;

                    if (chunkLen === 8) {
                        const queryType = chunk.readUInt32LE(0);
                        const value = chunk.readUInt32LE(4);

                        if (queryType === QUERY_CODE) card.code = value;
                        else if (queryType === QUERY_POSITION) card.position = value;
                        else if (queryType === QUERY_ALIAS) card.alias = value;
                        else if (queryType === QUERY_TYPE) card.type = value;
                        else if (queryType === QUERY_LEVEL) card.level = value;
                        else if (queryType === QUERY_RANK) card.rank = value;
                        else if (queryType === QUERY_ATTRIBUTE) card.attribute = value;
                        else if (queryType === QUERY_ATTACK) card.attack = value;
                        else if (queryType === QUERY_DEFENSE) card.defense = value;
                        else if (queryType === QUERY_BASE_ATTACK) card.baseAttack = value;
                        else if (queryType === QUERY_BASE_DEFENSE) card.baseDefense = value;
                        else if (queryType === QUERY_REASON) card.reason = value;
                        else if (queryType === QUERY_STATUS) card.status = value;
                        else if (queryType === QUERY_LSCALE) card.lscale = value;
                        else if (queryType === QUERY_RSCALE) card.rscale = value;
                        else if (queryType === QUERY_LINK) card.link = value;
                        else if (queryType === QUERY_EQUIP_CARD) card.equipCard = value;
                        else if (queryType === QUERY_TARGET_CARD) card.targetCard = value;
                        else if (queryType === QUERY_OVERLAY_CARD) card.overlayCard = value;
                        else if (queryType === QUERY_COUNTERS) card.counters = value;
                        else if (queryType === QUERY_OWNER) card.owner = value;
                        else if (queryType === QUERY_END) card.queryEnd = value;
                        else if (queryType === QUERY_REASON_CARD) card.reasonCard = value;
                        else if (queryType === QUERY_IS_PUBLIC) card.isPublic = value;
                        else if (queryType === QUERY_IS_HIDDEN) card.isHidden = value;
                        else if (queryType === QUERY_COVER) card.cover = value;
                        else if (queryType === QUERY_END) card.queryEnd = value;
                    } else if (chunkLen === 12) {
                        const queryType = chunk.readUInt32LE(0);
                        const valLow = chunk.readUInt32LE(4);
                        const valHigh = chunk.readUInt32LE(8);
                        const value = BigInt(valLow) + (BigInt(valHigh) << BigInt(32));
                        if (queryType === QUERY_RACE) {
                            card.race = value.toString();
                            card.raceName = getRaceName(value);
                        }
                    }
                }

                if (card.position !== undefined) card.positionName = getPositionName(card.position);
                if (card.type !== undefined) card.typeName = getTypeName(card.type);
                if (card.attribute !== undefined) card.attributeName = getAttributeName(card.attribute);
                if (card.reason !== undefined) card.reasonName = getReasonName(card.reason);
                if (card.location !== undefined) card.locationName = getLocationName(card.location);
            } catch (e) {
                // Ignore
            }

            return { player, location, locationName: getLocationName(location), sequence, card };
        },
        [MSG_REQUEST_DECK]: (d) => ({ data: d.toString('hex') }),
        [MSG_REFRESH_DECK]: (d) => ({ data: d.toString('hex') }),
        [MSG_SWAP_GRAVE_DECK]: (d) => ({ data: d.toString('hex') }),
        [MSG_REVERSE_DECK]: (d) => ({ data: d.toString('hex') }),
        [MSG_DECK_TOP]: (d) => ({ data: d.toString('hex') }),
        [MSG_RECOVER]: (d) => ({ player: d.readUInt8(0), amount: d.readUInt32LE(1) }),
        [MSG_EQUIP]: (d) => ({
            controller: d.readUInt8(0),
            location: d.readUInt8(1),
            locationName: getLocationName(d.readUInt8(1)),
            sequence: d.readUInt32LE(2),
            position: d.readUInt32LE(6),
            positionName: getPositionName(d.readUInt32LE(6)),
            targetController: d.readUInt8(10),
            targetLocation: d.readUInt8(11),
            targetLocationName: getLocationName(d.readUInt8(11)),
            targetSequence: d.readUInt32LE(12),
            targetPosition: d.readUInt32LE(16),
            targetPositionName: getPositionName(d.readUInt32LE(16))
        }),
        // Generic dumpers for observed Omega unknowns to see data in JSON
        [0]: (d) => {
            const res: any = { hex: d.toString('hex') };
            if (d.length === 1) {
                res.value = d[0];
                res.note = "Single Byte Flag";
            } else if (d.length === 4) {
                res.value = d.readInt32LE(0);
                res.note = "Int32 Value";
            } else if (d.length > 4) {
                if (d.includes(Buffer.from('ff9fffff', 'hex'))) {
                    res.note = "Server Data (Contains Signature)";
                }
                const ints = [];
                for (let i = 0; i <= d.length - 4; i += 4) {
                    ints.push(d.readInt32LE(i));
                    if (ints.length >= 8) break;
                }
                res.intPreview = ints;
            }
            return res;
        },
        [48]: (d) => ({ hex: d.toString('hex'), note: "Server Packet 48" }),
        [52]: (d) => ({ hex: d.toString('hex'), note: "Server Packet 52" }),
        [57]: (d) => ({ hex: d.toString('hex'), note: "Server Packet 57" }),
        [9]: (d) => ({ hex: d.toString('hex'), ascii: d.toString('ascii').replace(/[^\x20-\x7E]/g, '.') }),
        [108]: (d) => {
            const res: any = { hex: d.toString('hex') };
            if (d.length === 2) {
                res.value = d.readUInt16LE(0);
                res.note = "Short Flag";
            } else if (d.length > 2) {
                res.note = "Server Data";
                if (d.includes(Buffer.from('ff9fffff', 'hex'))) {
                    res.note += " (Contains Signature)";
                }
                const ints = [];
                for (let i = 0; i <= d.length - 4; i += 4) {
                    ints.push(d.readInt32LE(i));
                }
                res.intValues = ints;
            }
            return res;
        },
        [159]: (d) => {
            const res: any = { hex: d.toString('hex') };
            if (d.length === 255 && d.readUInt16LE(0) === 0xffff) {
                // Omega Server Sync Packet (Standard)
                res.note = "Server Sync (Standard)";
                res.head = -1;
                const ints = [];
                // 255 bytes = 2 (head) + 252 (63 ints) + 1 (tail)
                for (let i = 2; i < 254; i += 4) {
                    ints.push(d.readInt32LE(i));
                }
                res.intValues = ints;
                res.tail = d.readUInt8(254);
            } else {
                res.note = "Server Sync (Non-Standard)";
            }
            return res;
        },
        [235]: (d) => {
            const res: any = { hex: d.toString('hex') };
            res.note = "Server Data";
            if (d.includes(Buffer.from('ff9fffff', 'hex'))) {
                res.note += " (Contains Signature)";
            }
            const ints = [];
            // Parse whole body as ints up to last aligned byte
            for (let i = 0; i <= d.length - 4; i += 4) {
                ints.push(d.readInt32LE(i));
            }
            res.intValues = ints;
            return res;
        },
        [255]: (d) => ({ hex: d.toString('hex') }),
        [49]: (d) => {
            // MSG_OMEGA_SEQ?
            const res: any = { hex: d.toString('hex') };
            // Try to read null-terminated ASCII string from start
            let nullIdx = d.indexOf(0);
            if (nullIdx >= 0 && nullIdx < 4) {
                const str = d.slice(0, nullIdx).toString('ascii');
                if (/^\d+$/.test(str)) {
                    res.sequenceStr = str;
                    res.note = "Sequence ID";
                }
            }
            return res;
        },

        [MSG_LPUPDATE]: (d) => ({ player: d.readUInt8(0), lp: d.readUInt32LE(1) }),
        [MSG_UNEQUIP]: (d) => ({
            location: d.readUInt8(0),
            locationName: getLocationName(d.readUInt8(0)),
            sequence: d.readUInt8(1)
        }),
        [MSG_CARD_TARGET]: (d) => ({
            location: d.readUInt8(0),
            locationName: getLocationName(d.readUInt8(0)),
            sequence: d.readUInt8(1),
            targetLocation: d.readUInt8(2),
            targetLocationName: getLocationName(d.readUInt8(2)),
            targetSequence: d.readUInt8(3)
        }),
        [MSG_CANCEL_TARGET]: (d) => ({
            location: d.readUInt8(0),
            locationName: getLocationName(d.readUInt8(0)),
            sequence: d.readUInt8(1),
            targetLocation: d.readUInt8(2),
            targetLocationName: getLocationName(d.readUInt8(2)),
            targetSequence: d.readUInt8(3)
        }),
        [MSG_PAY_LPCOST]: (d) => ({ player: d.readUInt8(0), cost: d.readUInt32LE(1) }),
        [MSG_ADD_COUNTER]: (d) => ({
            type: d.readUInt16LE(0),
            location: d.readUInt8(2),
            locationName: getLocationName(d.readUInt8(2)),
            sequence: d.readUInt8(3),
            count: d.readUInt16LE(4)
        }),
        [MSG_REMOVE_COUNTER]: (d) => ({
            type: d.readUInt16LE(0),
            location: d.readUInt8(2),
            locationName: getLocationName(d.readUInt8(2)),
            sequence: d.readUInt8(3),
            count: d.readUInt16LE(4)
        }),
        [MSG_ATTACK_DISABLED]: (d) => ({ data: d.toString('hex') }),
        [MSG_DAMAGE_STEP_START]: (d) => ({ data: d.toString('hex') }),
        [MSG_DAMAGE_STEP_END]: (d) => ({ data: d.toString('hex') }),
        [MSG_MISSED_EFFECT]: (d) => ({
            position: d.readUInt8(0),
            code: d.readUInt32LE(4)
        }),
        [MSG_BE_CHAIN_TARGET]: (d) => ({ data: d.toString('hex') }),
        [MSG_CREATE_RELATION]: (d) => ({ data: d.toString('hex') }),
        [MSG_RELEASE_RELATION]: (d) => ({ data: d.toString('hex') }),
        [MSG_TOSS_COIN]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(d.readUInt8(2 + i));
            }
            return { player, count, results };
        },
        [MSG_TOSS_DICE]: (d) => {
            const player = d.readUInt8(0);
            const count = d.readUInt8(1);
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(d.readUInt8(2 + i));
            }
            return { player, count, results };
        },
        [MSG_ROCK_PAPER_SCISSORS]: (d) => ({ player: d.readUInt8(0) }),
        [MSG_HAND_RES]: (d) => ({
            res: d.readUInt8(0)
        }),
        [MSG_AI_NAME]: (d) => {
            const len = d.readUInt16LE(0);
            const offset = 2;
            let name = "";
            if (offset + len <= d.length) {
                name = d.slice(offset, offset + len).toString('utf8').replace(/\0/g, '');
            }
            return { len, name };
        },
        [MSG_SHOW_HINT]: (d) => {
            const len = d.readUInt16LE(0);
            const offset = 2;
            let hint = "";
            if (offset + len <= d.length) {
                hint = d.slice(offset, offset + len).toString('utf8').replace(/\0/g, '');
            }
            return { len, hint };
        },
        [MSG_MATCH_KILL]: (d) => ({
            code: d.readUInt32LE(0)
        }),
        [MSG_CUSTOM_MSG]: (d) => ({
            player: d.readUInt8(0),
            msg: d.readUInt32LE(1)
        }),
        [MSG_REMOVE_CARDS]: (d) => ({
            type: d.readUInt8(0),
            player: d.readUInt8(1),
            count: d.readUInt8(2),
            data: d.slice(3).toString('hex')
        }),
        [MSG_CHAINING]: (d) => {
            const code = d.readUInt32LE(0);
            const pcode = d.readUInt32LE(4);
            const func = d.readUInt32LE(8);
            const triggerController = d.readUInt8(12);
            const triggerLocation = d.readUInt8(13);
            const triggerSequence = 0; // d.readUInt8(14); // Offset 14 is controller
            const controller = d.readUInt8(14);
            const location = d.readUInt8(15);
            const sequence = d.readUInt8(16);
            const desc = d.readUInt32LE(18);
            const param1 = d.readUInt32LE(22);
            const param2 = d.readUInt16LE(26);
            const param3 = d.readUInt32LE(28);

            return {
                code,
                pcode,
                function: func,
                triggerController,
                triggerLocation, triggerLocationName: getLocationName(triggerLocation),
                triggerSequence,
                controller,
                location, locationName: getLocationName(location),
                sequence,
                desc,
                param1,
                param2,
                param3
            };
        }
    };

    public static decode(buffer: Buffer, replayId: number): ReplayStep[] {
        if (replayId === REPLAY_YRP1) {
            return this.decodeYRP1(buffer);
        } else if (replayId === REPLAY_YRPX) {
            return this.decodeYRPX(buffer);
        } else {
            console.warn(`Unknown replay ID: 0x${replayId.toString(16)}. Defaulting to YRP1.`);
            return this.decodeYRP1(buffer);
        }
    }

    public static getMsgName(msgId: number): string {
        switch (msgId) {
            case MSG_RETRY: return "MSG_RETRY";
            case MSG_HINT: return "MSG_HINT";
            case MSG_WAITING: return "MSG_WAITING";
            case MSG_START: return "MSG_START";
            case MSG_WIN: return "MSG_WIN";
            case MSG_UPDATE_DATA: return "MSG_UPDATE_DATA";
            case MSG_UPDATE_CARD: return "MSG_UPDATE_CARD";
            case MSG_REQUEST_DECK: return "MSG_REQUEST_DECK";
            case MSG_SELECT_BATTLECMD: return "MSG_SELECT_BATTLECMD";
            case MSG_SELECT_IDLECMD: return "MSG_SELECT_IDLECMD";
            case MSG_SELECT_EFFECTYN: return "MSG_SELECT_EFFECTYN";
            case MSG_SELECT_YESNO: return "MSG_SELECT_YESNO";
            case MSG_SELECT_OPTION: return "MSG_SELECT_OPTION";
            case MSG_SELECT_CARD: return "MSG_SELECT_CARD";
            case MSG_SELECT_CHAIN: return "MSG_SELECT_CHAIN";
            case MSG_SELECT_PLACE: return "MSG_SELECT_PLACE";
            case MSG_SELECT_POSITION: return "MSG_SELECT_POSITION";
            case MSG_SELECT_TRIBUTE: return "MSG_SELECT_TRIBUTE";
            case MSG_SORT_CHAIN: return "MSG_SORT_CHAIN";
            case MSG_SELECT_COUNTER: return "MSG_SELECT_COUNTER";
            case MSG_SELECT_SUM: return "MSG_SELECT_SUM";
            case MSG_SELECT_DISFIELD: return "MSG_SELECT_DISFIELD";
            case MSG_SORT_CARD: return "MSG_SORT_CARD";
            case MSG_SELECT_UNSELECT_CARD: return "MSG_SELECT_UNSELECT_CARD";
            case MSG_CONFIRM_DECKTOP: return "MSG_CONFIRM_DECKTOP";
            case MSG_CONFIRM_CARDS: return "MSG_CONFIRM_CARDS";
            case MSG_SHUFFLE_DECK: return "MSG_SHUFFLE_DECK";
            case MSG_SHUFFLE_HAND: return "MSG_SHUFFLE_HAND";
            case MSG_REFRESH_DECK: return "MSG_REFRESH_DECK";
            case MSG_SWAP_GRAVE_DECK: return "MSG_SWAP_GRAVE_DECK";
            case MSG_SHUFFLE_SET_CARD: return "MSG_SHUFFLE_SET_CARD";
            case MSG_REVERSE_DECK: return "MSG_REVERSE_DECK";
            case MSG_DECK_TOP: return "MSG_DECK_TOP";
            case MSG_SHUFFLE_EXTRA: return "MSG_SHUFFLE_EXTRA";
            case MSG_NEW_TURN: return "MSG_NEW_TURN";
            case MSG_NEW_PHASE: return "MSG_NEW_PHASE";
            case 9: return "MSG_SERVER_DEBUG_9";
            case 0: return "MSG_SERVER_GENERIC";
            case 48: return "MSG_SERVER_48";
            case 52: return "MSG_SERVER_52";
            case 57: return "MSG_SERVER_57";
            case 108: return "MSG_SERVER_108";
            case 159: return "MSG_SERVER_PACKET_159";
            case 235: return "MSG_SERVER_235";
            case 255: return "MSG_SERVER_255";
            case MSG_CONFIRM_EXTRATOP: return "MSG_CONFIRM_EXTRATOP";
            case MSG_MOVE: return "MSG_MOVE";
            case MSG_POS_CHANGE: return "MSG_POS_CHANGE";
            case MSG_SET: return "MSG_SET";
            case MSG_SWAP: return "MSG_SWAP";
            case MSG_FIELD_DISABLED: return "MSG_FIELD_DISABLED";
            case MSG_SUMMONING: return "MSG_SUMMONING";
            case MSG_SUMMONED: return "MSG_SUMMONED";
            case MSG_SPSUMMONING: return "MSG_SPSUMMONING";
            case MSG_SPSUMMONED: return "MSG_SPSUMMONED";
            case MSG_FLIPSUMMONING: return "MSG_FLIPSUMMONING";
            case MSG_FLIPSUMMONED: return "MSG_FLIPSUMMONED";
            case MSG_CHAINING: return "MSG_CHAINING";
            case MSG_CHAINED: return "MSG_CHAINED";
            case MSG_CHAIN_SOLVING: return "MSG_CHAIN_SOLVING";
            case MSG_CHAIN_SOLVED: return "MSG_CHAIN_SOLVED";
            case MSG_CHAIN_END: return "MSG_CHAIN_END";
            case MSG_CHAIN_NEGATED: return "MSG_CHAIN_NEGATED";
            case MSG_CHAIN_DISABLED: return "MSG_CHAIN_DISABLED";
            case MSG_CARD_SELECTED: return "MSG_CARD_SELECTED";
            case MSG_RANDOM_SELECTED: return "MSG_RANDOM_SELECTED";
            case MSG_BECOME_TARGET: return "MSG_BECOME_TARGET";
            case MSG_DRAW: return "MSG_DRAW";
            case MSG_DAMAGE: return "MSG_DAMAGE";
            case MSG_RECOVER: return "MSG_RECOVER";
            case MSG_EQUIP: return "MSG_EQUIP";
            case MSG_LPUPDATE: return "MSG_LPUPDATE";
            case MSG_UNEQUIP: return "MSG_UNEQUIP";
            case MSG_CARD_TARGET: return "MSG_CARD_TARGET";
            case MSG_CANCEL_TARGET: return "MSG_CANCEL_TARGET";
            case MSG_PAY_LPCOST: return "MSG_PAY_LPCOST";
            case MSG_ADD_COUNTER: return "MSG_ADD_COUNTER";
            case MSG_REMOVE_COUNTER: return "MSG_REMOVE_COUNTER";
            case MSG_ATTACK: return "MSG_ATTACK";
            case MSG_BATTLE: return "MSG_BATTLE";
            case MSG_ATTACK_DISABLED: return "MSG_ATTACK_DISABLED";
            case MSG_DAMAGE_STEP_START: return "MSG_DAMAGE_STEP_START";
            case MSG_DAMAGE_STEP_END: return "MSG_DAMAGE_STEP_END";
            case MSG_MISSED_EFFECT: return "MSG_MISSED_EFFECT";
            case MSG_BE_CHAIN_TARGET: return "MSG_BE_CHAIN_TARGET";
            case MSG_CREATE_RELATION: return "MSG_CREATE_RELATION";
            case MSG_RELEASE_RELATION: return "MSG_RELEASE_RELATION";
            case MSG_TOSS_COIN: return "MSG_TOSS_COIN";
            case MSG_TOSS_DICE: return "MSG_TOSS_DICE";
            case MSG_ROCK_PAPER_SCISSORS: return "MSG_ROCK_PAPER_SCISSORS";
            case MSG_HAND_RES: return "MSG_HAND_RES";
            case MSG_ANNOUNCE_RACE: return "MSG_ANNOUNCE_RACE";
            case MSG_ANNOUNCE_ATTRIB: return "MSG_ANNOUNCE_ATTRIB";
            case MSG_ANNOUNCE_CARD: return "MSG_ANNOUNCE_CARD";
            case MSG_ANNOUNCE_NUMBER: return "MSG_ANNOUNCE_NUMBER";
            case MSG_CARD_HINT: return "MSG_CARD_HINT";
            case MSG_TAG_SWAP: return "MSG_TAG_SWAP";
            case MSG_RELOAD_FIELD: return "MSG_RELOAD_FIELD";
            case MSG_AI_NAME: return "MSG_AI_NAME";
            case MSG_SHOW_HINT: return "MSG_SHOW_HINT";
            case MSG_PLAYER_HINT: return "MSG_PLAYER_HINT";
            case MSG_MATCH_KILL: return "MSG_MATCH_KILL";
            case MSG_CUSTOM_MSG: return "MSG_CUSTOM_MSG";
            case MSG_REMOVE_CARDS: return "MSG_REMOVE_CARDS";
            default: return `UNKNOWN_MSG_${msgId}`;
        }
    }

    private static decodeYRP1(buffer: Buffer): ReplayStep[] {
        const steps: ReplayStep[] = [];
        let cursor = 0;

        while (cursor < buffer.length) {
            // YRP1 Format: [Length: 1 byte] [Data: Length bytes]
            const len = buffer.readUInt8(cursor);
            cursor += 1;

            if (len === 0) continue;
            if (cursor + len > buffer.length) break;

            const data = buffer.slice(cursor, cursor + len);
            cursor += len;

            // In YRP1, the data is a response to an engine query.
            // It's not easily decodable without knowing the query.
            // But we can store it as a generic step.
            steps.push({
                type: 'Response',
                raw: data.toString('hex'),
                len: len
            });
        }
        return steps;
    }

    private static decodeYRPX(buffer: Buffer): ReplayStep[] {
        const steps: ReplayStep[] = [];
        let cursor = 0;

        while (cursor < buffer.length) {
            // YRPX Format: [MsgID: 1 byte] [Length: 4 bytes] [Data: Length bytes]
            if (cursor + 5 > buffer.length) break;

            const msgId = buffer.readUInt8(cursor);
            cursor += 1;

            const len = buffer.readUInt32LE(cursor);
            cursor += 4;

            if (cursor + len > buffer.length) break;

            const data = buffer.slice(cursor, cursor + len);
            cursor += len;

            const step: ReplayStep = {
                type: this.getMsgName(msgId),
                msgId: msgId,
                len: len,
                raw: data.toString('hex')
            };

            if (this.parsers[msgId]) {
                try {
                    step.details = this.parsers[msgId](data);
                } catch (e) {
                    console.error(`Error parsing message ${step.type}:`, e);
                    step.details = { error: 'Parse Error' };
                }
            }

            steps.push(step);
        }
        return steps;
    }


}

