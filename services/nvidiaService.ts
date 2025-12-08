import { StorySegment } from '../types';
import { parsePartialJson } from '../utils/partialJsonParser';

export const fetchModels = async (apiKey?: string): Promise<string[]> => {
  try {
    // Always use NVIDIA API through proxy
    const baseUrl = '/api/nvidia';
    const url = `${baseUrl}/models`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    // OpenAI format: { data: [{ id: "model-name", ... }, ...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id);
    }
    return [];
  } catch (error) {
    console.error("Error fetching models:", error);

    // Fallback for production environments where proxy might fail
    console.warn("NVIDIA API proxy failed, returning common NVIDIA models");
    return [
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "nvidia/llama-3.1-nemotron-8b-instruct",
      "nvidia/llama-3.3-nemotron-70b-instruct",
      "deepseek-ai/deepseek-r1-0528",
      "meta/llama-3.3-70b-instruct",
      "mistralai/mistral-7b-instruct"
    ];
  }
};

export const generateStoryResponse = async (
  userMessage: string,
  history: { role: string; content: string }[],
  temperature: number = 0.7,
  top_p: number = 0.7,
  max_tokens: number = 63024,
  systemInstructionOverride?: string,
  apiKey?: string,
  model: string = "deepseek-ai/deepseek-r1-0528",
  onUpdate?: (partial: { segment: StorySegment; reasoning?: string }) => void
): Promise<{ segment: StorySegment; reasoning?: string }> => {
  try {
    const messages = [
      { role: 'system', content: systemInstructionOverride || '' },
      ...history.map(h => ({
        role: (h.role === 'model' ? 'assistant' : h.role) as 'user' | 'assistant' | 'system',
        content: h.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Always use NVIDIA API through proxy
    const baseUrl = '/api/nvidia';
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        top_p: top_p,
        max_tokens: max_tokens,
        stream: true // ENABLE STREAMING
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    if (!response.body) throw new Error("Response body is null");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let fullReasoning = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices[0]?.delta;

            if (delta?.content) {
              fullContent += delta.content;
            }
            if (delta?.reasoning_content) {
              fullReasoning += delta.reasoning_content;
            }

            // Parse partial JSON and notify UI
            if (onUpdate) {
              // Clean up potential markdown code blocks for parsing
              let jsonString = fullContent;
              if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/^```json\n?/, '');
              } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```\n?/, '');
              }

              try {
                const partialSegment = parsePartialJson(jsonString);
                onUpdate({ segment: partialSegment, reasoning: fullReasoning });
              } catch (parseError) {
                // Silently ignore parse errors for partial content
                console.debug('Partial JSON parse error (expected for streaming):', parseError);
              }
            }

          } catch (e) {
            // Ignore parse errors for individual chunks, but log for debugging
            console.debug('Stream chunk parse error:', e, 'Line:', line);
          }
        }
      }
    }

    // Final Parse - with better error handling
    let jsonString = fullContent.trim();
    let parsed: any;
    
    try {
      // Try to extract JSON from markdown code blocks first
      if (jsonString.includes('```json')) {
        const jsonMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1];
        }
      } else if (jsonString.includes('```')) {
        const codeMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          jsonString = codeMatch[1];
        }
      }

      // Try to find the first valid JSON object
      let firstBrace = jsonString.indexOf('{');
      let lastBrace = jsonString.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }

      parsed = JSON.parse(jsonString);

    } catch (parseError) {
      console.error('Final JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonString);
      
      // Return a fallback segment with the raw content
      return {
        segment: {
          content: [{ type: 'narration', text: fullContent }],
          sceneVisualPrompt: "",
          reasoning: fullReasoning,
          narration: fullContent,
          dialogue: []
        },
        reasoning: `Parse error: ${parseError.message}`
      };
    }

    const storySegment: StorySegment = {
      content: parsed.content || [],
      sceneVisualPrompt: parsed.sceneVisualPrompt || "",
      reasoning: fullReasoning,
      narration: parsed.narration,
      dialogue: parsed.dialogue
    };
    // Normalize: if content is empty but narration/dialogue exist (old format), populate content
    if (!storySegment.content || storySegment.content.length === 0) {
      storySegment.content = [];
      if (storySegment.narration) {
        storySegment.content.push({ type: 'narration', text: storySegment.narration });
      }
      if (storySegment.dialogue && Array.isArray(storySegment.dialogue)) {
        storySegment.dialogue.forEach((d: any) => {
          storySegment.content.push({ type: 'dialogue', character: d.character, text: d.text });
        });
      }
    }

    return {
      segment: storySegment,
      reasoning: fullReasoning
    };

  } catch (error: any) {
    console.error("Error generating story with API:", error);
    let errorMessage = error.message || 'Unknown error';
    let errorDetails = JSON.stringify(error);

    // Since we only support NVIDIA API now, provide specific NVIDIA error message
    errorMessage = `NVIDIA API Error: ${errorMessage}. Please check your API key and ensure the NVIDIA API is accessible.`;
    errorDetails += " | Hint: Make sure you have a valid NVIDIA API key configured in settings.";

    return {
      segment: {
        content: [
          { type: 'narration', text: "The connection to the story world seems unstable..." },
          { type: 'dialogue', character: "System", text: errorMessage }
        ],
        narration: "The connection to the story world seems unstable...",
        dialogue: [{ character: "System", text: errorMessage }],
        sceneVisualPrompt: "Static noise and glitchy background"
      },
      reasoning: `Error details: ${errorDetails}`
    };
  }
};