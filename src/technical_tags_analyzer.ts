/**
 * Technical Tags Analyzer
 * Detects strategic gameplay patterns and tags them for analysis
 */

export interface TechnicalTag {
    name: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    turn: number;
    player: number;
    playerName: string;
    details?: any;
}

interface Monster {
    code: number;
    controller: number;
    location: number;
    sequence: number;
    position: number; // Position flags
    attack: number;
    defense: number;
}

interface GameState {
    turn: number;
    phase: string;
    players: {
        lp: number;
        monstersOnField: number;
        cardsInHand: number;
        setCards: number;
    }[];
    summonsCurrent: number;
    summonsBeforeBattle: number;
    actionsThisTurn: number;
    cardsUsedThisTurn: number;
    interrupted: boolean;
    turnPlayer: number;
    battlePhaseEntered: boolean;
    attackDeclared: boolean;
    // New fields for lethal detection
    monsters: Map<string, Monster>; // Key: "controller-location-sequence"
    battleCmdReceived: boolean; // Flag to know if player had opportunity to attack
    availableAttackers: number; // Count of monsters that could attack
}

export function analyzeTechnicalTags(
    parsedSteps: any[],
    playerNames: string[]
): TechnicalTag[] {
    const tags: TechnicalTag[] = [];

    const state: GameState = {
        turn: 0,
        phase: 'Draw',
        players: [
            { lp: 8000, monstersOnField: 0, cardsInHand: 5, setCards: 0 },
            { lp: 8000, monstersOnField: 0, cardsInHand: 5, setCards: 0 }
        ],
        summonsCurrent: 0,
        summonsBeforeBattle: 0,
        actionsThisTurn: 0,
        cardsUsedThisTurn: 0,
        interrupted: false,
        turnPlayer: 0,
        battlePhaseEntered: false,
        attackDeclared: false,
        monsters: new Map(),
        battleCmdReceived: false,
        availableAttackers: 0
    };

    let turnStartMonsters = 0;
    let turnStartSetCards = 0;

    for (const step of parsedSteps) {
        const { type, details } = step;

        // Track new turn
        if (type === 'MSG_NEW_TURN') {
            // Check for tags before resetting turn state
            checkEndOfTurnTags(state, tags, playerNames);

            // Reset turn state
            state.turn++;
            state.turnPlayer = details?.player ?? state.turnPlayer;
            state.summonsCurrent = 0;
            state.summonsBeforeBattle = 0;
            state.actionsThisTurn = 0;
            state.cardsUsedThisTurn = 0;
            state.interrupted = false;
            state.battlePhaseEntered = false;
            state.attackDeclared = false;
            state.battleCmdReceived = false;
            state.availableAttackers = 0;
            turnStartMonsters = state.players[state.turnPlayer].monstersOnField;
            turnStartSetCards = state.players[state.turnPlayer].setCards;
        }

        // Track phase changes
        if (type === 'MSG_NEW_PHASE') {
            const phase = details?.phase;
            if (phase) {
                state.phase = getPhaseString(phase);

                if (state.phase === 'Battle' || state.phase === 'Battle Phase') {
                    state.battlePhaseEntered = true;

                    // Check for Nibiru vulnerability
                    if (state.summonsBeforeBattle >= 5) {
                        tags.push({
                            name: 'Nibiru Check',
                            description: `${playerNames[state.turnPlayer]} summoned ${state.summonsBeforeBattle} times before Battle Phase (Nibiru vulnerable)`,
                            severity: 'warning',
                            turn: state.turn,
                            player: state.turnPlayer,
                            playerName: playerNames[state.turnPlayer],
                            details: { summons: state.summonsBeforeBattle }
                        });
                    }

                    // Check for potential lethal (before battle starts)
                    checkPotentialLethal(state, tags, playerNames);
                }
            }
        }

        // Track summons
        if (type === 'MSG_SUMMONING' || type === 'MSG_SPSUMMONING') {
            state.summonsCurrent++;
            state.actionsThisTurn++;

            if (!state.battlePhaseEntered) {
                state.summonsBeforeBattle++;
            }

            const controller = details?.controller ?? state.turnPlayer;
            const location = details?.location ?? 0x04; // MZONE
            const sequence = details?.sequence ?? 0;
            const code = details?.code ?? 0;
            const position = details?.position ?? 0;

            state.players[controller].monstersOnField++;

            // Add monster to tracking (ATK unknown until MSG_UPDATE_DATA/MSG_UPDATE_CARD)
            const key = `${controller}-${location}-${sequence}`;
            state.monsters.set(key, {
                code,
                controller,
                location,
                sequence,
                position,
                attack: 0, // Will be updated by MSG_UPDATE_DATA or MSG_UPDATE_CARD
                defense: 0
            });
        }

        // Track effect activations
        if (type === 'MSG_CHAINING') {
            state.actionsThisTurn++;
            const controller = details?.controller;

            // Check for interruptions (opponent activating during turn player's turn)
            if (controller !== undefined && controller !== state.turnPlayer) {
                state.interrupted = true;
            }
        }

        // Track attacks
        if (type === 'MSG_ATTACK') {
            state.attackDeclared = true;
        }

        // Track LP changes
        if (type === 'MSG_LPUPDATE') {
            const player = details?.player;
            const lp = details?.lp;
            if (player !== undefined && lp !== undefined) {
                state.players[player].lp = lp;
            }
        }

        // Track card draws
        if (type === 'MSG_DRAW') {
            const player = details?.player;
            const count = details?.count ?? 1;
            if (player !== undefined) {
                state.players[player].cardsInHand += count;
                state.cardsUsedThisTurn += count;
            }
        }

        // Track monster ATK/DEF updates from MSG_UPDATE_DATA
        if (type === 'MSG_UPDATE_DATA') {
            const player = details?.player;
            const location = details?.location;
            const cards = details?.cards;

            if (cards && Array.isArray(cards)) {
                cards.forEach((card: any, index: number) => {
                    if (card.attack !== undefined) {
                        const key = `${player}-${location}-${index}`;
                        const existing = state.monsters.get(key);
                        if (existing) {
                            existing.attack = card.attack;
                            existing.defense = card.defense ?? 0;
                            if (card.position !== undefined) {
                                existing.position = card.position;
                            }
                        }
                    }
                });
            }
        }

        // Track monster ATK/DEF updates from MSG_UPDATE_CARD
        if (type === 'MSG_UPDATE_CARD') {
            const player = details?.player;
            const location = details?.location;
            const sequence = details?.sequence;
            const card = details?.card;

            if (card && card.attack !== undefined && player !== undefined && location !== undefined && sequence !== undefined) {
                const key = `${player}-${location}-${sequence}`;
                const existing = state.monsters.get(key);
                if (existing) {
                    existing.attack = card.attack;
                    existing.defense = card.defense ?? 0;
                    if (card.position !== undefined) {
                        existing.position = card.position;
                    }
                } else {
                    // Create new monster entry
                    state.monsters.set(key, {
                        code: card.code ?? 0,
                        controller: player,
                        location,
                        sequence,
                        position: card.position ?? 0,
                        attack: card.attack,
                        defense: card.defense ?? 0
                    });
                }
            }
        }

        // Track battle commands (opportunity to attack)
        if (type === 'MSG_SELECT_BATTLECMD') {
            state.battleCmdReceived = true;
            const attackable = details?.attackable;
            if (attackable && Array.isArray(attackable)) {
                state.availableAttackers = attackable.length;
            }
        }

        // Track set cards
        if (type === 'MSG_SET') {
            const controller = details?.controller ?? state.turnPlayer;
            state.players[controller].setCards++;
        }

        // Track monster removals
        if (type === 'MSG_MOVE') {
            // Track moves from field to GY, banish, etc.
            const oldController = details?.oldController;
            const oldLocation = details?.oldLocation;
            const oldSequence = details?.oldSequence;
            const newLocation = details?.newLocation;

            // Remove from field tracking if leaving MZONE (0x04)
            if (oldLocation === 0x04 && newLocation !== 0x04) {
                if (oldController !== undefined) {
                    state.players[oldController].monstersOnField = Math.max(0, state.players[oldController].monstersOnField - 1);

                    // Remove from monsters map
                    const key = `${oldController}-${oldLocation}-${oldSequence}`;
                    state.monsters.delete(key);
                }
            }
        }

        // Check for game end
        if (type === 'MSG_WIN') {
            checkGameEndTags(state, tags, playerNames, details);
        }
    }

    // Final turn check
    checkEndOfTurnTags(state, tags, playerNames);

    // Check for grind game
    if (state.turn >= 10) {
        tags.push({
            name: 'Grind Game',
            description: `Game lasted ${state.turn} turns - resource management battle`,
            severity: 'info',
            turn: state.turn,
            player: -1,
            playerName: 'Both Players',
            details: { totalTurns: state.turn }
        });
    }

    return tags;
}

