import PDFDocument from 'pdfkit';
import https from 'https';
import { structureComboPhases, ComboPhase } from './phase_structurer';

interface CardInfo {
    id: string;
    name: string;
    type: string;
    zone: string;
}

interface ComboStep {
    text: string;
    card?: string;
    to?: string;
    actions?: any[];
}

interface ComboData {
    archetype?: string;
    playerName?: string;
    combos?: {
        combo1?: {
            title?: string;
            description?: string;
            cards?: CardInfo[];
            steps?: ComboStep[];
        };
    };
}

// Simplified color palette - single accent
const COLORS = {
    primary: '#1e3a5f',        // Deep navy
    accent: '#2563eb',         // Blue accent
    text: '#1f2937',           // Dark gray
    lightText: '#6b7280',      // Medium gray
    border: '#d1d5db',         // Light gray border
    background: '#ffffff',     // White
    cardBg: '#f3f4f6',         // Very light gray
    white: '#ffffff',
    // Summon type colors
    fusion: '#9333ea',         // Purple
    synchro: '#e5e7eb',        // White/Light gray
    xyz: '#1f2937',            // Black/Dark
    link: '#2563eb',           // Blue
};

function getCardIdFromFullId(fullId: string): string {
    const match = fullId.match(/card_(\d+)_/);
    return match ? match[1] : '';
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                resolve(null);
                return;
            }
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks as any)));
            response.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
}

function formatZone(zone: string): string {
    const zoneMap: { [key: string]: string } = {
        'zone-hand': 'Hand',
        'zone-field': 'Field',
        'zone-deck': 'Deck',
        'zone-extra': 'Extra Deck',
        'zone-gy': 'Graveyard',
        'zone-banish': 'Banished',
        'zone-m1': 'Monster 1',
        'zone-m2': 'Monster 2',
        'zone-m3': 'Monster 3',
        'zone-m4': 'Monster 4',
        'zone-m5': 'Monster 5',
        'zone-s1': 'Spell/Trap 1',
        'zone-s2': 'Spell/Trap 2',
        'zone-s3': 'Spell/Trap 3',
        'zone-s4': 'Spell/Trap 4',
        'zone-s5': 'Spell/Trap 5',
        'zone-em-left': 'Extra Monster (L)',
        'zone-em-right': 'Extra Monster (R)',
    };
    return zoneMap[zone] || zone;
}

function getActionType(text: string): string {
    const actions = [
        'Normal Summon', 'Special Summon', 'Link Summon', 'Xyz Summon',
        'Synchro Summon', 'Fusion Summon', 'Contact Fusion',
        'Activate Effect', 'Move to', 'Draw', 'Equip', 'Detach Material'
    ];
    for (const action of actions) {
        if (text.startsWith(action)) return action.toUpperCase();
    }
    return 'ACTION';
}

function getCardNameFromStep(text: string): string {
    // Remove action prefix to get card name
    const prefixes = [
        'Normal Summon ', 'Special Summon ', 'Link Summon ', 'Xyz Summon ',
        'Contact Fusion ', 'Activate Effect ', 'Move to Hand ', 'Move to Graveyard ',
        'Move to Spell/Trap Zone ', 'Move to Banished ', 'Draw ', 'Equip ',
        'Detach Material to Graveyard ', 'Move ', 'Synchro Summon ', 'Fusion Summon '
    ];
    for (const prefix of prefixes) {
        if (text.startsWith(prefix)) {
            return text.substring(prefix.length);
        }
    }
    return text;
}

/**
 * Converts step text to more natural language.
 * "Move to Graveyard B-Buster Drake" -> "B-Buster Drake is sent to GY"
 */
