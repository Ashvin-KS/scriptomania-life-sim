import { StorySegment, DialogueLine } from '../types';

/**
 * Tries to parse a potentially incomplete JSON string into a StorySegment.
 * This is a heuristic parser designed for the specific format of our AI response.
 */
export const parsePartialJson = (jsonString: string): StorySegment => {
    const result: StorySegment = {
        content: [],
        sceneVisualPrompt: "",
        // Backward compatibility
        narration: "",
        dialogue: []
    };

    try {
        // NEW FORMAT: Look for "content" array
        const contentStart = jsonString.indexOf('"content"');
        if (contentStart !== -1) {
            const contentSection = jsonString.slice(contentStart);

            // Regex to match items in the content array
            // Matches: { "type": "...", "text": "..." } OR { "type": "...", "character": "...", "text": "..." }
            // We need to be flexible with key order, but usually LLMs follow the schema.
            // Let's try to match individual objects.

            // This regex looks for an object start {, then looks for type, character (optional), and text fields in any order roughly
            // But strict regex is hard. Let's stick to the schema order for now as it's prompted.
            // Prompt says: type, (character), text.

            const itemRegex = /{\s*"type"\s*:\s*"([^"]+)"\s*,\s*(?:"character"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*)?"text"\s*:\s*"((?:[^"\\]|\\.)*)/g;

            let match;
            while ((match = itemRegex.exec(contentSection)) !== null) {
                const type = match[1];
                const character = match[2] ? unescapeJsonString(match[2]) : undefined;
                const text = unescapeJsonString(match[3]);

                if (type === 'narration') {
                    result.content.push({ type: 'narration', text });
                } else if (type === 'dialogue') {
                    result.content.push({ type: 'dialogue', character: character || 'Unknown', text });
                }
            }
        }
        // FALLBACK: OLD FORMAT
        else {
            // 1. Extract Narration
            const narrationMatch = jsonString.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/);
            if (narrationMatch) {
                const text = unescapeJsonString(narrationMatch[1]);
                result.narration = text;
                result.content.push({ type: 'narration', text });
            }

            // 2. Extract Dialogue
            const dialogueStart = jsonString.indexOf('"dialogue"');
            if (dialogueStart !== -1) {
                const dialogueSection = jsonString.slice(dialogueStart);
                const objectRegex = /{\s*"character"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)/g;

                let match;
                while ((match = objectRegex.exec(dialogueSection)) !== null) {
                    const character = unescapeJsonString(match[1]);
                    const text = unescapeJsonString(match[2]);
                    result.dialogue!.push({ character, text });
                    result.content.push({ type: 'dialogue', character, text });
                }
            }
        }

        // 3. Extract Visual Prompt (Common to both)
        const visualPromptMatch = jsonString.match(/"sceneVisualPrompt"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (visualPromptMatch) {
            result.sceneVisualPrompt = unescapeJsonString(visualPromptMatch[1]);
        }

    } catch (e) {
        // Ignore parsing errors for partial data
    }

    return result;
};

const unescapeJsonString = (str: string): string => {
    try {
        // JSON.parse(`"${str}"`) handles escapes like \n, \", etc.
        // But we need to be careful if the string ends with a backslash (incomplete escape)
        if (str.endsWith('\\')) {
            str = str.slice(0, -1);
        }
        return JSON.parse(`"${str}"`);
    } catch (e) {
        return str;
    }
};