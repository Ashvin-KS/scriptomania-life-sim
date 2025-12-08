import { StorySegment } from '../types';
import { parsePartialJson } from '../utils/partialJsonParser';

export const fetchModels = async (endpoint?: string, apiKey?: string): Promise<string[]> => {
  try {
    // If endpoint is provided, use it. Otherwise, return empty array.
    let baseUrl = endpoint ? endpoint.replace(/\/$/, '') : '/api/nvidia';

    // Handle proxy paths - these should go through Vite's proxy configuration
    if (baseUrl.includes('/api/nvidia')) {
      // Use the proxy path directly, don't replace with actual API URL
      // The Vite proxy will handle the routing to the actual NVIDIA API
      baseUrl = '/api/nvidia';
    } else if (baseUrl.includes('/api/lmstudio') || baseUrl.includes('/api/lm-studio')) {
      baseUrl = '/api/lmstudio';
    } else if (baseUrl.includes('/api/ollama')) {
      baseUrl = '/api/ollama';
    }

    // For production environments (like Netlify), we need special handling
    // Check if we're in a production environment and trying to access external APIs
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // In production, only allow proxy paths or local servers
      if (!baseUrl.startsWith('/api/') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
        console.warn("Production environment: Only proxy paths and local servers are supported");
        return [];
      }
    }

    // Auto-fix for LM Studio common mistake (only for non-proxy URLs)
    if (!baseUrl.startsWith('/api/') && baseUrl.includes(':1234') && !baseUrl.includes('/v1')) {
      baseUrl += '/v1';
    }
    const url = `${baseUrl}/models`;

    if (!url) {
      return [];
    }

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

    // Fallback for local servers that might fail CORS or OPTIONS but still work for chat
    if (endpoint && (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'))) {
      console.warn("Local server fetch failed, returning default local model list");
      return [
        "llama3",
        "mistral",
        "gemma",
        "qwen",
        "deepseek-r1",
        "local-model"
      ];
    }

    // Fallback for production environments where proxy might fail
    if (endpoint && endpoint.includes('/api/nvidia')) {
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

    return [];
  }
};

export const generateStoryResponse = async (
  userMessage: string,
  history: { role: string; content: string }[],
  temperature: number = 0.7,
  top_p: number = 0.7,
  max_tokens: number = 63024,
  systemInstructionOverride?: string,
  apiEndpoint?: string,
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

    // Use provided endpoint or return error
    let baseUrl = apiEndpoint ? apiEndpoint.replace(/\/$/, '') : '/api/nvidia';

    // Handle proxy paths - these should go through Vite's proxy configuration
    if (baseUrl.includes('/api/nvidia')) {
      // Use the proxy path directly, don't replace with actual API URL
      // The Vite proxy will handle the routing to the actual NVIDIA API
      baseUrl = '/api/nvidia';
    } else if (baseUrl.includes('/api/lmstudio') || baseUrl.includes('/api/lm-studio')) {
      baseUrl = '/api/lmstudio';
    } else if (baseUrl.includes('/api/ollama')) {
      baseUrl = '/api/ollama';
    }

    // For production environments (like Netlify), we need special handling
    // Check if we're in a production environment and trying to access external APIs
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // In production, only allow proxy paths or local servers
      if (!baseUrl.startsWith('/api/') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
        throw new Error("Production environment: Only proxy paths and local servers are supported. Please use /api/nvidia, /api/lmstudio, or /api/ollama endpoints.");
      }
    }

    // Auto-fix for LM Studio common mistake (only for non-proxy URLs)
    if (!baseUrl.startsWith('/api/') && baseUrl.includes(':1234') && !baseUrl.includes('/v1')) {
      baseUrl += '/v1';
    }
    const url = `${baseUrl}/chat/completions`;

    if (!url) {
      throw new Error("No API endpoint provided. Please configure your API settings.");
    }

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

              const partialSegment = parsePartialJson(jsonString);
              onUpdate({ segment: partialSegment, reasoning: fullReasoning });
            }

          } catch (e) {
            // Ignore parse errors for individual chunks
          }
        }
      }
    }

    // Final Parse
    let jsonString = fullContent.trim();
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

    const parsed = JSON.parse(jsonString);
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

    if (apiEndpoint && (apiEndpoint.includes('localhost') || apiEndpoint.includes('127.0.0.1'))) {
      errorMessage = `Local Server Error: ${errorMessage}. Ensure your local server (Ollama/LM Studio) is running and CORS is enabled.`;
      errorDetails += " | Hint: For Ollama, set OLLAMA_ORIGINS='*' env var. For LM Studio, enable CORS in settings.";
    }

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