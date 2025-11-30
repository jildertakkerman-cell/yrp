/**
 * ComboLoader - Utility for loading and initializing combo visualizer data
 * * This utility provides methods to:
 * - Load combo data from JSON files
 * - Initialize DuelSimulator instances with the loaded data
 * - Handle lazy-loading of combo simulators
 */
class ComboLoader {
    /**
     * Load combo data from a JSON file
     * @param {string} archetypeName - Name of the archetype (e.g., 'yummy', 'blue-eyes')
     * @returns {Promise<Object>} The loaded combo data
     */
    static async loadCombos(archetypeName) {
        try {
            const response = await fetch(`../assets/data/combos/${archetypeName.toLowerCase()}-combos.json`);
            if (!response.ok) {
                throw new Error(`Failed to load combos for ${archetypeName}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error loading combo data for ${archetypeName}:`, error);
            throw error;
        }
    }

    /**
     * Initialize a single DuelSimulator instance
     * @param {string} elementId - ID of the element to attach the simulator to
     * @param {Object} comboData - Combo configuration data
     * @returns {DuelSimulator} The initialized simulator instance
     */
    static initializeSimulator(elementId, comboData) {
        return new DuelSimulator(elementId, comboData);
    }

    /**
     * Load combo data and initialize all simulators
     * This is the main convenience method for initializing all combos at once
     * @param {string} archetypeName - Name of the archetype
     * @param {Object} comboMap - Map of combo IDs to element IDs { comboId: elementId }
     * @returns {Promise<Object>} Map of combo IDs to simulator instances
     */
    static async loadAndInitializeAll(archetypeName, comboMap) {
        const data = await this.loadCombos(archetypeName);
        const simulators = {};

        for (const [comboId, elementId] of Object.entries(comboMap)) {
            if (data.combos[comboId]) {
                simulators[comboId] = this.initializeSimulator(elementId, {
                    [comboId]: data.combos[comboId]
                });
            } else {
                console.warn(`Combo ${comboId} not found in loaded data`);
            }
        }

        return simulators;
    }

    /**
     * Create lazy-loading wrapper functions for combo simulators
     * @param {Object} comboData - The loaded combo data object
     * @param {number} comboNum - The combo number (1-6)
     * @param {string} elementId - ID of the element to attach simulator to
     * @returns {Function} A function that initializes the combo when called
     */
    static createLazyInitializer(comboData, comboNum, elementId) {
        return function () {
            const comboId = `combo${comboNum}`;
            if (comboData.combos[comboId]) {
                return ComboLoader.initializeSimulator(elementId, {
                    [comboId]: comboData.combos[comboId]
                });
            } else {
                console.error(`Combo ${comboId} not found in data`);
                return null;
            }
        };
    }

    /**
     * Render the complete combo system with a single function call
     * This is the main entry point for loading combos onto a page
     * @param {string} containerId - ID of the container element (will create sub-containers inside)
     * @param {string} archetypeName - Name of the archetype (e.g., 'Blue-Eyes', 'Yummy')
     * @param {Object} options - Optional configuration
     * @param {string} options.selectorContainerId - Custom ID for selector container (default: 'combo-selector-container')
     * @param {string} options.guideContainerId - Custom ID for guide container (default: 'combo-guide-container')
     * @param {Object} options.selectorOptions - Options to pass to ComboSelector.render
     * @returns {Promise<Object>} Object containing loaded data and initialized simulators
     */
    static async renderComboSystem(containerId, archetypeName, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[ComboLoader] Container not found: ${containerId}`);
            return null;
        }

        const {
            selectorContainerId = 'combo-selector-container',
            guideContainerId = 'combo-guide-container',
            selectorOptions = {}
        } = options;

        // 1. Setup container structure
        container.innerHTML = `
            <div id="${selectorContainerId}"></div>
            <div id="${guideContainerId}"></div>
        `;

        try {
            // 2. Load combo data
            const comboData = await this.loadCombos(archetypeName);

            if (!comboData || !comboData.combos) {
                console.error(`[ComboLoader] No combo data found for ${archetypeName}`);
                return null;
            }

            // 3. Define the showCombo callback for switching between combos
            const showCombo = (comboKey) => {
                const combos = comboData.combos || {};
                Object.keys(combos).forEach(key => {
                    const normalizedKey = key.replace('combo', '');
                    const contentDiv = document.getElementById(`combo-${normalizedKey}-content`);
                    if (contentDiv) {
                        contentDiv.classList.add('hidden');
                    }
                });

                const selectedContent = document.getElementById(`combo-${comboKey}-content`);
                if (selectedContent) {
                    selectedContent.classList.remove('hidden');
                }
            };

            // 4. Render combo selector
            ComboSelector.render(selectorContainerId, comboData, showCombo, selectorOptions);

            // 5. Render combo guide (includes simulators)
            ComboGuide.render(guideContainerId, comboData);

            // 6. Initialize all DuelSimulator instances
            const simulators = {};
            Object.keys(comboData.combos).forEach(key => {
                const normalizedKey = key.replace('combo', '');
                const simElementId = `duel-simulator-${key}`;
                simulators[key] = new DuelSimulator(simElementId, { [normalizedKey]: comboData.combos[key] });
            });

            console.log(`[ComboLoader] Successfully loaded combo system for ${archetypeName}`);

            return {
                data: comboData,
                simulators: simulators,
                showCombo: showCombo
            };

        } catch (error) {
            console.error(`[ComboLoader] Failed to render combo system for ${archetypeName}:`, error);
            container.innerHTML = `
                <div class="p-6 text-center text-red-400">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p>Failed to load combo system for ${archetypeName}</p>
                    <p class="text-sm mt-2 opacity-75">${error.message}</p>
                </div>
            `;
            return null;
        }
    }
}

/**
 * ComboSelector - Modular Combo Dropdown Generator
 * Automatically creates a themed combo selector from combo data
 */
class ComboSelector {
    static render(containerId, comboData, onChangeCallback, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const {
            labelText = 'Select a Combo',
            labelIcon = 'fas fa-layer-group',
            selectorId = 'combo-selector',
            defaultCombo = '1'
        } = options;

        const combos = comboData.combos || {};
        const comboNumbers = Object.keys(combos).map(key => key.replace('combo', ''));

        // Infer theme to get colors
        const theme = ComboSelector.inferTheme();
        console.log('[ComboSelector] Using theme:', theme);

        // Create a cleaner, more integrated selector
        container.innerHTML = `
            <div style="max-width: 32rem; margin: 0 auto 2rem auto;">
                <label for="${selectorId}" style="display: block; text-align: center; color: ${theme.accentColor}; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">
                    <i class="${labelIcon}" style="margin-right: 0.5rem;"></i>${labelText}
                </label>
                <div style="position: relative;">
                    <select id="${selectorId}" 
                        style="
                            appearance: none;
                            width: 100%;
                            padding: 1rem 3rem 1rem 1.25rem;
                            background-color: ${theme.cardBg};
                            border: 2px solid ${theme.accentColor};
                            border-radius: 0.5rem;
                            color: ${theme.textColor};
                            font-weight: 700;
                            font-size: 1.125rem;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                        "
                        onmouseover="this.style.backgroundColor='${theme.backgroundColor}'; this.style.boxShadow='0 0 15px ${theme.accentColor}40';"
                        onmouseout="this.style.backgroundColor='${theme.cardBg}'; this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.3)';"
                        onfocus="this.style.outline='none'; this.style.borderColor='${theme.accentColor}'; this.style.boxShadow='0 0 0 3px ${theme.accentColor}40';"
                        onblur="this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.3)';">
                        ${comboNumbers.map(num => {
            const combo = combos[`combo${num}`];
            return `<option value="${num}" ${num === defaultCombo ? 'selected' : ''}>${combo.title || `Combo #${num}`}</option>`;
        }).join('')}
                    </select>
                    <div style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: ${theme.accentColor};">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>
            </div>
        `;

        const selector = document.getElementById(selectorId);
        if (selector && onChangeCallback) {
            selector.addEventListener('change', (e) => onChangeCallback(e.target.value));
            onChangeCallback(defaultCombo);
        }
        return selector;
    }

    static setTheme(theme) {
        const root = document.documentElement;

        console.log('[ComboSelector] Applying theme:', theme);

        // Set accent/primary colors
        if (theme.accentColor) {
            root.style.setProperty('--combo-accent', theme.accentColor);
            root.style.setProperty('--combo-selector-focus-border', theme.accentColor);
            root.style.setProperty('--primary-color', theme.accentColor);
            root.style.setProperty('--combo-selector-border', theme.accentColor);
            root.style.setProperty('--combo-selector-label-color', theme.accentColor);

            // Set arrow color (needs to be URL-encoded for SVG)
            const arrowColor = theme.accentColor.replace('#', '%23');
            root.style.setProperty('--combo-selector-arrow-color', arrowColor);

            // Create focus ring color with opacity
            const accentRgb = theme.accentColor.match(/\d+/g);
            if (accentRgb && accentRgb.length >= 3) {
                root.style.setProperty('--combo-selector-focus-ring', `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.5)`);
            } else if (theme.accentColor.startsWith('#')) {
                // Convert hex to rgba
                const hex = theme.accentColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                root.style.setProperty('--combo-selector-focus-ring', `rgba(${r}, ${g}, ${b}, 0.5)`);
            }
        }

        // Set background colors
        if (theme.backgroundColor) {
            root.style.setProperty('--combo-selector-bg', theme.backgroundColor);
        }

        // Set text color
        if (theme.textColor) {
            root.style.setProperty('--combo-selector-text', theme.textColor);
            root.style.setProperty('--combo-selector-option-text', theme.textColor);
        }

        // Set hover background (slightly more opaque than base)
        if (theme.backgroundColor) {
            const bgMatch = theme.backgroundColor.match(/rgba?\(([^)]+)\)/);
            if (bgMatch) {
                const parts = bgMatch[1].split(',').map(p => p.trim());
                if (parts.length === 4) {
                    // Increase opacity for hover
                    const newOpacity = Math.min(parseFloat(parts[3]) + 0.2, 1);
                    root.style.setProperty('--combo-selector-hover-bg', `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${newOpacity})`);
                }
            }
        }

        // Set option background
        if (theme.cardBg) {
            root.style.setProperty('--combo-selector-option-bg', theme.cardBg);
        }

        // Set gradient colors for options
        if (theme.secondaryColor && theme.accentColor) {
            root.style.setProperty('--combo-selector-option-gradient-start', theme.secondaryColor);
            root.style.setProperty('--combo-selector-option-gradient-end', theme.accentColor);
        } else if (theme.accentColor) {
            root.style.setProperty('--combo-selector-option-gradient-start', theme.accentColor);
            root.style.setProperty('--combo-selector-option-gradient-end', theme.accentColor);
        }

        console.log('[ComboSelector] Theme applied successfully');
    }

    static inferTheme() {
        const getStyle = (el, prop) => window.getComputedStyle(el).getPropertyValue(prop);
        const bodyBg = getStyle(document.body, 'background-color');
        const root = document.documentElement;

        console.log('[ComboSelector] Inferring theme... Page title:', document.title);
        console.log('[ComboSelector] Body background:', bodyBg);

        // 1. Explicit Archetype Detection

        // A-to-Z Theme (Golden Yellow)
        if (document.title.toLowerCase().includes('a-to-z') || bodyBg.includes('10, 14, 26')) {
            console.log('[ComboSelector] Detected A-to-Z theme');
            return {
                accentColor: '#facc15', // Golden Yellow
                secondaryColor: '#fbbf24', // Amber-400
                isDarkMode: true,
                backgroundColor: 'rgba(22, 30, 45, 0.95)', // Dark Blue-Gray
                cardBg: 'rgba(32, 42, 58, 0.8)',
                textColor: '#d1d5db'
            };
        }

        // Kewl Tune Theme (Neon Pink/Cyan)
        if (document.title.toLowerCase().includes('kewl tune') || bodyBg.includes('kewl')) {
            return {
                accentColor: '#ff00ff', // Neon Pink
                secondaryColor: '#00ffff', // Neon Cyan
                isDarkMode: true,
                backgroundColor: 'rgba(20, 20, 30, 0.8)', // Dark background
                cardBg: 'rgba(0, 0, 0, 0.5)',
                textColor: '#ffffff'
            };
        }

        // Yummy Theme (Purple/Pink)
        if (bodyBg.includes('26, 17, 42') || bodyBg.includes('#1a112a') ||
            getStyle(document.body, 'border-color').includes('236, 72, 153') || // Pink-500
            document.querySelector('.text-pink-500') ||
            document.title.toLowerCase().includes('yummy')) {
            return {
                accentColor: '#ec4899', // Pink-500
                secondaryColor: '#a855f7', // Purple-500
                isDarkMode: true,
                backgroundColor: 'rgba(88, 28, 135, 0.5)', // Deep Purple
                cardBg: 'rgba(26, 17, 42, 0.8)',
                textColor: '#fdf2f8'
            };
        }

        // Blue-Eyes Theme (Cyan/Blue)
        if (document.title.toLowerCase().includes('blue-eyes') || bodyBg.includes('12, 21, 36')) {
            return {
                accentColor: '#38bdf8', // Sky-400
                isDarkMode: true,
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                cardBg: '#1e293b',
                textColor: '#f0f9ff'
            };
        }

        // Mermail Theme (Cyan/Blue)
        if (document.title.toLowerCase().includes('mermail') || bodyBg.includes('3, 12, 20')) {
            return {
                accentColor: '#38bdf8', // Sky-400
                secondaryColor: '#0ea5e9', // Sky-500
                isDarkMode: true,
                backgroundColor: 'rgba(11, 26, 42, 0.95)',
                cardBg: 'rgba(11, 26, 42, 0.95)',
                textColor: '#e0f2fe'
            };
        }

        // 2. Enhanced Generic Scanner (Fallback)
        // First check CSS variables
        let accentColor = getComputedStyle(root).getPropertyValue('--accent-color') ||
            getComputedStyle(root).getPropertyValue('--primary-color');

        // Check for .text-accent class elements
        if (!accentColor || !accentColor.trim()) {
            const accentElements = document.querySelectorAll('.text-accent, strong.text-accent');
            for (const el of accentElements) {
                const color = getStyle(el, 'color');
                if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgb(255, 255, 255)') {
                    accentColor = color;
                    break;
                }
            }
        }

        // Check headers for colorful text
        if (!accentColor || !accentColor.trim()) {
            const headers = document.querySelectorAll('h1, h2, h3, h4');
            for (const h of headers) {
                const color = getStyle(h, 'color');
                const rgb = color.match(/\d+/g);
                // Look for non-grayscale colors (where RGB values differ significantly)
                if (rgb && (Math.abs(rgb[0] - rgb[1]) > 30 || Math.abs(rgb[1] - rgb[2]) > 30 || Math.abs(rgb[0] - rgb[2]) > 30)) {
                    accentColor = color;
                    break;
                }
            }
        }

        // Check .card elements for border colors
        if (!accentColor || !accentColor.trim()) {
            const cards = document.querySelectorAll('.card, .card-panel');
            for (const card of cards) {
                const borderColor = getStyle(card, 'border-left-color') || getStyle(card, 'border-color');
                const rgb = borderColor.match(/\d+/g);
                if (rgb && (Math.abs(rgb[0] - rgb[1]) > 30 || Math.abs(rgb[1] - rgb[2]) > 30)) {
                    accentColor = borderColor;
                    break;
                }
            }
        }

        if (!accentColor || !accentColor.trim()) accentColor = '#60a5fa'; // Blue-400 fallback

        const rgb = bodyBg.match(/\d+/g);
        const isDarkMode = rgb ? (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114) < 128 : true;

        // Detect card background color from existing .card elements
        let cardBg = isDarkMode ? 'rgba(0, 0, 0, 0.2)' : '#ffffff';
        const existingCard = document.querySelector('.card, .card-panel');
        if (existingCard) {
            const cardBgColor = getStyle(existingCard, 'background-color');
            if (cardBgColor && cardBgColor !== 'rgba(0, 0, 0, 0)') {
                cardBg = cardBgColor;
            }
        }

        return {
            accentColor: accentColor.trim(),
            isDarkMode: isDarkMode,
            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            cardBg: cardBg,
            textColor: isDarkMode ? '#f3f4f6' : '#1f2937'
        };
    }
}

/**
 * ComboGuide Module
 * Dynamically renders combo guides using the inferred page theme.
 * Uses CardLoader to handle image fetching and popups.
 */
class ComboGuide {
    static render(containerId, comboData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 1. Get Smart Theme
        const theme = ComboSelector.inferTheme();
        const accent = theme.accentColor;
        const textMain = theme.textColor;

        // 2. Clear & Setup
        container.innerHTML = '';
        const combos = comboData.combos || {};
        const imageMap = {};

        Object.keys(combos).forEach((key, comboIndex) => {
            const combo = combos[key];
            const normalizedKey = key.replace('combo', '');

            const comboSection = document.createElement('div');
            comboSection.id = `combo-${normalizedKey}-content`;
            comboSection.className = 'combo-content hidden animate-fadeIn flex flex-col gap-6';
            if (comboIndex === 0) comboSection.classList.remove('hidden');

            const cardNameMap = {};
            if (combo.cards) combo.cards.forEach(c => cardNameMap[c.id] = c.name);

            // ---------------------------------------------
            // PART 1: SIMULATOR (First)
            // ---------------------------------------------
            const simDiv = document.createElement('div');
            simDiv.id = `duel-simulator-${key}`;
            simDiv.className = 'w-full mb-2';
            comboSection.appendChild(simDiv);

            // ---------------------------------------------
            // PART 2: COLLAPSIBLE TEXT GUIDE (Second)
            // ---------------------------------------------
            const guideContainer = document.createElement('div');
            guideContainer.className = 'rounded-2xl border shadow-lg overflow-hidden backdrop-blur-sm';
            guideContainer.style.backgroundColor = theme.backgroundColor;
            guideContainer.style.borderColor = `${accent}60`;

            // --- HEADER / TOGGLE BAR ---
            const header = document.createElement('div');
            header.className = 'p-4 md:p-5 border-b cursor-pointer transition-colors duration-200 flex items-center justify-between group hover:bg-white/5';
            header.style.borderColor = `${accent}30`;
            header.onclick = () => {
                const content = document.getElementById(`guide-steps-${key}`);
                const icon = document.getElementById(`guide-icon-${key}`);
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    content.classList.add('hidden');
                    icon.style.transform = 'rotate(0deg)';
                }
            };

            header.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="p-2.5 rounded-lg shadow-inner flex-shrink-0" style="background: ${accent}26;">
                        <i class="fas fa-book-open text-xl" style="color: ${accent}"></i>
                    </div>
                    <div>
                        <h3 class="text-lg md:text-xl font-bold leading-none" style="color: ${textMain}">
                            ${combo.title}
                        </h3>
                        <p class="text-xs md:text-sm mt-1 font-bold tracking-wide uppercase opacity-90" style="color: ${accent}">
                            <i class="fas fa-info-circle mr-1"></i> Beginner Guide Available
                        </p>
                    </div>
                </div>
                <div class="text-2xl opacity-60 transition-transform duration-300" id="guide-icon-${key}" style="color: ${textMain}">
                    <i class="fas fa-chevron-down"></i>
                </div>
            `;
            guideContainer.appendChild(header);

