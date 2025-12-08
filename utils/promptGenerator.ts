import { Character } from '../types';
import { SYSTEM_INSTRUCTIONS, JSON_RESPONSE_FORMAT, CORE_RULES } from '../constants';

// Generate system prompt with template content directly
export const generateSystemPromptWithContent = (characters: Character[], templateContent: string, maxSpeakers: number = 4, minWords: number = 250, maxWords: number = 600, userProfile?: { name: string; famous: string; lifeDetails: string }, situationContent?: string): string => {
    let content = templateContent;

    // Replace word count in CORE_RULES
    const dynamicCoreRules = CORE_RULES.replace(
        /VARY response length: MINIMUM \d+ words, MAXIMUM \d+ words\./,
        `VARY response length: MINIMUM ${minWords} words, MAXIMUM ${maxWords} words.`
    );

    // If no characters, return default template (fallback)
    if (!characters || characters.length === 0) {
        return content + dynamicCoreRules + JSON_RESPONSE_FORMAT;
    }

    const characterCount = characters.length;
    const countWord = getNumberWord(characterCount).toUpperCase();
    const characterNames = characters.map(c => c.name).join(', ');

    // 2. Replace Placeholders
    content = content.replace(/{{COUNT_WORD}}/g, countWord);
    content = content.replace(/{{CHARACTERS}}/g, characterNames);

    // 3. Build Character List
    const characterList = characters.map((c, index) => {
        const personality = c.personality ? `[Personality: ${c.personality}]` : "";
        const appearance = c.appearance ? `[Appearance: ${c.appearance}]` : "";
        const style = c.speakingStyle ? `[Speaking Style: ${c.speakingStyle}]` : "";

        // Combine all details
        const details = [personality, appearance, style].filter(Boolean).join(' ');

        return `${index + 1}. ${c.name} – ${c.role} ${details}`;
    }).join('\n');

    // 4. Build Dynamic Participation Rules
    let participationRules = "";
    if (characterCount > 1) {
        // Force high participation: Min is Total - 1 (or 4, whichever is higher, but capped by total)
        // If total is small (e.g. 3), min is 2.
        const minSpeakers = Math.max(2, characterCount <= 4 ? characterCount - 1 : characterCount - 2);

        // Ensure max is at least min, but not more than total characters
        const effectiveMax = Math.max(minSpeakers, Math.min(maxSpeakers, characterCount));

        const randomExample = characters.slice(0, Math.min(3, characterCount)).map(c => c.name).join(', ');
        participationRules = `
≫≫ CRITICAL: DYNAMIC PARTICIPATION ≪≪
- **CROWDED SCENES**: Almost EVERYONE must speak in every response.
- **MANDATORY LOOP**: Characters MUST speak multiple times in a single response!
   - BAD: Alex -> Mia -> Jordan (End)
   - GOOD: Alex -> Mia -> Alex -> Jordan -> Mia -> Alex (End)
- **INTERACTIVITY**: Characters MUST speak to EACH OTHER (bickering, agreeing, commanding), not just react to the situation.
   - **USE NAMES**: When speaking to another character, explicitly use their name (e.g., "That's not right, Mia!", "Good point, Jordan").
- Generate MEDIUM dialogue chains (5-1 lines) to keep it punchy but lively.
- ENSURE ${characterNames} get equal speaking time overall.
- IF the situation involves a specific character, that character MUST speak.
`;
    }

    // Add user profile context if available - always include for enhanced personalization
    let userContext = "";
    if (userProfile) {
        userContext = `
≫≫ USER PROFILE ≪≪
The user observing this story is:
- Name: ${userProfile.name}
- Known for: ${userProfile.famous}
- Background: ${userProfile.lifeDetails}

≫≫ CRITICAL USER INTEGRATION RULES ≪≪
- Characters MUST acknowledge ${userProfile.name}'s presence by name in EVERY response
- Characters should reference ${userProfile.name}'s interests: "${userProfile.lifeDetails}"
- Characters ask ${userProfile.name} questions: "What do you think, ${userProfile.name}?"
- Characters explain things based on ${userProfile.name}'s expertise: "${userProfile.famous}"
- Make ${userProfile.name} feel like they're part of the story, not just an observer
- Use ${userProfile.name}'s name naturally in dialogue multiple times per response
- Characters seek ${userProfile.name}'s opinion: "Don't you agree, ${userProfile.name}?"
- Characters address ${userProfile.name} directly when discussing topics related to their background
`;
    }

    // 5. Construct Final Prompt
    let situationSection = '';
    if (situationContent && situationContent.trim()) {
        situationSection = `\n\n≫≫ SELECTED SITUATION ≪≪\n${situationContent.trim()}\n`;
    }

    return `
${content}
${situationSection}
≫≫ ACTIVE CHARACTERS (${countWord}) ≪≪
${characterList}

${participationRules}

${userContext}

${dynamicCoreRules}

${JSON_RESPONSE_FORMAT}
`.trim();
};

const getNumberWord = (num: number): string => {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    return words[num] || num.toString();
};

// Original function for backward compatibility - looks up template by ID
export const generateSystemPrompt = (characters: Character[], baseTemplateId: string = 'default_friends', maxSpeakers: number = 4, minWords: number = 250, maxWords: number = 600, userProfile?: { name: string; famous: string; lifeDetails: string }, situationContent?: string): string => {
    const templateObj = SYSTEM_INSTRUCTIONS.find(i => i.id === baseTemplateId) || SYSTEM_INSTRUCTIONS[0];
    return generateSystemPromptWithContent(characters, templateObj.content, maxSpeakers, minWords, maxWords, userProfile, situationContent);
};