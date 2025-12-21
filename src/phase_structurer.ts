/**
 * Phase Structurer - Transforms flat combo steps into logical phases.
 * 
 * Features:
 * - Phase boundary detection (summons, field spells)
 * - Chain link grouping
 * - Goal inference
 */

interface ComboStep {
    text: string;
    card?: string;
    to?: string;
    actions?: any[];
}

export interface ChainLink {
    position: number;  // CL1, CL2, etc.
    cardName: string;
    stepText: string;
}

export interface ComboPhase {
    number: number;
    title: string;
    goal: string;
    steps: ComboStep[];
    chainLinks?: ChainLink[];
}

export interface StructuredCombo {
    phases: ComboPhase[];
    finalBoard: string[];
}

// Milestone keywords that indicate phase boundaries
const PHASE_BOUNDARY_KEYWORDS = [
    'link summon',
    'xyz summon',
    'synchro summon',
    'fusion summon',
    'contact fusion',
];

const FIELD_SPELL_KEYWORDS = [
    'union hangar',
    'therion discolosseum',
    'branded',
    'domain',
    'colosseum',
    'lair',
];

/**
 * Detects if a step is a phase boundary (major milestone)
 */
function isPhaseBreak(step: ComboStep, prevSteps: ComboStep[], stepIndex: number): boolean {
    const textLower = step.text.toLowerCase();

    // Extra Deck summons are always phase breaks
    for (const keyword of PHASE_BOUNDARY_KEYWORDS) {
        if (textLower.includes(keyword)) return true;
    }

    // Field spell/continuous spell activations are phase breaks
    for (const fsKeyword of FIELD_SPELL_KEYWORDS) {
        if (textLower.includes('activate') && textLower.includes(fsKeyword)) return true;
    }

    // Normal Summon after at least 3 steps (indicates new line of play)
    if (textLower.includes('normal summon') && stepIndex > 3) {
        return true;
    }

    // Multiple searches in a row (2+ move to hand) = end that phase
    if (prevSteps.length >= 2) {
        const last2 = prevSteps.slice(-2);
        const searchCount = last2.filter(s => s.text.toLowerCase().includes('move to hand')).length;
        if (searchCount >= 2 && !textLower.includes('move to hand')) {
            return true; // Phase break after multi-search
        }
    }

    return false;
}

/**
 * Infers the goal of a phase based on its steps
 */
function inferPhaseGoal(steps: ComboStep[]): string {
    if (steps.length === 0) return 'Continue combo';

    const lastStep = steps[steps.length - 1];
    const textLower = lastStep.text.toLowerCase();

    // Check for summon types
    if (textLower.includes('link summon')) {
        const cardName = extractCardName(lastStep.text, 'Link Summon ');
        return `Link Summon ${cardName}`;
    }
    if (textLower.includes('xyz summon')) {
        const cardName = extractCardName(lastStep.text, 'Xyz Summon ');
        return `Xyz Summon ${cardName}`;
    }
    if (textLower.includes('synchro summon')) {
        const cardName = extractCardName(lastStep.text, 'Synchro Summon ');
        return `Synchro Summon ${cardName}`;
    }
    if (textLower.includes('fusion') || textLower.includes('contact fusion')) {
        const cardName = extractCardName(lastStep.text, 'Contact Fusion ') ||
            extractCardName(lastStep.text, 'Fusion Summon ');
        return `Fusion Summon ${cardName}`;
    }

    // Check for searches
    if (textLower.includes('add') || textLower.includes('move to hand')) {
        const searchedCard = extractSearchedCard(lastStep.text);
        if (searchedCard) return `Access ${searchedCard}`;
    }

    // Check for field presence
    if (textLower.includes('special summon') || textLower.includes('normal summon')) {
        return 'Establish field presence';
    }

    return 'Progress combo';
}

function extractCardName(text: string, prefix: string): string {
    if (text.includes(prefix)) {
        return text.substring(text.indexOf(prefix) + prefix.length).split(':')[0].trim();
    }
    return text.split(' ').slice(-2).join(' ');
}

function extractSearchedCard(text: string): string | null {
    const match = text.match(/Add (.+?)(?:\s|$)/i);
    return match ? match[1] : null;
}

/**
 * Groups consecutive Activate Effect steps as chain links
 */
function detectChainLinks(steps: ComboStep[]): ChainLink[] {
    const chains: ChainLink[] = [];
    let chainPosition = 0;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const textLower = step.text.toLowerCase();

        // Detect activations that might be chain links
        if (textLower.includes('activate effect') ||
            (textLower.includes('activate') && i > 0 &&
                steps[i - 1].text.toLowerCase().includes('activate'))) {
            chainPosition++;
            chains.push({
                position: chainPosition,
                cardName: extractCardName(step.text, 'Activate Effect ') ||
                    extractCardName(step.text, 'Activate '),
                stepText: step.text,
            });
        } else {
            chainPosition = 0; // Reset chain
        }
    }

    // Only return if we had actual chains (2+ links)
    return chains.filter((_, idx, arr) => {
        // Keep chains where we have consecutive CLs
        if (idx === 0) return arr.length > 1 && arr[1].position === 2;
        return arr[idx - 1].position === chains[idx].position - 1;
    });
}

/**
 * Extracts the final board state by tracking what's on field throughout all steps.
 * Uses step.actions for reliable card tracking when available.
 */