            // --- DESCRIPTION (if exists) ---
            let descriptionHtml = '';
            if (combo.description) {
                // Parse markdown links in description
                const parsedDescription = this.parseMarkdownLinks(combo.description, accent);
                descriptionHtml = `
                    <div class="px-6 pt-6 pb-2" style="background-color: ${theme.isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)'};">
                        <p class="text-sm md:text-base leading-relaxed italic opacity-90" style="color: ${textMain}">
                            <i class="fas fa-quote-left mr-2 opacity-50"></i>${parsedDescription}<i class="fas fa-quote-right ml-2 opacity-50"></i>
                        </p>
                    </div>
                `;
            }

            // --- STEPS CONTAINER ---
            const stepsWrapper = document.createElement('div');
            stepsWrapper.id = `guide-steps-${key}`;
            stepsWrapper.className = `${combo.description ? 'pt-4' : 'pt-6'} px-6 pb-6 md:px-8 md:pb-8 flex flex-col gap-8 hidden`;
            stepsWrapper.style.backgroundColor = theme.isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)';

            // Add description HTML if it exists
            if (descriptionHtml) {
                const descDiv = document.createElement('div');
                descDiv.innerHTML = descriptionHtml;
                guideContainer.appendChild(descDiv.firstElementChild);
            }

            if (combo.steps) {
                combo.steps.forEach((step, stepIndex) => {
                    const stepNum = stepIndex + 1;

                    // Resolve primary card for this step (handle single card or multiple actions)
                    let primaryCardId = step.card;
                    if (!primaryCardId && step.actions && step.actions.length > 0) {
                        primaryCardId = step.actions[0].card;
                    }

                    const cardName = cardNameMap[primaryCardId] || primaryCardId || "Unknown Card";
                    const imgId = `combo-${key}-step-${stepNum}-img`;

                    // Collect cards for batch loading via CardLoader
                    if (cardName) imageMap[imgId] = cardName;

                    // 1. Use customText if available, otherwise use auto-generated text
                    let displayText = step.customText || step.text;

                    // 2. Expand Jargon (SS -> Special Summon) only if using auto-generated text
                    if (!step.customText) {
                        displayText = this.formatForBeginners(displayText);
                    }

                    // 3. Highlight Cards
                    const highlightedText = this.highlightKeywords(displayText, cardNameMap, accent, theme.isDarkMode);

                    const stepCard = document.createElement('div');
                    stepCard.className = 'relative group';

                    stepCard.innerHTML = `
                        <div class="
                            flex flex-col md:flex-row items-center gap-6 
                            p-5 rounded-xl border shadow-sm
                            transition-all duration-300 hover:shadow-md
                            relative overflow-hidden
                        " style="
                            background-color: ${theme.cardBg}; 
                            border-color: ${accent}40;
                        ">
                            <div class="absolute top-0 left-0 px-3 py-1 rounded-br-lg text-[10px] font-bold tracking-widest z-10 shadow-sm"
                                 style="background: ${accent}; color: ${theme.isDarkMode ? '#000' : '#fff'};">
                                STEP ${stepNum}
                            </div>

                            <div id="${imgId}" 
                                 class="relative flex-shrink-0 w-24 h-36 md:w-28 md:h-40 rounded-lg overflow-hidden cursor-pointer shadow-md border mt-3 md:mt-0 transition-transform duration-300 group-hover:scale-105"
                                 style="border-color: ${accent};"
                                 onclick="if(window.CardLoader) window.CardLoader.showPopup(event, '${cardName.replace(/'/g, "\\'")}')">
                                <div class="w-full h-full flex items-center justify-center opacity-50 bg-black">
                                    <i class="fas fa-spinner fa-spin" style="color: ${accent}"></i>
                                </div>
                            </div>

                            <div class="flex-grow text-center md:text-left">
                                <p class="text-base md:text-lg leading-relaxed font-medium" style="color: ${textMain}">
                                    ${highlightedText}
                                </p>
                            </div>
                        </div>
                    `;
                    stepsWrapper.appendChild(stepCard);

                    // Arrow
                    if (stepIndex < combo.steps.length - 1) {
                        const arrow = document.createElement('div');
                        arrow.className = 'flex justify-center -my-3 opacity-30';
                        arrow.innerHTML = `<i class="fas fa-arrow-down text-xl" style="color: ${accent}"></i>`;
                        stepsWrapper.appendChild(arrow);
                    }
                });
            }

            guideContainer.appendChild(stepsWrapper);
            comboSection.appendChild(guideContainer);

            container.appendChild(comboSection);
        });

        // Defer card loading to existing CardLoader
        if (window.CardLoader) {
            setTimeout(() => window.CardLoader.loadCards(imageMap), 100);
        }
    }

    /**
     * Replaces competitive jargon with beginner-friendly terms
     */
    static formatForBeginners(text) {
        if (!text) return "";
        let t = text;

        const replacements = [
            { regex: /\bGY\b/gi, val: 'Graveyard' },
            { regex: /\bSS\b/gi, val: 'Special Summon' },
            { regex: /\bNS\b/gi, val: 'Normal Summon' },
            { regex: /\bSp\.?\s?Summon\b/gi, val: 'Special Summon' },
            { regex: /\bLP\b/gi, val: 'Life Points' },
            { regex: /\bATK\b/gi, val: 'Attack Points' },
            { regex: /\bDEF\b/gi, val: 'Defense Points' },
            { regex: /\bS\/T\b/gi, val: 'Spell/Trap' },
            { regex: /\bCL(\d+)/gi, val: 'Chain Link $1' },
            // Action Verbs
            { regex: /\bpop\b/gi, val: 'destroy' },
            { regex: /\bmill\b/gi, val: 'send from Deck to Graveyard' },
            { regex: /\bbounce\b/gi, val: 'return to hand' },
            { regex: /\bspin\b/gi, val: 'return to Deck' },
            { regex: /\bsearch\b/gi, val: 'add to your hand' },
            { regex: /\btribute\b/gi, val: 'Tribute' }
        ];

        replacements.forEach(r => {
            t = t.replace(r.regex, r.val);
        });

        // Sentence case fix for the very first letter if needed
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    /**
     * Parse markdown links and convert them to beautiful HTML anchors with icons
     * @param {string} text - Text containing markdown links
     * @param {string} accentColor - Accent color for styling links
     * @returns {string} Text with HTML links
     */
    static parseMarkdownLinks(text, accentColor) {
        if (!text) return '';

        // Match markdown links: [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

        return text.replace(markdownLinkRegex, (match, linkText, url) => {
            // Detect if it's a YouTube link
            const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
            const icon = isYouTube ? 'fab fa-youtube' : 'fas fa-external-link-alt';

            // Create a beautiful pill-shaped button with icon
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg no-underline"
                       style="
                           background: linear-gradient(135deg, ${accentColor}20, ${accentColor}40);
                           border: 2px solid ${accentColor};
                           color: ${accentColor};
                           box-shadow: 0 2px 8px ${accentColor}30;
                       "
                       onmouseover="this.style.background='linear-gradient(135deg, ${accentColor}40, ${accentColor}60)'; this.style.boxShadow='0 4px 16px ${accentColor}50';"
                       onmouseout="this.style.background='linear-gradient(135deg, ${accentColor}20, ${accentColor}40)'; this.style.boxShadow='0 2px 8px ${accentColor}30';">
                        <i class="${icon}"></i>
                        <span>${linkText}</span>
                        <i class="fas fa-arrow-right text-xs"></i>
                    </a>`;
        });
    }

    static highlightKeywords(text, nameMap, color, isDark) {
        let processed = text;
        const names = [...new Set(Object.values(nameMap))].sort((a, b) => b.length - a.length);
        const hoverColor = isDark ? '#fff' : '#000';

        names.forEach(name => {
            if (processed.includes(name)) {
                // Escape special regex chars in card names (like parentheses)
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedName, 'g');

                processed = processed.replace(regex,
                    `<span class="font-bold border-b border-dotted cursor-help transition-colors" 
                           style="color: ${color}; border-color: ${color}80;"
                           onmouseover="this.style.color='${hoverColor}'" 
                           onmouseout="this.style.color='${color}'">${name}</span>`
                );
            }
        });
        return processed;
    }
}

class DuelSimulator {
    constructor(containerId, comboData) {
        this.containerId = containerId;
        this.combos = comboData;
        this.currentComboId = Object.keys(comboData)[0];
        this.currentStep = 0;
        this.isPlaying = false;
        this.interval = null;
        this.cards = {};
        this.speed = 1200;
        this.resizeObserver = null;

        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // 1. Render Board
        this.renderBoard(container);

        // 2. Cache Elements
        this.tokenLayer = container.querySelector('.token-layer');
        this.logEl = container.querySelector('.sim-log');
        this.boardEl = container.querySelector('.duel-board');
        this.playBtn = container.querySelector('.btn-play');

        // NOTE: Removed internal createPopup(). Using global CardLoader.showPopup instead.

        // 3. Resize Observer (Keeps cards aligned when tabs change)
        // Optimized to not trigger during scrolling for better performance
        if (window.ResizeObserver) {
            let resizeTimeout;
            let scrollTimeout;
            let isScrolling = false;

            // Detect scrolling to pause resize observer
            const handleScroll = () => {
                isScrolling = true;
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                    // Reposition once after scrolling stops
                    this.repositionCards();
                }, 150);
            };

            window.addEventListener('scroll', handleScroll, { passive: true });

            this.resizeObserver = new ResizeObserver(() => {
                if (this.boardEl.offsetParent !== null && !isScrolling) {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => this.repositionCards(), 250);
                }
            });
            this.resizeObserver.observe(this.boardEl);
        }

        // 4. Start Loading
        this.loadCombo(this.currentComboId);

        // FIX: Ensure cards are positioned correctly after board is fully rendered.
        setTimeout(() => this.repositionCards(), 50);
        setTimeout(() => this.repositionCards(), 300); // Safety fallback

        // Trigger preload via CardLoader
        this.preloadAllImages();
    }

    async preloadAllImages() {
        if (typeof window.CardLoader === 'undefined') return;
        const names = new Set();
        Object.values(this.combos).forEach(c => c.cards.forEach(card => names.add(card.name)));
        // Use the robust CardLoader to handle API calls and caching
        window.CardLoader.preloadCards(Array.from(names));
    }

    renderBoard(container) {
        container.classList.add('duel-board-wrapper');
        container.innerHTML = `
            <div class="duel-board">
                <div class="field-grid">
                    <div class="empty-corner top-left"></div>
                    <div class="extra-monster-zones">
                        <div class="zone extra-monster-zone" id="zone-em-left"></div>
                        <div class="zone extra-monster-zone" id="zone-em-right"></div>
                    </div>
                    <!-- Banished Zone takes this spot -->
                    
                    <div class="zone field-zone" id="zone-field"></div>
                    <div class="main-monster-zones">
                        <div class="zone main-monster-zone" id="zone-m1"></div>
                        <div class="zone main-monster-zone" id="zone-m2"></div>
                        <div class="zone main-monster-zone" id="zone-m3"></div>
                        <div class="zone main-monster-zone" id="zone-m4"></div>
                        <div class="zone main-monster-zone" id="zone-m5"></div>
                    </div>
                    <div class="zone banished-zone" id="zone-banish" title="Banished Cards"></div>
                    <div class="zone gy-zone" id="zone-gy"></div>
                    
                    <div class="zone extra-deck-zone" id="zone-extra"></div>
                    <div class="spell-trap-zones">
                        <div class="zone spell-trap-zone" id="zone-s1"><div class="pendulum-icon blue">◆</div></div>
                        <div class="zone spell-trap-zone" id="zone-s2"></div>
                        <div class="zone spell-trap-zone" id="zone-s3"></div>
                        <div class="zone spell-trap-zone" id="zone-s4"></div>
                        <div class="zone spell-trap-zone" id="zone-s5"><div class="pendulum-icon red">◆</div></div>
                    </div>
                    <div class="zone deck-zone" id="zone-deck"></div>
                </div>
                <div class="hand-area" id="zone-hand"></div>
                <div class="token-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
            </div>

            <div class="sim-controls">
                <button class="sim-btn sim-btn-nav btn-reset"><i class="fas fa-undo"></i> Reset</button>
                <button class="sim-btn sim-btn-nav btn-prev"><i class="fas fa-step-backward"></i></button>
                <button class="sim-btn sim-btn-play btn-play"><i class="fas fa-play"></i> Play</button>
                <button class="sim-btn sim-btn-nav btn-next"><i class="fas fa-step-forward"></i></button>
                <button class="sim-btn sim-btn-nav btn-gy" title="View Graveyard"><i class="fas fa-skull"></i> GY</button>
                <button class="sim-btn sim-btn-nav btn-banish" title="View Banished Cards"><i class="fas fa-fire"></i> Banish</button>
            </div>
            <div class="sim-log"><div class="log-entry" style="color:#94a3b8">Ready to duel.</div></div>
        `;

        const b = document.createElement('div');
        b.innerHTML = 'BETA';
        b.style.cssText = 'position:absolute; top:10px; right:10px; background:#ef4444; color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.3); z-index:10; pointer-events:none;';
        container.appendChild(b);

        container.querySelector('.btn-reset').onclick = () => this.loadCombo(this.currentComboId);
        container.querySelector('.btn-prev').onclick = () => this.prevStep();
        container.querySelector('.btn-next').onclick = () => this.nextStep();
        container.querySelector('.btn-play').onclick = () => this.togglePlay();
        container.querySelector('.btn-gy').onclick = () => this.showGraveyardContents();
        container.querySelector('.btn-banish').onclick = () => this.showBanishedContents();
    }

    loadCombo(id) {
        this.reset();
        this.currentComboId = id;
        const combo = this.combos[id];
        if (!combo) return;

        this.log(`Loaded: ${combo.title}`);

        // 1. Create Cards
        combo.cards.forEach(c => this.createCardToken(c));

        // 2. Fill Hand
        const hand = combo.cards.filter(c => c.zone === 'zone-hand');
        for (let i = 0; i < (5 - hand.length); i++) {
            this.createCardToken({
                id: `dummy-${i}`, name: "Random Card", type: "monster",
                zone: "zone-hand", isDummy: true
            });
        }

        requestAnimationFrame(() => this.repositionCards());
    }

    createCardToken(data) {
        const token = document.createElement('div');
        token.id = `token-${data.id}`;
        token.className = `card-token ctype-${data.type || 'monster'}`;

        // 1. Initialize with NO transition to prevent "flying in" on load
        token.style.transition = 'none';
        // Note: will-change is set only during transitions to save GPU memory

        // Helper to set background safely
        const setImg = (url) => {
            if (url) token.style.backgroundImage = `url('${url}')`;
        };

        // Case 1: Explicit Dummy / Placeholder
        if (data.isDummy || String(data.id).startsWith('dummy-') || String(data.name).toLowerCase().startsWith('any ')) {
            setImg("https://images.ygoprodeck.com/images/cards/back_high.jpg");
        }
        // Case 2: Use CardLoader to fetch URL (cached or API)
        else if (typeof window.CardLoader !== 'undefined') {
            // Set default back while loading
            setImg("https://images.ygoprodeck.com/images/cards/back_high.jpg");

            // Attempt to get the URL from CardLoader
            window.CardLoader.getCardImageUrl(data.name).then(url => {
                if (url) {
                    setImg(url);
                    // Only transition background if it changes later
                    // We check if transition is re-enabled first to avoid conflict
                    if (token.style.transition !== 'none') {
                        token.style.transition += ', background-image 0.3s ease';
                    }
                }
            });
        }

        this.tokenLayer.appendChild(token);
        this.cards[data.id] = { element: token, data: data };
        token.setAttribute('data-zone', data.zone || 'zone-deck');

        token.style.pointerEvents = 'auto';
        token.style.cursor = 'pointer';

        // 2. Snap to initial position immediately (Instant)
        this.setPosition(token, data.zone || 'zone-deck');

        // 3. Enable smooth transitions for future moves
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                token.style.transition = 'left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s, height 0.3s, opacity 0.3s, transform 0.3s';
            });
        });

        // Attach Click Event to Global CardLoader Popup
        token.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!data.isDummy && typeof window.CardLoader !== 'undefined') {
                window.CardLoader.showPopup(e, data.name);
            }
        });
    }

    setPosition(token, zoneId, cachedRects = null) {
        const wrapper = document.getElementById(this.containerId);

        let boardRect, zoneRect;

        if (cachedRects) {
            boardRect = cachedRects.board;
            zoneRect = cachedRects.zones[zoneId];
        } else {
            const zone = wrapper.querySelector(`#${zoneId}`);
            if (!zone) return;
            boardRect = this.boardEl.getBoundingClientRect();
            zoneRect = zone.getBoundingClientRect();
        }

        if (!zoneRect || boardRect.width === 0) return;

        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const w = isMobile ? 62 : 120;
        const h = isMobile ? 90 : 175;

        token.style.width = `${w}px`;
        token.style.height = `${h}px`;

        if (zoneId === 'zone-hand') {
            const handTokens = Array.from(this.tokenLayer.children).filter(t => t.getAttribute('data-zone') === 'zone-hand');
            const idx = handTokens.indexOf(token);
            const total = handTokens.length;
            const spacing = 5;
            const startX = (zoneRect.width - (total * w + (total - 1) * spacing)) / 2;

            token.style.left = (zoneRect.left - boardRect.left + startX + (idx * (w + spacing))) + 'px';
            token.style.top = (zoneRect.top - boardRect.top + (zoneRect.height - h) / 2) + 'px';
        } else {
            const jX = (zoneId.includes('gy') || zoneId.includes('deck') || zoneId.includes('banish')) ? (Math.random() * 4 - 2) : 0;
            const jY = (zoneId.includes('gy') || zoneId.includes('deck') || zoneId.includes('banish')) ? (Math.random() * 4 - 2) : 0;
            token.style.left = (zoneRect.left - boardRect.left + (zoneRect.width - w) / 2 + jX) + 'px';
            token.style.top = (zoneRect.top - boardRect.top + (zoneRect.height - h) / 2 + jY) + 'px';
            // Rotate banished cards sideways
            if (zoneId.includes('banish')) {
                token.style.transform = 'rotate(90deg)';
            } else {
                token.style.transform = 'none';
            }
        }
    }

    repositionCards() {
        if (!this.boardEl) return;

        const boardRect = this.boardEl.getBoundingClientRect();
        if (boardRect.width === 0) return;

        const wrapper = document.getElementById(this.containerId);
        const zoneIds = [
            'zone-em-left', 'zone-em-right',
            'zone-field', 'zone-banish', 'zone-gy', 'zone-deck', 'zone-extra', 'zone-hand',
            'zone-m1', 'zone-m2', 'zone-m3', 'zone-m4', 'zone-m5',
            'zone-s1', 'zone-s2', 'zone-s3', 'zone-s4', 'zone-s5'
        ];

        const cachedRects = {
            board: boardRect,
            zones: {}
        };

        zoneIds.forEach(id => {
            const el = wrapper.querySelector(`#${id}`);
            if (el) cachedRects.zones[id] = el.getBoundingClientRect();
        });

        Object.values(this.cards).forEach(c => {
            const z = c.element.getAttribute('data-zone') || c.data.zone;
            this.setPosition(c.element, z, cachedRects);
        });
    }

    moveCard(cardId, targetZoneId) {
        const c = this.cards[cardId];
        if (!c) return;

        // Handle Material Attachment (Logical)
        if (targetZoneId.startsWith('material:')) {
            const parentId = targetZoneId.split(':')[1];
            this.attachMaterial(cardId, parentId);
            return;
        }

        // Auto-resolve Spell/Trap zone collisions to prevent stacking
        const stZones = ['zone-s1', 'zone-s2', 'zone-s3', 'zone-s4', 'zone-s5'];
        if (stZones.includes(targetZoneId)) {
            const isOccupied = Object.values(this.cards).some(other =>
                other.id !== cardId &&
                other.element.getAttribute('data-zone') === targetZoneId &&
                other.element.style.display !== 'none' &&
                other.element.style.opacity !== '0'
            );

            if (isOccupied) {
                // Find first empty ST zone
                const emptyZone = stZones.find(zId =>
                    !Object.values(this.cards).some(other =>
                        other.id !== cardId &&
                        other.element.getAttribute('data-zone') === zId &&
                        other.element.style.display !== 'none' &&
                        other.element.style.opacity !== '0'
                    )
                );

                if (emptyZone) {
                    this.log(`Zone ${targetZoneId} occupied, redirecting ${c.data.name} to ${emptyZone}`);
                    targetZoneId = emptyZone;
                }
            }
        }

        const isToken = (c.data.type || '').toLowerCase().includes('token') || (c.data.name || '').toLowerCase().includes('token');
        const isLeaving = ['zone-gy', 'zone-deck', 'zone-hand', 'zone-banish'].includes(targetZoneId);

        if (c.vanishTimeout) {
            clearTimeout(c.vanishTimeout);
            c.vanishTimeout = null;
        }

        if (isToken && isLeaving) {
            this.log(`(Token removed)`);
            c.element.style.opacity = "0";
            c.element.style.transform = "scale(0.5)";
            c.vanishTimeout = setTimeout(() => c.element.style.display = 'none', 500);
            return;
        }

        // Check for attached materials and move them if parent is leaving field
        if (this.materials && this.materials[cardId] && this.materials[cardId].length > 0) {
            if (isLeaving) {
                // Move all materials to GY
                const mats = [...this.materials[cardId]];
                this.log(`Materials for ${c.data.name} sent to GY`);
                mats.forEach(matId => {
                    this.moveCard(matId, 'zone-gy');
                });
                this.materials[cardId] = []; // Clear attachments
            } else {
                // If parent moves to another field zone, materials should follow (visually)
                setTimeout(() => {
                    this.materials[cardId].forEach(matId => {
                        const mat = this.cards[matId];
                        if (mat) {
                            mat.element.setAttribute('data-zone', targetZoneId);
                            this.setPosition(mat.element, targetZoneId);
                        }
                    });
                }, 50);
            }
        }

        c.element.style.display = 'block';
        c.element.style.opacity = '1';
        c.element.style.transform = 'scale(1)';

        // Ensure high Z-Index during movement so it flies OVER other cards
        c.element.style.zIndex = '100';

        if (!c.element.style.left) {
            const currentZone = c.element.getAttribute('data-zone') || c.data.zone;
            // Temporarily disable transition for initial placement if it was missing
            const originalTransition = c.element.style.transition;
            c.element.style.transition = 'none';
            this.setPosition(c.element, currentZone);
            void c.element.offsetWidth; // Force Browser Reflow
            c.element.style.transition = originalTransition;
        }

        c.element.setAttribute('data-zone', targetZoneId);

        this.setPosition(c.element, targetZoneId);
        if (targetZoneId === 'zone-hand' || c.data.zone === 'zone-hand') this.repositionCards();

        c.element.classList.add('active-card');

        // Remove Z-Index boost and active class after animation completes
        setTimeout(() => {
            c.element.classList.remove('active-card');
            c.element.style.zIndex = '';
        }, 600);
    }

    attachMaterial(cardId, parentId) {
        if (!this.materials) this.materials = {};
        if (!this.materials[parentId]) this.materials[parentId] = [];

        // Avoid duplicates
        if (!this.materials[parentId].includes(cardId)) {
            this.materials[parentId].push(cardId);
        }

        const parent = this.cards[parentId];
        const child = this.cards[cardId];

        if (parent && child) {
            const parentZone = parent.element.getAttribute('data-zone');

            // Move child to parent's zone visually
            child.element.setAttribute('data-zone', parentZone);
            this.setPosition(child.element, parentZone);
        }
    }

    nextStep() {
        const steps = this.combos[this.currentComboId].steps;
        if (this.currentStep < steps.length) {
            const s = steps[this.currentStep];
            this.log(`> ${s.text}`);

            if (s.actions && Array.isArray(s.actions)) {
                s.actions.forEach(action => {
                    this.moveCard(action.card, action.to);
                });
            } else {
                this.moveCard(s.card, s.to);
            }

            this.currentStep++;
        } else {
            this.log("Combo Complete!");
            this.togglePlay(false);
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            const target = this.currentStep - 1;
            const oldLog = this.log;
            this.log = () => { };
            this.loadCombo(this.currentComboId);
            const steps = this.combos[this.currentComboId].steps;
            for (let i = 0; i < target; i++) this.moveCard(steps[i].card, steps[i].to);
            this.log = oldLog;
            this.currentStep = target;
            this.log(`< Rewound to Step ${target}`);
        }
    }

    reset() {
        this.isPlaying = false;
        clearInterval(this.interval);
        this.updatePlayButton();
        this.currentStep = 0;
        this.tokenLayer.innerHTML = '';
        this.cards = {};
        this.logEl.innerHTML = '';
    }

    togglePlay(force) {
        this.isPlaying = typeof force !== 'undefined' ? force : !this.isPlaying;
        this.updatePlayButton();
        if (this.isPlaying) this.interval = setInterval(() => this.nextStep(), this.speed);
        else clearInterval(this.interval);
    }

    updatePlayButton() {
        this.playBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Play';
        this.playBtn.classList.toggle('paused', this.isPlaying);
    }

    log(msg) {
        const d = document.createElement('div');
        d.className = 'log-entry';
        d.textContent = msg;
        this.logEl.appendChild(d);
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    showGraveyardContents() {
        const gyCards = Object.values(this.cards).filter(c => c.element.getAttribute('data-zone') === 'zone-gy');

        if (gyCards.length === 0) {
            this.log('Graveyard is empty');
            return;
        }

        // Close banish panel if open
        const banishPanel = document.getElementById('banish-side-panel');
        if (banishPanel) {
            document.body.removeChild(banishPanel);
        }

        const existingPanel = document.getElementById('gy-side-panel');
        if (existingPanel) {
            document.body.removeChild(existingPanel);
            return;
        }

        // Create side panel overlay
        const overlay = document.createElement('div');
        overlay.id = 'gy-side-panel';
        overlay.style.cssText = 'position:fixed; top:0; right:0; width:' + (window.innerWidth <= 768 ? '100%' : '400px') + '; height:100%; background:rgba(30,41,59,0.98); z-index:9999; box-shadow:-4px 0 20px rgba(0,0,0,0.5); border-left:2px solid #38bdf8; display:flex; flex-direction:column; animation:slideIn 0.3s ease-out;';

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = '@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }';
        document.head.appendChild(style);

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:20px; border-bottom:2px solid #38bdf8; display:flex; justify-content:space-between; align-items:center; background:#0f172a;';

        const title = document.createElement('h3');
        title.textContent = `Graveyard (${gyCards.length} cards)`;
        title.style.cssText = 'color:#38bdf8; margin:0; font-size:20px; font-weight:bold;';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#38bdf8; font-size:24px; cursor:pointer; padding:0; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:background 0.2s;';
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(56,189,248,0.1)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = () => document.body.removeChild(overlay);

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Scrollable card container
        const cardContainer = document.createElement('div');
        cardContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px;';

        const cardGrid = document.createElement('div');
        cardGrid.style.cssText = 'display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;';

        gyCards.forEach(c => {
            const cardWrapper = document.createElement('div');
            cardWrapper.style.cssText = 'cursor:pointer; transition:transform 0.2s; position:relative; display:flex; align-items:center; justify-content:center;';
            cardWrapper.onmouseenter = () => cardWrapper.style.transform = 'scale(1.05)';
            cardWrapper.onmouseleave = () => cardWrapper.style.transform = 'scale(1)';

            const cardImg = document.createElement('div');
            cardImg.style.cssText = `width:100%; aspect-ratio:59/86; background-size:cover; background-position:center; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.4); border:2px solid #38bdf8; ${c.element.style.backgroundImage ? 'background-image:' + c.element.style.backgroundImage : ''}`;

            cardWrapper.onclick = (e) => {
                if (typeof window.CardLoader !== 'undefined' && !c.data.isDummy) {
                    window.CardLoader.showPopup(e, c.data.name);
                }
            };

            cardWrapper.appendChild(cardImg);
            cardGrid.appendChild(cardWrapper);
        });

        cardContainer.appendChild(cardGrid);

        // Footer with info
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:16px 20px; border-top:2px solid #38bdf8; background:#0f172a; color:#94a3b8; font-size:12px; text-align:center;';
        footer.textContent = 'Click any card to view details';

        overlay.appendChild(header);
        overlay.appendChild(cardContainer);
        overlay.appendChild(footer);

        // Close on background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);
    }

    showBanishedContents() {
        const banishedCards = Object.values(this.cards).filter(c => c.element.getAttribute('data-zone') === 'zone-banish');

        if (banishedCards.length === 0) {
            this.log('Banished zone is empty');
            return;
        }

        // Close GY panel if open
        const gyPanel = document.getElementById('gy-side-panel');
        if (gyPanel) {
            document.body.removeChild(gyPanel);
        }

        // Check if banish panel already exists - toggle it
        const existingPanel = document.getElementById('banish-side-panel');
        if (existingPanel) {
            document.body.removeChild(existingPanel);
            return;
        }

        // Create side panel overlay
        const overlay = document.createElement('div');
        overlay.id = 'banish-side-panel';
        overlay.style.cssText = 'position:fixed; top:0; right:0; width:' + (window.innerWidth <= 768 ? '100%' : '400px') + '; height:100%; background:rgba(30,41,59,0.98); z-index:9999; box-shadow:-4px 0 20px rgba(0,0,0,0.5); border-left:2px solid #f97316; display:flex; flex-direction:column; animation:slideIn 0.3s ease-out;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:20px; border-bottom:2px solid #f97316; display:flex; justify-content:space-between; align-items:center; background:#0f172a;';

        const title = document.createElement('h3');
        title.textContent = `Banished (${banishedCards.length} cards)`;
        title.style.cssText = 'color:#f97316; margin:0; font-size:20px; font-weight:bold;';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.style.cssText = 'background:transparent; border:none; color:#f97316; font-size:24px; cursor:pointer; padding:0; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:background 0.2s;';
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(249,115,22,0.1)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = () => document.body.removeChild(overlay);

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Scrollable card container
        const cardContainer = document.createElement('div');
        cardContainer.style.cssText = 'flex:1; overflow-y:auto; padding:20px;';

        const cardGrid = document.createElement('div');
        cardGrid.style.cssText = 'display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;';

        banishedCards.forEach(c => {
            const cardWrapper = document.createElement('div');
            // Use a square-ish container to accommodate the rotated card
            cardWrapper.style.cssText = 'cursor:pointer; transition:transform 0.2s; position:relative; display:flex; align-items:center; justify-content:center;';
            cardWrapper.onmouseenter = () => cardWrapper.style.transform = 'scale(1.05)';
            cardWrapper.onmouseleave = () => cardWrapper.style.transform = 'scale(1)';

            const cardImg = document.createElement('div');
            // Rotate the card 90 degrees. Swap width/height aspect ratio considerations.
            // Original card is ~59x86. Rotated it's ~86x59.
            // We set width to be smaller to fit in grid, and rotate it.
            cardImg.style.cssText = `width:100%; aspect-ratio:59/86; background-size:cover; background-position:center; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.4); border:2px solid #f97316; ${c.element.style.backgroundImage ? 'background-image:' + c.element.style.backgroundImage : ''}`;

            cardWrapper.onclick = (e) => {
                if (typeof window.CardLoader !== 'undefined' && !c.data.isDummy) {
                    window.CardLoader.showPopup(e, c.data.name);
                }
            };

            cardWrapper.appendChild(cardImg);
            cardGrid.appendChild(cardWrapper);
        });

        cardContainer.appendChild(cardGrid);

        // Footer with info
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:16px 20px; border-top:2px solid #f97316; background:#0f172a; color:#94a3b8; font-size:12px; text-align:center;';
        footer.textContent = 'Click any card to view details';

        overlay.appendChild(header);
        overlay.appendChild(cardContainer);
        overlay.appendChild(footer);

        // Close on background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);
    }

}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================
// Automatically initialize combo systems on page load for elements with data-combo-system attribute
// Usage: <div data-combo-system="Blue-Eyes"></div>

document.addEventListener('DOMContentLoaded', () => {
    const comboContainers = document.querySelectorAll('[data-combo-system]');

    if (comboContainers.length > 0) {
        console.log(`[ComboLoader] Found ${comboContainers.length} combo system(s) to auto-initialize`);
    }

    comboContainers.forEach(async (container) => {
        const archetypeName = container.dataset.comboSystem;

        if (!archetypeName) {
            console.warn('[ComboLoader] Found data-combo-system attribute with no value, skipping');
            return;
        }

        // Auto-generate ID if not provided
        if (!container.id) {
            const generatedId = `combo-system-${archetypeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            container.id = generatedId;
            console.log(`[ComboLoader] Auto-generated ID: ${generatedId}`);
        }

        try {
            await ComboLoader.renderComboSystem(container.id, archetypeName, {});
        } catch (error) {
            console.error(`[ComboLoader] Failed to auto-initialize combo system for ${archetypeName}:`, error);
        }
    });
});