function checkEndOfTurnTags(state: GameState, tags: TechnicalTag[], playerNames: string[]): void {
    if (state.turn === 0) return;

    const playerName = playerNames[state.turnPlayer];

    // Full Combo: 15+ actions with no interruptions
    if (state.actionsThisTurn >= 15 && !state.interrupted) {
        tags.push({
            name: 'Full Combo',
            description: `${playerName} executed ${state.actionsThisTurn} actions uninterrupted`,
            severity: 'info',
            turn: state.turn,
            player: state.turnPlayer,
            playerName,
            details: { actions: state.actionsThisTurn }
        });
    }

    // Overextension: 8+ summons when opponent has 3+ cards
    const opponent = state.turnPlayer === 0 ? 1 : 0;
    if (state.summonsCurrent >= 8 && state.players[opponent].cardsInHand >= 3) {
        tags.push({
            name: 'Overextension',
            description: `${playerName} summoned ${state.summonsCurrent} times while opponent held ${state.players[opponent].cardsInHand} cards (board wipe vulnerable)`,
            severity: 'warning',
            turn: state.turn,
            player: state.turnPlayer,
            playerName,
            details: { summons: state.summonsCurrent, opponentHand: state.players[opponent].cardsInHand }
        });
    }

    // Turn 1 End Board
    if (state.turn === 1) {
        const monsters = state.players[state.turnPlayer].monstersOnField;
        const setCards = state.players[state.turnPlayer].setCards;

        if (monsters >= 3 && setCards >= 2) {
            tags.push({
                name: 'Turn 1 End Board',
                description: `${playerName} ended with ${monsters} monsters and ${setCards} set cards`,
                severity: 'info',
                turn: state.turn,
                player: state.turnPlayer,
                playerName,
                details: { monsters, setCards }
            });
        }
    }

    // Resource Commitment: 10+ cards used
    if (state.cardsUsedThisTurn >= 10) {
        tags.push({
            name: 'Resource Commitment',
            description: `${playerName} used ${state.cardsUsedThisTurn}+ cards this turn (heavy investment)`,
            severity: 'info',
            turn: state.turn,
            player: state.turnPlayer,
            playerName,
            details: { cardsUsed: state.cardsUsedThisTurn }
        });
    }

    // Check for missed lethal
    checkMissedLethal(state, tags, playerNames);
}