function formatStepTextNatural(text: string, cardName: string): string {
    const textLower = text.toLowerCase();

    // Move to locations
    if (textLower.includes('move to graveyard') || textLower.includes('move to gy')) {
        return `${cardName} to GY`;
    }
    if (textLower.includes('move to banish')) {
        return `${cardName} is Banished`;
    }
    if (textLower.includes('move to hand')) {
        return `Add ${cardName}`;
    }
    if (textLower.includes('move to spell') || textLower.includes('move to s/t')) {
        return `Set ${cardName}`;
    }
    if (textLower.startsWith('move ') && !textLower.includes('move to')) {
        return `${cardName} moves`;
    }

    // Summons (keep as-is but cleaner)
    if (textLower.includes('link summon')) return `Link Summon ${cardName}`;
    if (textLower.includes('xyz summon')) return `Xyz Summon ${cardName}`;
    if (textLower.includes('synchro summon')) return `Synchro Summon ${cardName}`;
    if (textLower.includes('contact fusion')) return `Contact Fusion ${cardName}`;
    if (textLower.includes('fusion summon')) return `Fusion Summon ${cardName}`;
    if (textLower.includes('normal summon')) return `Normal Summon ${cardName}`;
    if (textLower.includes('special summon')) return `Special Summon ${cardName}`;

    // Effects
    if (textLower.includes('activate effect')) return `${cardName} effect`;
    if (textLower.includes('activate')) return `Activate ${cardName}`;

    // Equips
    if (textLower.includes('equip card')) return `Equip to target`;
    if (textLower.includes('equip')) return `Equip ${cardName}`;

    // Draw
    if (textLower.includes('draw')) return `Draw ${cardName}`;

    // Detach
    if (textLower.includes('detach')) return `Detach ${cardName}`;

    return cardName || text;
}

/**
 * Condenses granular replay steps into logical moves.
 * - Merge "Move to S/T" + "Equip" into single "Equip" step.
 * - Merge "Activate" + "Move to Hand" (search effect) into single step.
 * - Hide redundant self-moves (card goes to GY after activation).
 */
function condenseSteps(steps: ComboStep[]): ComboStep[] {
    const condensed: ComboStep[] = [];
    let i = 0;

    while (i < steps.length) {
        const current = steps[i];
        const next = steps[i + 1];
        const textLower = current.text.toLowerCase();

        // Pattern 1: Move + Equip (same card)
        // e.g., "Move to S/T B-Buster" followed by "Equip B-Buster to X-Y"
        if (next && textLower.includes('move') && next.text.toLowerCase().startsWith('equip')) {
            // Skip the Move, just use the Equip
            condensed.push(next);
            i += 2;
            continue;
        }

        // Pattern 2: Activate + Search (result is "Move to Hand")
        // e.g., "Activate Effect Union Hangar" followed by "Move to Hand Union Driver"
        if (next && (textLower.includes('activate effect') || textLower.includes('activate')) &&
            next.text.toLowerCase().includes('move to hand')) {
            const searchedCard = getCardNameFromStep(next.text);
            condensed.push({
                text: `${current.text}: Add ${searchedCard}`,
                card: current.card,
                to: 'zone-hand', // Result is adding to hand
            });
            i += 2;
            continue;
        }

        // Pattern 3: Activate + Self-Move to GY (cost/normal spell resolution)
        // e.g., "Activate Union Coloring" followed by "Move to GY Union Coloring"
        if (next && (textLower.includes('activate')) &&
            next.text.toLowerCase().includes('move to graveyard') &&
            current.card && next.card && getCardIdFromFullId(current.card) === getCardIdFromFullId(next.card)) {
            // Keep the Activate, skip the GY move (implied)
            condensed.push(current);
            i += 2;
            continue;
        }

        // Pattern 4: Hide intermediate "Move to" steps that are just zone relocation 
        // (not adding to hand, not summon related)
        // Skip "Move to Spell/Trap Zone" if a summon or equip follows
        if (textLower.includes('move to spell') && next &&
            (next.text.toLowerCase().includes('equip') || next.text.toLowerCase().includes('activate'))) {
            i++; // Skip this move, merge with next action
            continue;
        }

        // Default: keep step as is
        condensed.push(current);
        i++;
    }

    return condensed;
}

