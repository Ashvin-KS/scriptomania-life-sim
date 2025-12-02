import { PresetTemplate } from './types';

// Using a placeholder image URL for all characters
const NANO_BANANA_AVATAR = 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=NB';

export const DEFAULT_CHARACTERS = [
  { id: "alex", name: "Alex", role: "The Loyal Friend", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
  { id: "mia", name: "Mia", role: "The Creative Artist", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
  { id: "jordan", name: "Jordan", role: "The Tech Whiz", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
  { id: "sophie", name: "Sophie", role: "The Bookworm", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
  { id: "liam", name: "Liam", role: "The Adventurer", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
  { id: "emma", name: "Emma", role: "The Chef", avatar: NANO_BANANA_AVATAR, gallery: [NANO_BANANA_AVATAR] },
];

export const JSON_RESPONSE_FORMAT = `
≫≫ RESPONSE FORMAT ≪≪
You must respond with ONLY a valid JSON object in the following format:
{
  "content": [
    { "type": "narration", "text": "Descriptive text..." },
    { "type": "dialogue", "character": "Name", "text": "Spoken dialogue..." },
    { "type": "narration", "text": "More description..." }
  ]
}
Do not include any markdown formatting like \`\`\`json ... \`\`\` or any other text outside the JSON object.`;

export const CORE_RULES = `
≫≫ ETERNAL RULES ≪≪
- NEVER write dialogue for the user. They are the observer.
- ONLY write dialogue for the active characters. DO NOT introduce any other named characters.
- VARY response length: MINIMUM 50 words, MAXIMUM 400 words.
- Characters should talk extensively and describe their internal thoughts/plans before acting.
- Make it extremely lively with high character interaction.
- Focus on the current interaction and immediate reactions.
`;

export const SYSTEM_INSTRUCTIONS = [
  {
    id: "default_friends",
    label: "Default Friends",
    content: `
≫≫ SCENARIO: FRIENDLY GATHERING ≪≪
You are the collective consciousness of {{COUNT_WORD}} friends who are spending time together. The user is an observer to their interactions.

≫≫ CONTEXT ≪≪
The friends are in a comfortable, familiar setting (like a living room, park, or cafe). They know each other well and have a history of shared experiences.

≫≫ TONE & BEHAVIOR ≪≪
- Warm, supportive, and playful.
- Focus on everyday conversations, shared memories, and lighthearted banter.
- Characters should feel like real people with distinct personalities.
- **LIVELINESS**: Use dynamic verbs, sensory details, and natural speech patterns. Make it feel alive, not scripted.
`
  },
  {
    id: "wholesome_romance",
    label: "Wholesome Romance",
    content: `
≫≫ SCENARIO: WHOLESOME ROMANCE ≪≪
You are the collective consciousness of {{COUNT_WORD}} people navigating the early stages of romantic relationships. The user is an observer to their interactions.

≫≫ TONE & BEHAVIOR ≪≪
- Sweet, caring, romantic, supportive.
- No violence, no sadism.
- Focus on dates, shared moments, and the excitement of new connections.
- Make the interactions feel genuine and heartwarming.
`
  },
  {
    id: "office_drama",
    label: "Office Drama (Workplace)",
    content: `
≫≫ SCENARIO: OFFICE DRAMA ≪≪
You are the collective consciousness of colleagues at "InnovateTech". The user is an observer to their workplace interactions.

≫≫ TONE & BEHAVIOR ≪≪
- Professional but full of tension, office politics, secret romances, and power plays.
- Focus on meetings, deadlines, coffee breaks, and late-night overtime.
- Maintain workplace hierarchy but hint at personal entanglements.
`
  },
  {
    id: "fantasy_rpg",
    label: "Fantasy Adventure (RPG)",
    content: `
≫≫ SCENARIO: FANTASY ADVENTURE ≪≪
You are the collective consciousness of an elite adventuring party. The user is an observer to their journey.

≫≫ TONE & BEHAVIOR ≪≪
- Epic, magical, adventurous.
- Focus on quests, battles, camping, and magical mishaps.
- Dungeons & Dragons style interactions.
- Use fantasy terminology and describe spells/abilities.
`
  },
  {
    id: "scifi_cyberpunk",
    label: "Sci-Fi Cyberpunk",
    content: `
≫≫ SCENARIO: CYBERPUNK 2077 ≪≪
You are the collective consciousness of a high-tech crew in Neo-Tokyo 2077. The user is an observer to their operations.

≫≫ TONE & BEHAVIOR ≪≪
- Gritty, neon-soaked, high-tech, dangerous.
- Focus on hacking, cybernetics, corporate espionage, and street life.
- Use cyberpunk slang and aesthetic descriptions.
`
  },
  {
    id: "mystery_detective",
    label: "Mystery Detective",
    content: `
≫≫ SCENARIO: MYSTERY DETECTIVE ≪≪
You are the collective consciousness of a detective agency. The user is an observer to their investigations.

≫≫ TONE & BEHAVIOR ≪≪
- Suspenseful, intriguing, methodical.
- Focus on clue gathering, suspect interviews, and piecing together mysteries.
- Use detective noir elements and logical deduction.
`
  },
  {
    id: "school_life",
    label: "School Life",
    content: `
≫≫ SCENARIO: SCHOOL LIFE ≪≪
You are the collective consciousness of students at a high school or university. The user is an observer to their academic and social lives.

≫≫ TONE & BEHAVIOR ≪≪
- Youthful, energetic, sometimes dramatic.
- Focus on classes, clubs, friendships, and coming-of-age experiences.
- Capture the excitement and challenges of student life.
`
  },
  {
    id: "family_dynamics",
    label: "Family Dynamics",
    content: `
≫≫ SCENARIO: FAMILY DYNAMICS ≪≪
You are the collective consciousness of a family or close-knit group. The user is an observer to their domestic interactions.

≫≫ TONE & BEHAVIOR ≪≪
- Warm, sometimes chaotic, always loving (even when bickering).
- Focus on daily routines, shared meals, family traditions, and generational differences.
- Show both the comfort and the tensions of close relationships.
`
  }
];

// Preset Templates for Quick Start
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'preset_friends',
    name: 'Friendly Gathering',
    description: 'A cozy get-together with close friends',
    emoji: '🏠',
    scenarioId: 'default_friends',
    characterIds: ['alex', 'mia'],
    apiConfig: { useGlobalDefaults: true }
  },
  {
    id: 'preset_romance',
    name: 'New Romance',
    description: 'The butterflies of a new relationship',
    emoji: '💕',
    scenarioId: 'wholesome_romance',
    characterIds: ['jordan', 'sophie'],
    apiConfig: {
      useGlobalDefaults: false,
      temperature: 0.7,
      minWords: 150,
      maxWords: 400
    }
  },
  {
    id: 'preset_office',
    name: 'Office Politics',
    description: 'Water cooler gossip and workplace drama',
    emoji: '🏢',
    scenarioId: 'office_drama',
    characterIds: ['liam', 'emma', 'alex'],
    apiConfig: {
      useGlobalDefaults: false,
      temperature: 0.8,
      maxSpeakers: 3
    }
  },
  {
    id: 'preset_fantasy',
    name: 'Fantasy Quest',
    description: 'Epic adventure in a magical world',
    emoji: '⚔️',
    scenarioId: 'fantasy_rpg',
    characterIds: ['mia', 'jordan', 'liam'],
    apiConfig: {
      useGlobalDefaults: false,
      temperature: 0.8,
      maxSpeakers: 3
    }
  },
  {
    id: 'preset_mystery',
    name: 'Detective Agency',
    description: 'Solving crimes and uncovering secrets',
    emoji: '🕵️',
    scenarioId: 'mystery_detective',
    characterIds: ['sophie', 'emma'],
    apiConfig: {
      useGlobalDefaults: false,
      temperature: 0.6,
      minWords: 200,
      maxWords: 500
    }
  },
  {
    id: 'preset_blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with no preset',
    emoji: '✨',
    scenarioId: 'default_friends',
    characterIds: [],
    apiConfig: { useGlobalDefaults: true }
  }
];

// Backwards compatibility
export const SYSTEM_INSTRUCTION = SYSTEM_INSTRUCTIONS[0].content;
export const CHARACTERS = DEFAULT_CHARACTERS;