function checkGameEndTags(state: GameState, tags: TechnicalTag[], playerNames: string[], winDetails: any): void {
    const winner = winDetails?.player;
    if (winner !== undefined) {
        const loser = winner === 0 ? 1 : 0;

        // Check if loser had lethal damage available in their last turn
        // This would require storing previous turn state, which is complex
        // For now, the checkPotentialLethal function will catch it during Battle Phase
    }
}

function checkPotentialLethal(state: GameState, tags: TechnicalTag[], playerNames: string[]): void {
    const turnPlayer = state.turnPlayer;
    const opponent = turnPlayer === 0 ? 1 : 0;
    const opponentLP = state.players[opponent].lp;

    // Calculate total available direct attack damage (monsters in attack position)
    const POSITION_FACEUP_ATTACK = 0x1;
    const MZONE = 0x04;

    let totalDirectDamage = 0;
    let attackPositionMonsters = 0;

    // Iterate through all monsters controlled by turn player in MZONE
    for (const [key, monster] of state.monsters.entries()) {
        if (monster.controller === turnPlayer && monster.location === MZONE) {
            // Check if monster is in face-up attack position
            if ((monster.position & POSITION_FACEUP_ATTACK) === POSITION_FACEUP_ATTACK) {
                totalDirectDamage += monster.attack;
                attackPositionMonsters++;
            }
        }
    }

    // Store the potential lethal info for later check
    (state as any).potentialLethalDamage = totalDirectDamage;
    (state as any).potentialLethalMonsters = attackPositionMonsters;

    // We'll check if lethal was missed in checkEndOfTurnTags
}

function checkMissedLethal(state: GameState, tags: TechnicalTag[], playerNames: string[]): void {
    const turnPlayer = state.turnPlayer;
    const opponent = turnPlayer === 0 ? 1 : 0;
    const opponentLP = state.players[opponent].lp;

    const potentialDamage = (state as any).potentialLethalDamage || 0;
    const potentialMonsters = (state as any).potentialLethalMonsters || 0;

    // Check if player had lethal damage available
    if (potentialDamage >= opponentLP && potentialMonsters > 0) {
        // Check if they either:
        // 1. Didn't enter Battle Phase at all
        // 2. Entered Battle Phase but didn't attack
        if (!state.battlePhaseEntered) {
            tags.push({
                name: 'Missed Lethal',
                description: `${playerNames[turnPlayer]} had ${potentialDamage} damage available (opponent at ${opponentLP} LP) but didn't enter Battle Phase`,
                severity: 'critical',
                turn: state.turn,
                player: turnPlayer,
                playerName: playerNames[turnPlayer],
                details: {
                    availableDamage: potentialDamage,
                    opponentLP,
                    monstersInAttack: potentialMonsters
                }
            });
        } else if (!state.attackDeclared) {
            // Entered Battle Phase but didn't attack
            tags.push({
                name: 'Missed Lethal',
                description: `${playerNames[turnPlayer]} had ${potentialDamage} damage available (opponent at ${opponentLP} LP) but didn't attack in Battle Phase`,
                severity: 'critical',
                turn: state.turn,
                player: turnPlayer,
                playerName: playerNames[turnPlayer],
                details: {
                    availableDamage: potentialDamage,
                    opponentLP,
                    monstersInAttack: potentialMonsters
                }
            });
        }
    }
}

function getPhaseString(phase: number): string {
    const phases: { [key: number]: string } = {
        0x01: 'Draw',
        0x02: 'Standby',
        0x04: 'Main Phase 1',
        0x08: 'Battle',
        0x10: 'Main Phase 2',
        0x20: 'End'
    };
    return phases[phase] || 'Unknown';
}
