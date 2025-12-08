import { AIScenarioRequest, AIScenarioResult } from '../types';

const SCENARIO_GENERATION_PROMPT = `
You are an expert creative writer and roleplay scenario designer.
Your task is to generate a detailed roleplay scenario based on the user's description.

You must respond with ONLY a valid JSON object in the following format:
{
  "scenarioId": "custom_generated",
  "customInstructions": "The full system prompt for the AI characters...",
  "suggestedCharacters": [
    { "name": "Name", "role": "Role description", "personality": "Personality traits" }
  ]
}

The 'customInstructions' should be detailed, defining the world, the premise, the tone, and the rules of engagement.
It should be written in the second person ("You are...") addressing the AI characters.
`;

export const generateScenario = async (
    request: AIScenarioRequest,
    apiEndpoint?: string,
    apiKey?: string,
    model: string = "deepseek-ai/deepseek-r1-0528"
): Promise<AIScenarioResult> => {
    try {
        const messages = [
            { role: 'system', content: SCENARIO_GENERATION_PROMPT },
            { role: 'user', content: `Create a scenario based on this description: ${request.description}` }
        ];

        let baseUrl = apiEndpoint ? apiEndpoint.replace(/\/$/, '') : '';
        if (baseUrl.includes(':1234') && !baseUrl.includes('/v1')) {
            baseUrl += '/v1';
        }
        const url = `${baseUrl}/chat/completions`;

        if (!url) {
            throw new Error("No API endpoint provided. Please configure your API settings.");
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey || ''}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.8,
                max_tokens: 4000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || "{}";

        // Extract JSON from markdown if present
        let jsonString = content.trim();
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        } else {
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }
        }

        const result = JSON.parse(jsonString);

        // Validate result structure
        if (!result.customInstructions) {
            throw new Error("Generated JSON missing customInstructions");
        }

        // If the generated result contains an array of 'situations', pass them through in a simple form
        const situations = result.situations && Array.isArray(result.situations) ? result.situations.map((s: any, idx: number) => ({ id: s.id || `gen_${idx}`, title: s.title || s.brief || `Situation ${idx+1}`, brief: s.brief || '', content: s.content || s.description || '' })) : undefined;

        return {
            scenarioId: result.scenarioId || "custom_generated",
            customInstructions: result.customInstructions,
            suggestedCharacters: result.suggestedCharacters || [],
            // @ts-ignore - allow passing situations as part of scenario result for UI consumption
            ...(situations ? { situations } : {})
        } as any;

    } catch (error) {
        console.error("Error generating scenario:", error);
        throw error;
    }
};