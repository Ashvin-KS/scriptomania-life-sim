import { SessionAPIConfig } from '../types';

export function resolveAPIConfig(
    sessionConfig: SessionAPIConfig | undefined,
    globalConfig: {
        endpoint: string;
        apiKey: string;
        model: string;
        temperature: number;
        topP: number;
        maxTokens: number;
        maxSpeakers: number;
        minWords: number;
        maxWords: number;
    }
) {
    if (!sessionConfig || sessionConfig.useGlobalDefaults) {
        return globalConfig;
    }

    return {
        endpoint: sessionConfig.endpoint || globalConfig.endpoint,
        apiKey: sessionConfig.apiKey || globalConfig.apiKey,
        model: sessionConfig.model || globalConfig.model,
        temperature: sessionConfig.temperature ?? globalConfig.temperature,
        topP: sessionConfig.topP ?? globalConfig.topP,
        maxTokens: sessionConfig.maxTokens ?? globalConfig.maxTokens,
        maxSpeakers: sessionConfig.maxSpeakers ?? globalConfig.maxSpeakers,
        minWords: sessionConfig.minWords ?? globalConfig.minWords,
        maxWords: sessionConfig.maxWords ?? globalConfig.maxWords,
    };
}