export async function generatePDF(comboData: ComboData): Promise<Buffer> {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: true,
    });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    const combo = comboData.combos?.combo1;
    const cards = combo?.cards || [];
    const rawSteps = combo?.steps || [];

    // Condense steps for better readability
    const steps = condenseSteps(rawSteps);
    console.log(`Condensed ${rawSteps.length} steps to ${steps.length}`);

    // Build card lookup map
    const cardMap = new Map<string, CardInfo>();
    cards.forEach((card) => {
        cardMap.set(card.id, card);
    });

    // Fetch card images for all unique card IDs
    const imageCache = new Map<string, Buffer>();
    const uniqueCardIds = Array.from(new Set(cards.map(c => getCardIdFromFullId(c.id))));

    console.log('Fetching card images...');
    for (const cardId of uniqueCardIds) {
        if (cardId) {
            const imageUrl = `https://storage.googleapis.com/yugioh-card-images-archetype-nexus/cards/${cardId}.png`;
            const buffer = await fetchImageBuffer(imageUrl);
            if (buffer) {
                imageCache.set(cardId, buffer);
            }
        }
    }
    console.log(`Fetched ${imageCache.size} card images`);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;

    // --- HEADER ---
    const headerHeight = 80;
    doc.rect(0, 0, pageWidth, headerHeight).fill(COLORS.primary);
    doc.fillColor(COLORS.white)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('COMBO GUIDE', 0, 25, { align: 'center' });

    if (comboData.archetype) {
        doc.fontSize(12)
            .font('Helvetica')
            .text(comboData.archetype, 0, 52, { align: 'center' });
    }

    doc.y = headerHeight + 15;

    // --- CREATOR CREDIT BANNER ---
    if (comboData.playerName) {
        const creditY = doc.y;
        const bannerHeight = 45;
        
        // Gold/amber accent banner
        doc.rect(50, creditY, contentWidth, bannerHeight)
            .fill('#fef3c7');
        
        // Left accent bar
        doc.rect(50, creditY, 5, bannerHeight)
            .fill('#f59e0b');
        
        // Trophy/star icon area
        doc.fontSize(18)
            .fillColor('#f59e0b')
            .text('★', 65, creditY + 13);
        
        // "Created by" label
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#92400e')
            .text('COMBO CREATED BY', 90, creditY + 10);
        
        // Player name - large and bold
        doc.fontSize(16)
            .font('Helvetica-Bold')
            .fillColor('#78350f')
            .text(comboData.playerName, 90, creditY + 23);
        
        doc.y = creditY + bannerHeight + 15;
    }

    // --- CARDS SECTION (only show cards with loaded images) ---
    const cardsWithImages = cards.filter(card => {
        const numericId = getCardIdFromFullId(card.id);
        return imageCache.has(numericId);
    });

    // Remove duplicates by base ID for display
    const seenBaseIds = new Set<string>();
    const uniqueDisplayCards = cardsWithImages.filter(card => {
        const baseId = getCardIdFromFullId(card.id);
        if (seenBaseIds.has(baseId)) return false;
        seenBaseIds.add(baseId);
        return true;
    });

    if (uniqueDisplayCards.length > 0) {
        doc.fillColor(COLORS.primary)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('CARDS USED', 50, doc.y);
        doc.moveDown(0.5);

        // Group cards by category
        // Detect Extra Deck cards by checking summon actions in steps
        const extraDeckCardIds = new Set<string>();
        steps.forEach(step => {
            const text = step.text.toLowerCase();
            if ((text.includes('link summon') || text.includes('xyz summon') ||
                text.includes('fusion summon') || text.includes('synchro summon')) && step.card) {
                extraDeckCardIds.add(getCardIdFromFullId(step.card));
            }
        });

        // Helper to check if card is Extra Deck
        const isExtraDeck = (c: CardInfo) => {
            const name = c.name.toLowerCase();
            const id = getCardIdFromFullId(c.id);
            // Check if card type is 'extra'
            if (c.type === 'extra') return true;
            // Check if it was summoned from Extra Deck actions
            if (extraDeckCardIds.has(id)) return true;
            // Fallback to name keywords for Extra Deck monsters
            return ['fusion', 'synchro', 'xyz', 'link'].some(t => name.includes(t)) ||
                name.includes('dragon buster') || name.includes('dragon cannon') ||
                name.includes('infinity') || name.includes('nova') ||
                name.includes('gadget') || name.includes('rabbit') ||
                name.includes('controller') || name.includes('fairy dragon');
        };

        const categories = {
            'Main Deck Monsters': uniqueDisplayCards.filter(c => c.type === 'monster' && !isExtraDeck(c)),
            'Spells & Traps': uniqueDisplayCards.filter(c => c.type === 'spell' || c.type === 'trap'),
            'Extra Deck': uniqueDisplayCards.filter(c => isExtraDeck(c))
        };

        const drawCardGrid = (title: string, cards: CardInfo[]) => {
            if (cards.length === 0) return;

            // Check page space
            if (doc.y > doc.page.height - 150) doc.addPage();

            doc.fillColor(COLORS.text)
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(title, 50, doc.y);
            doc.moveDown(0.5);

            const cardWidth = 70;
            const cardHeight = 102;
            const cardsPerRow = 6;
            const cardSpacingX = (contentWidth - (cardsPerRow * cardWidth)) / (cardsPerRow - 1);
            const cardSpacingY = 20;

            let cardX = 50;
            let cardY = doc.y;

            cards.forEach((card, idx) => {
                if (idx > 0 && idx % cardsPerRow === 0) {
                    cardX = 50;
                    cardY += cardHeight + cardSpacingY + 15;
                }

                // Check page break within grid
                if (cardY + cardHeight > doc.page.height - 50) {
                    doc.addPage();
                    cardY = 50;
                    cardX = 50;
                }

                const numericId = getCardIdFromFullId(card.id);
                const imgBuffer = imageCache.get(numericId);

                if (imgBuffer) {
                    try {
                        doc.image(imgBuffer, cardX, cardY, { width: cardWidth, height: cardHeight });
                        doc.rect(cardX, cardY, cardWidth, cardHeight).stroke(COLORS.border);
                    } catch {
                        doc.rect(cardX, cardY, cardWidth, cardHeight).fill(COLORS.cardBg);
                    }
                } else {
                    doc.rect(cardX, cardY, cardWidth, cardHeight).fill(COLORS.cardBg);
                }

                doc.fillColor(COLORS.text)
                    .fontSize(7)
                    .font('Helvetica')
                    .text(card.name, cardX, cardY + cardHeight + 4, {
                        width: cardWidth,
                        align: 'center',
                        lineBreak: true,
                        height: 20,
                        ellipsis: true
                    });

                cardX += cardWidth + cardSpacingX;
            });

            doc.y = cardY + cardHeight + 30;
        };

        drawCardGrid('Main Deck Monsters', categories['Main Deck Monsters']);
        drawCardGrid('Spells & Traps', categories['Spells & Traps']);
        drawCardGrid('Extra Deck', categories['Extra Deck']);
    }

    // --- COMBO INFO ---
    if (combo?.title && combo.title !== 'Imported Combo') {
        doc.fillColor(COLORS.text)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(combo.title, 50);
        doc.moveDown(0.3);
    }
    if (combo?.description && combo.description !== 'Automatically distilled from replay file.') {
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor(COLORS.lightText)
            .text(combo.description, 50);
        doc.moveDown(0.8);
    }

    // --- COMBO FLOW (Phase-Based) ---
    // Smart Page Break: If near bottom, start on new page
    if (doc.y > doc.page.height - 200) {
        doc.addPage();
        doc.y = 40;
    } else {
        doc.moveDown(1);
    }

    // Structure steps into phases
    const structured = structureComboPhases(steps);
    console.log(`Structured combo into ${structured.phases.length} phases`);

    doc.fillColor(COLORS.primary)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('COMBO FLOW', 50, doc.y);
    doc.moveDown(0.5);

    const stepHeight = 26;

    // Helper to draw zone icons
    const drawZoneIcon = (zone: string, x: number, y: number) => {
        doc.save();
        doc.translate(x, y);
        doc.strokeColor(COLORS.lightText).lineWidth(1);
        if (zone.includes('hand')) {
            doc.path('M1,8 L3,2 L5,8 M5,8 L7,2 L9,8').stroke();
        } else if (zone.includes('gy')) {
            doc.path('M2,9 L2,3 Q5,0 8,3 L8,9 Z').stroke();
        } else if (zone.includes('banish')) {
            doc.rect(1, 1, 8, 8).stroke();
            doc.moveTo(3, 3).lineTo(7, 7).stroke();
        } else {
            doc.moveTo(5, 1).lineTo(9, 5).lineTo(5, 9).lineTo(1, 5).closePath().stroke();
        }
        doc.restore();
    };

    let globalStepNum = 0;

    // Render each phase
    structured.phases.forEach((phase, phaseIdx) => {
        // Page break check for phase header
        if (doc.y > doc.page.height - 120) {
            doc.addPage();
            doc.y = 40;
        }

        // Phase Header
        doc.fillColor(COLORS.primary)
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(phase.title, 50, doc.y);

        // Phase Goal
        doc.fillColor(COLORS.lightText)
            .fontSize(9)
            .font('Helvetica-Oblique')
            .text(`Goal: ${phase.goal}`, 50, doc.y);

        doc.moveDown(0.3);

        // Draw phase header line
        doc.moveTo(50, doc.y).lineTo(50 + contentWidth, doc.y).strokeColor(COLORS.accent).lineWidth(1).stroke();
        doc.y += 8;

        // Render steps in this phase
        phase.steps.forEach((step, stepIdx) => {
            globalStepNum++;

            const textLower = step.text.toLowerCase();
            const isEDSummon = textLower.includes('link summon') ||
                textLower.includes('xyz summon') ||
                textLower.includes('synchro summon') ||
                textLower.includes('fusion summon') ||
                textLower.includes('contact fusion');

            // Collect materials from step.actions (cards going to GY are materials)
            const materials: string[] = [];
            if (isEDSummon && step.actions && Array.isArray(step.actions)) {
                for (const action of step.actions) {
                    const actionTo = action.to?.toLowerCase() || '';
                    // Materials go to GY or Banish
                    if (actionTo.includes('zone-gy') || actionTo.includes('zone-banish')) {
                        // Look up card name from cardMap using action.card
                        const cardId = action.card;
                        if (cardId) {
                            const cardInfo = cardMap.get(cardId);
                            const materialName = cardInfo?.name || cardId.replace('card_', '');
                            if (materialName && !materials.includes(materialName)) {
                                materials.push(materialName);
                            }
                        }
                    }
                }
            }

            // Fallback: If no materials found in actions, look at previous steps 
            // (for Contact Fusion where materials are banished in separate steps)
            if (isEDSummon && materials.length === 0) {
                for (let i = globalStepNum - 2; i >= 0 && i >= globalStepNum - 6; i--) {
                    const prevStep = steps[i];
                    if (!prevStep) continue;
                    const prevTo = prevStep.to?.toLowerCase() || '';
                    const prevText = prevStep.text.toLowerCase();

                    // Stop if we hit another summon or activation
                    if (prevText.includes('summon') || prevText.includes('activate')) break;

                    // Material indicators: cards going to GY or Banish
                    if (prevTo.includes('zone-gy') || prevTo.includes('zone-banish')) {
                        const materialName = getCardNameFromStep(prevStep.text);
                        if (materialName && !materials.includes(materialName)) {
                            materials.unshift(materialName);
                        }
                    }
                }
            }

            // Check for page break (more space needed if we have materials)
            const extraHeight = materials.length * 14;
            if (doc.y > doc.page.height - 60 - extraHeight) {
                doc.addPage();
                doc.y = 40;
            }

            const yPos = doc.y;

            // Alternating background (account for materials)
            if (stepIdx % 2 === 1) {
                doc.rect(50, yPos, contentWidth, stepHeight + extraHeight).fill(COLORS.cardBg);
            }

            // Step number
            doc.fillColor(COLORS.accent)
                .fontSize(9)
                .font('Helvetica-Bold')
                .text(String(globalStepNum).padStart(2, '0'), 52, yPos + 6, { width: 18, lineBreak: false });

            // Action badge with colors
            const actionType = getActionType(step.text);
            const badgeWidth = actionType.length * 4.5 + 6;

            let badgeColor = COLORS.primary;
            let textColor = COLORS.white;
            if (actionType.includes('FUSION')) { badgeColor = COLORS.fusion; }
            else if (actionType.includes('LINK')) { badgeColor = COLORS.link; }
            else if (actionType.includes('SYNCHRO')) { badgeColor = COLORS.synchro; textColor = COLORS.text; }
            else if (actionType.includes('XYZ')) { badgeColor = COLORS.xyz; }

            doc.roundedRect(72, yPos + 4, badgeWidth, 12, 2).fill(badgeColor);
            doc.fillColor(textColor)
                .fontSize(6)
                .font('Helvetica-Bold')
                .text(actionType, 75, yPos + 7, { lineBreak: false });

            // Card name / Step description (natural language)
            const cardName = getCardNameFromStep(step.text);
            const displayText = formatStepTextNatural(step.text, cardName);
            doc.fillColor(COLORS.text)
                .fontSize(9)
                .font('Helvetica-Bold')
                .text(displayText, 78 + badgeWidth, yPos + 6, { lineBreak: false });

            // Zone indicator
            if (step.to) {
                const zoneName = formatZone(step.to);
                drawZoneIcon(step.to, 50 + contentWidth - 12, yPos + 6);
                doc.fillColor(COLORS.lightText)
                    .fontSize(8)
                    .font('Helvetica')
                    .text(zoneName, 50 + contentWidth - 90, yPos + 6, { width: 75, align: 'right', lineBreak: false });
            }

            // Render materials as sub-steps (indented)
            let matY = yPos + stepHeight - 4;
            if (materials.length > 0) {
                materials.forEach((mat) => {
                    doc.fillColor(COLORS.lightText)
                        .fontSize(7)
                        .font('Helvetica-Oblique')
                        .text(`    - ${mat}`, 85, matY, { lineBreak: false });
                    matY += 12;
                });
            }

            doc.y = yPos + stepHeight + extraHeight;
        });

        doc.moveDown(0.5);
    });

    // --- FINAL BOARD STATE ---
    if (structured.finalBoard.length > 0) {
        // Ensure enough space for the final board section
        if (doc.y > doc.page.height - 250) {
            doc.addPage();
            doc.y = 40;
        }

        // Section header with accent bar
        const sectionY = doc.y;
        doc.rect(50, sectionY, contentWidth, 35).fill('#ecfdf5');
        doc.rect(50, sectionY, 5, 35).fill('#10b981');
        
        doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#065f46')
            .text('FINAL BOARD', 65, sectionY + 10);
        
        doc.fontSize(9)
            .font('Helvetica')
            .fillColor('#047857')
            .text('End result of the combo', 65, sectionY + 26);
        
        doc.y = sectionY + 50;

        // Get unique cards for final board
        const finalBoardCards: CardInfo[] = [];
        const seenFinalIds = new Set<string>();
        
        structured.finalBoard.forEach(cardIdOrName => {
            if (cardIdOrName.startsWith('card_')) {
                const cardInfo = cardMap.get(cardIdOrName);
                const baseId = getCardIdFromFullId(cardIdOrName);
                if (cardInfo && !seenFinalIds.has(baseId)) {
                    seenFinalIds.add(baseId);
                    finalBoardCards.push(cardInfo);
                }
            }
        });

        if (finalBoardCards.length > 0) {
            // Card grid for final board
            const cardWidth = 80;
            const cardHeight = 117;
            const cardsPerRow = 5;
            const totalGridWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * 15;
            const startX = 50 + (contentWidth - totalGridWidth) / 2; // Center the grid
            const cardSpacingX = 15;
            const cardSpacingY = 25;

            let cardX = startX;
            let cardY = doc.y;

            finalBoardCards.forEach((card, idx) => {
                if (idx > 0 && idx % cardsPerRow === 0) {
                    cardX = startX;
                    cardY += cardHeight + cardSpacingY + 20;
                }

                // Check page break
                if (cardY + cardHeight + 30 > doc.page.height - 50) {
                    doc.addPage();
                    cardY = 50;
                    cardX = startX;
                }

                const numericId = getCardIdFromFullId(card.id);
                const imgBuffer = imageCache.get(numericId);

                // Card shadow effect
                doc.rect(cardX + 3, cardY + 3, cardWidth, cardHeight)
                    .fill('#e5e7eb');

                if (imgBuffer) {
                    try {
                        doc.image(imgBuffer, cardX, cardY, { width: cardWidth, height: cardHeight });
                        // Green border for final board cards
                        doc.lineWidth(2)
                            .rect(cardX, cardY, cardWidth, cardHeight)
                            .stroke('#10b981');
                        doc.lineWidth(1);
                    } catch {
                        doc.rect(cardX, cardY, cardWidth, cardHeight).fill(COLORS.cardBg);
                        doc.rect(cardX, cardY, cardWidth, cardHeight).stroke('#10b981');
                    }
                } else {
                    doc.rect(cardX, cardY, cardWidth, cardHeight).fill(COLORS.cardBg);
                    doc.rect(cardX, cardY, cardWidth, cardHeight).stroke('#10b981');
                }

                // Card name below with background
                const nameY = cardY + cardHeight + 4;
                doc.rect(cardX - 2, nameY - 2, cardWidth + 4, 18)
                    .fill('#f0fdf4');
                
                doc.fillColor('#065f46')
                    .fontSize(7)
                    .font('Helvetica-Bold')
                    .text(card.name, cardX, nameY, {
                        width: cardWidth,
                        align: 'center',
                        lineBreak: true,
                        height: 16,
                        ellipsis: true
                    });

                cardX += cardWidth + cardSpacingX;
            });

            doc.y = cardY + cardHeight + 40;
        } else {
            // Fallback to text list if no card images found
            structured.finalBoard.forEach(cardIdOrName => {
                let displayName = cardIdOrName;
                if (cardIdOrName.startsWith('card_')) {
                    const cardInfo = cardMap.get(cardIdOrName);
                    displayName = cardInfo?.name || cardIdOrName.replace('card_', '');
                }
                doc.fillColor(COLORS.text)
                    .fontSize(9)
                    .font('Helvetica')
                    .text(`• ${displayName}`, 55);
            });
            doc.moveDown(0.5);
        }
    }

    // --- FOOTER with page numbers ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Save and disable margins to write in footer area without triggering new page
        const oldMargins = doc.page.margins;
        doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

        doc.fontSize(8)
            .fillColor(COLORS.lightText)
            .text(
                `Page ${i + 1} of ${range.count}`,
                50,
                doc.page.height - 30,
                { align: 'center', width: contentWidth, lineBreak: false }
            );

        // Restore margins
        doc.page.margins = oldMargins;
    }

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers as any);
            resolve(pdfData);
        });
        doc.on('error', reject);
    });
}
