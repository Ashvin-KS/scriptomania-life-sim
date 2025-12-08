
export interface DialogueLine {
    character: string;
    text: string;
}

export interface ContentItem {
    type: 'narration' | 'dialogue';
    text: string;
    character?: string;
}

export interface StorySegment {
    content: ContentItem[];
    sceneVisualPrompt: string;
    reasoning?: string;
    // Deprecated fields kept for temporary compatibility
    narration?: string;
    dialogue?: DialogueLine[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content?: string; // For user messages or raw text fallback
    structuredContent?: StorySegment; // For model messages
    reasoning?: string; // To store the model's thinking process
    timestamp: number;
}

export interface SceneState {
    description: string;
    imageUrl: string | null;
    isLoading: boolean;
}

export interface Character {
    id: string;
    name: string;
    role: string;
    avatar: string;
    personality?: string; // New field for dynamic prompt generation
    appearance?: string; // Visual description
    speakingStyle?: string; // How they talk (slang, formal, stutter, etc.)
    gallery: string[]; // Multiple images/presets
}

export interface SystemInstruction {
    id: string;
    label: string;
    content: string;
    preNarration?: string; // Initial narration when starting a new chat with this template
}

export interface Situation {
    id: string;
    title?: string;
    brief?: string; // short one-line preview for user
    content: string; // full situation text to inject into prompts
}

export interface SessionAPIConfig {
    useGlobalDefaults: boolean; // If true, ignore custom settings below
    endpoint?: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    maxSpeakers?: number;
    minWords?: number;
    maxWords?: number;
}

export interface AIScenarioRequest {
    description: string; // User's scenario description
}

export interface AIScenarioResult {
    scenarioId: string; // Which template to base on
    customInstructions: string; // Generated system prompt
    suggestedCharacters?: Array<{
        name: string;
        role: string;
        personality: string;
    }>;
}

export interface PresetTemplate {
    id: string;
    name: string;
    description: string;
    emoji: string;
    scenarioId: string;
    characterIds: string[]; // IDs from DEFAULT_CHARACTERS
    apiConfig: SessionAPIConfig;
}

export interface ChatBackground {
    type: 'default' | 'paper' | 'custom';
    value?: string; // URL for custom image, or color code
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
    lastModified: number;
    instructionId: string;
    customInstruction?: string; // Store session-specific custom instruction
    characters?: Character[]; // List of characters specific to this session
    apiConfig?: SessionAPIConfig; // Per-session API settings
    background?: ChatBackground;
    // Optional selected situation (from a scenario template)
    selectedSituation?: Situation;
}