function extractFinalBoard(steps: ComboStep[]): string[] {
    // Track monsters currently on field: zone -> card ID
    const fieldState = new Map<string, string>();

    // Zones that count as "on field" (monster zones)
    const monsterZonePatterns = ['zone-m1', 'zone-m2', 'zone-m3', 'zone-m4', 'zone-m5', 'zone-m6',
        'zone-em-left', 'zone-em-right', 'zone-em'];
    const offFieldZonePatterns = ['zone-gy', 'zone-banish', 'zone-deck', 'zone-extra', 'zone-hand'];

    const isMonsterZone = (zone: string) => monsterZonePatterns.some(p => zone.includes(p));
    const isOffFieldZone = (zone: string) => offFieldZonePatterns.some(p => zone.includes(p));

    for (const step of steps) {
        const textLower = step.text.toLowerCase();

        // Primary: Use actions array if available (most reliable)
        if (step.actions && Array.isArray(step.actions)) {
            for (const action of step.actions) {
                const actionTo = action.to?.toLowerCase() || '';
                const cardId = action.card || '';

                if (isMonsterZone(actionTo)) {
                    // Card goes TO a monster zone
                    fieldState.set(actionTo, cardId);
                } else if (isOffFieldZone(actionTo)) {
                    // Card leaves field - find and remove it
                    for (const [zone, cid] of Array.from(fieldState.entries())) {
                        if (cid === cardId) {
                            fieldState.delete(zone);
                            break;
                        }
                    }
                }
            }
        }

        // Fallback: Use step.to for steps without actions
        if (!step.actions && step.to) {
            const to = step.to.toLowerCase();
            // Get card name from text
            let cardName = '';
            const summonPatterns = [
                'Link Summon ', 'Xyz Summon ', 'Synchro Summon ', 'Fusion Summon ',
                'Contact Fusion ', 'Special Summon ', 'Normal Summon '
            ];
            for (const pattern of summonPatterns) {
                if (step.text.includes(pattern)) {
                    cardName = step.text.substring(step.text.indexOf(pattern) + pattern.length).split(':')[0].trim();
                    break;
                }
            }

            if (isMonsterZone(to) && cardName) {
                fieldState.set(to, cardName);
            } else if (isOffFieldZone(to) && cardName) {
                // Remove from field
                for (const [zone, name] of Array.from(fieldState.entries())) {
                    if (name.toLowerCase().includes(cardName.toLowerCase()) ||
                        cardName.toLowerCase().includes(name.toLowerCase())) {
                        fieldState.delete(zone);
                        break;
                    }
                }
            }
        }
    }

    // Convert card IDs to names where possible, filter unique
    const finalBoard = Array.from(new Set(fieldState.values()));
    return finalBoard;
}

/**
 * Main function: Structure combo into phases
 */
export function structureComboPhases(steps: ComboStep[]): StructuredCombo {
    const phases: ComboPhase[] = [];
    let currentPhaseSteps: ComboStep[] = [];
    let phaseNumber = 1;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Check if this step starts a new phase
        if (isPhaseBreak(step, currentPhaseSteps, i) && currentPhaseSteps.length > 0) {
            // Finalize current phase
            phases.push({
                number: phaseNumber,
                title: `Phase ${phaseNumber}`,
                goal: inferPhaseGoal(currentPhaseSteps),
                steps: currentPhaseSteps,
                chainLinks: detectChainLinks(currentPhaseSteps),
            });

            phaseNumber++;
            currentPhaseSteps = [];
        }

        currentPhaseSteps.push(step);
    }

    // Add final phase
    if (currentPhaseSteps.length > 0) {
        phases.push({
            number: phaseNumber,
            title: `Phase ${phaseNumber}: End Board`,
            goal: inferPhaseGoal(currentPhaseSteps),
            steps: currentPhaseSteps,
            chainLinks: detectChainLinks(currentPhaseSteps),
        });
    }

    // Generate phase titles based on content
    phases.forEach((phase, idx) => {
        const stepsText = phase.steps.map(s => s.text.toLowerCase()).join(' ');

        if (idx === 0) {
            phase.title = 'Phase 1: Setup';
        } else if (idx === phases.length - 1) {
            phase.title = `Phase ${phase.number}: Final Board`;
        } else {
            // Determine title based on phase content
            let titleSuffix = '';

            if (stepsText.includes('link summon')) {
                titleSuffix = 'Link Play';
            } else if (stepsText.includes('xyz summon')) {
                titleSuffix = 'Xyz Play';
            } else if (stepsText.includes('synchro summon')) {
                titleSuffix = 'Synchro Play';
            } else if (stepsText.includes('fusion') || stepsText.includes('contact fusion')) {
                titleSuffix = 'Fusion Play';
            } else if (stepsText.includes('move to hand')) {
                titleSuffix = 'Resources';
            } else if (stepsText.includes('special summon')) {
                titleSuffix = 'Extend';
            } else if (stepsText.includes('equip')) {
                titleSuffix = 'Union Equip';
            } else {
                titleSuffix = phase.goal.split(' ').slice(0, 2).join(' ');
            }

            phase.title = `Phase ${phase.number}: ${titleSuffix}`;
        }
    });

    return {
        phases,
        finalBoard: extractFinalBoard(steps),
    };
}
