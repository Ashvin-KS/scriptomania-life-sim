import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateStoryResponse, fetchModels } from './services/nvidiaService';
import { generateSystemPrompt, generateSystemPromptWithContent } from './utils/promptGenerator';
import { resolveAPIConfig } from './utils/sessionApi';
import { ChatMessage, ChatSession, Character, SessionAPIConfig, PresetTemplate, ChatBackground } from './types';
import { DEFAULT_CHARACTERS, SYSTEM_INSTRUCTIONS, PRESET_TEMPLATES } from './constants';
import BackgroundCollage from './components/BackgroundCollage';
import ChatBubble from './components/ChatBubble';
import Sidebar from './components/Sidebar';


const MAX_CONTEXT_MESSAGES = 50;

const App: React.FC = () => {
  // --- State: Sessions & Characters ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    return saved ? JSON.parse(saved) : [{
      id: Date.now().toString(),
      name: 'New Story',
      messages: [],
      lastModified: Date.now(),
      instructionId: SYSTEM_INSTRUCTIONS[0].id
    }];
  });



  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('current_session_id');
    return saved || sessions[0]?.id;
  });

  // Derived State
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;

  // Unified Character State (Editable)
  const [allCharacters, setAllCharacters] = useState<Character[]>(() => {
    // 1. Try to load unified characters
    const savedUnified = localStorage.getItem('storymate_characters');
    if (savedUnified) {
      return JSON.parse(savedUnified);
    }

    // 2. Migration: Load old custom characters and merge with defaults
    const savedCustom = localStorage.getItem('custom_characters');
    const oldCustomChars: Character[] = savedCustom ? JSON.parse(savedCustom) : [];

    // Initialize defaults with gallery
    const defaultsWithGallery = DEFAULT_CHARACTERS.map(c => ({
      ...c,
      gallery: c.gallery || [c.avatar]
    }));

    // Initialize custom with gallery
    const customWithGallery = oldCustomChars.map(c => ({
      ...c,
      gallery: c.gallery || [c.avatar]
    }));

    return [...defaultsWithGallery, ...customWithGallery];
  });

  // User Profile State
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      return JSON.parse(saved);
    }
    // Create a more engaging default profile
    const defaultProfile = {
      name: 'Story Lover',
      famous: 'Having an amazing imagination and love for character-driven stories',
      lifeDetails: 'I enjoy watching how different personalities interact, love deep conversations, and get excited when characters reveal their true selves. I appreciate good storytelling and character development.'
    };
    // Save it immediately so users see it working
    localStorage.setItem('user_profile', JSON.stringify(defaultProfile));
    return defaultProfile;
  });

  // --- State: UI & Settings ---
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [isEditingBackground, setIsEditingBackground] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'chat' | 'api' | 'templates' | 'profile' | 'situations'>('chat');

  // Custom Templates
  const [customTemplates, setCustomTemplates] = useState<typeof SYSTEM_INSTRUCTIONS>(() => {
    const saved = localStorage.getItem('custom_templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [generatedTemplateContent, setGeneratedTemplateContent] = useState('');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // Settings
  const [temperature, setTemperature] = useState(0.85);
  const [topP, setTopP] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [showThinking, setShowThinking] = useState(true);
  const [maxSpeakers, setMaxSpeakers] = useState(7);
  const [minWords, setMinWords] = useState(20);
  const [maxWords, setMaxWords] = useState(100);
  const [fontSize, setFontSize] = useState(16);
  const [apiEndpoint, setApiEndpoint] = useState(() => {
    const saved = localStorage.getItem('api_endpoint');
    return saved || '';
  });
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('api_key');
    return saved || '';
  });
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('model');
    return saved || 'moonshotai/kimi-k2-instruct';
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  // customInstruction is now part of currentSession

  // Creation Mode State
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [creationMode, setCreationMode] = useState<'quick' | 'custom' | null>(null);
  const [creationStep, setCreationStep] = useState(1);
  const [creationSelectedIds, setCreationSelectedIds] = useState<string[]>([]);
  const [creationScenarioId, setCreationScenarioId] = useState(SYSTEM_INSTRUCTIONS[0].id);
  const [creationSituationId, setCreationSituationId] = useState<string>('');
  const [creationAPIConfig, setCreationAPIConfig] = useState<SessionAPIConfig>({
    useGlobalDefaults: true
  });
  const [creationChatName, setCreationChatName] = useState('');

  // Track mount time to prevent animating old messages
  const [mountTime] = useState(() => Date.now());

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  // Close session menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setShowSessionMenu(false);
      }
    };

    if (showSessionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSessionMenu]);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('current_session_id', currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    localStorage.setItem('api_endpoint', apiEndpoint);
  }, [apiEndpoint]);

  useEffect(() => {
    localStorage.setItem('api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('model', model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem('custom_templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  // User Profile Persistence
  useEffect(() => {
    localStorage.setItem('user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Character Persistence
  useEffect(() => {
    localStorage.setItem('storymate_characters', JSON.stringify(allCharacters));
  }, [allCharacters]);

  // Combine default and custom templates
  const allTemplates = useMemo(() => [...SYSTEM_INSTRUCTIONS, ...customTemplates], [customTemplates]);

  const [allTemplatesState, setAllTemplatesState] = useState(allTemplates);

  useEffect(() => {
    setAllTemplatesState([...SYSTEM_INSTRUCTIONS, ...customTemplates]);
  }, [customTemplates]);

  const handleUpdateTemplate = (updatedTemplate: any) => {
    const newTemplates = allTemplatesState.map(t => t.id === updatedTemplate.id ? updatedTemplate : t);
    setAllTemplatesState(newTemplates);

    // also update custom templates if the updated one is a custom one
    const newCustomTemplates = newTemplates.filter(t => t.id.startsWith('custom_'));
    setCustomTemplates(newCustomTemplates);
  };

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 150);
    }
  }, [messages]);

  // Close model dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // Auto-fetch models when settings open
  useEffect(() => {
    if (showSettings) {
      const loadModels = async () => {
        setIsFetchingModels(true);
        const models = await fetchModels(apiEndpoint, apiKey);
        setAvailableModels(models);
        setIsFetchingModels(false);
      };
      loadModels();
    }
  }, [showSettings]);


  // --- Handlers ---

  const handleNewSession = () => {
    setIsCreatingSession(true);
    setCreationMode(null); // Show mode selector
    setCreationStep(1);
    setCreationSelectedIds([]);
    setCreationScenarioId(SYSTEM_INSTRUCTIONS[0].id);
    setCreationAPIConfig({ useGlobalDefaults: true });
    setCreationChatName('');
    setIsSidebarOpen(false);
  };

  const handleStartChat = () => {
    // Deep copy characters to ensure no reference sharing
    const selectedChars = allCharacters
      .filter(c => creationSelectedIds.includes(c.id))
      .map(c => ({ ...c }));

    // Use selected scenario
    const finalInstruction = creationScenarioId;
    const finalCustomInstruction: string | undefined = undefined;

    // Find selected situation object if present
    const selectedTemplate = allTemplates.find(t => t.id === creationScenarioId);
    const selectedSituationObj = selectedTemplate && (selectedTemplate as any).situations
      ? (selectedTemplate as any).situations.find((s: any) => s.id === creationSituationId)
      : undefined;

    // Generate pre-narration message if template has one
    let initialMessages: ChatMessage[] = [];
    if (selectedTemplate?.preNarration) {
      // Replace character placeholders in pre-narration
      const characterNames = selectedChars.map(c => c.name).join(', ');
      const preNarrationText = selectedTemplate.preNarration.replace(/{{CHARACTERS}}/g, characterNames);
      
      const preNarrationMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        structuredContent: {
          content: [{ type: 'narration', text: preNarrationText }],
          sceneVisualPrompt: ""
        },
        reasoning: "",
        timestamp: Date.now(),
      };
      initialMessages = [preNarrationMessage];
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: creationChatName || `Story ${sessions.length + 1}`,
      messages: initialMessages,
      lastModified: Date.now(),
      instructionId: finalInstruction,
      characters: selectedChars,
      customInstruction: finalCustomInstruction,
      apiConfig: creationAPIConfig,
      selectedSituation: selectedSituationObj
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsCreatingSession(false);
    setCreationMode(null);
  };

  const handleQuickStartPreset = (preset: PresetTemplate) => {
    const selectedChars = DEFAULT_CHARACTERS
      .filter(c => preset.characterIds.includes(c.id))
      .map(c => ({ ...c }));

    // Find the template to get pre-narration
    const selectedTemplate = allTemplates.find(t => t.id === preset.scenarioId);

    // Generate pre-narration message if template has one
    let initialMessages: ChatMessage[] = [];
    if (selectedTemplate?.preNarration) {
      // Replace character placeholders in pre-narration
      const characterNames = selectedChars.map(c => c.name).join(', ');
      const preNarrationText = selectedTemplate.preNarration.replace(/{{CHARACTERS}}/g, characterNames);
      
      const preNarrationMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        structuredContent: {
          content: [{ type: 'narration', text: preNarrationText }],
          sceneVisualPrompt: ""
        },
        reasoning: "",
        timestamp: Date.now(),
      };
      initialMessages = [preNarrationMessage];
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: preset.name,
      messages: initialMessages,
      lastModified: Date.now(),
      instructionId: preset.scenarioId,
      characters: selectedChars,
      apiConfig: preset.apiConfig
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsCreatingSession(false);
    setCreationMode(null);
  };

  const handleGenerateTemplateContent = async () => {
    if (!newTemplatePrompt.trim()) {
      alert('Please describe what you want the AI to do!');
      return;
    }

    setIsGeneratingTemplate(true);
    try {
      const prompt = `You are an expert at creating detailed system instructions for roleplay AI. 
The user wants: ${newTemplatePrompt}

Generate ONLY the content portion of a system instruction template. This should:
1. Define the scenario clearly
2. Specify the tone and behavior
3. Include any special rules or sequences
4. Use placeholders like {{COUNT_WORD}} where the number of characters will be inserted
5. Be detailed and specific

Output ONLY the instruction text, no JSON, no code, no explanations.`;

      const response = await fetch((apiEndpoint || '/api/nvidia') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey || ''}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      setGeneratedTemplateContent(content.trim());
    } catch (error) {
      console.error('Template generation failed:', error);
      alert('Failed to generate template. Please try again.');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!newTemplateLabel.trim()) {
      alert('Please enter a label for the template!');
      return;
    }
    if (!generatedTemplateContent.trim()) {
      alert('Please generate or enter template content!');
      return;
    }

    // Generate pre-narration for the custom template
    const preNarrationPrompt = `Based on this template content, generate a compelling opening narration that sets the scene and atmosphere. The narration should be descriptive and immersive, suitable for the beginning of a story. Use placeholder {{CHARACTERS}} where character names should be inserted.

Template content: ${generatedTemplateContent}

Generate ONLY the narration text, no explanations or formatting.`;

    // Generate pre-narration asynchronously
    fetch((apiEndpoint || '/api/nvidia') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || ''}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: preNarrationPrompt }],
        temperature: 0.8,
        max_tokens: 500,
        stream: false
      })
    })
    .then(response => response.json())
    .then(data => {
      const preNarration = data.choices[0]?.message?.content?.trim() || '';
      
      const newTemplate = {
        id: `custom_${Date.now()}`,
        label: newTemplateLabel,
        content: generatedTemplateContent,
        preNarration: preNarration || `The scene is set for ${newTemplateLabel}. {{CHARACTERS}} find themselves in a compelling situation that promises interesting interactions.`
      };

      setCustomTemplates(prev => [...prev, newTemplate]);
      setIsCreatingTemplate(false);
      setNewTemplateLabel('');
      setNewTemplatePrompt('');
      setGeneratedTemplateContent('');
    })
    .catch(error => {
      console.error('Pre-narration generation failed:', error);
      // Save template without pre-narration as fallback
      const newTemplate = {
        id: `custom_${Date.now()}`,
        label: newTemplateLabel,
        content: generatedTemplateContent
      };

      setCustomTemplates(prev => [...prev, newTemplate]);
      setIsCreatingTemplate(false);
      setNewTemplateLabel('');
      setNewTemplatePrompt('');
      setGeneratedTemplateContent('');
    });
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setCustomTemplates(prev => prev.filter(t => t.id !== id));
    }
  };


  const handleToggleCreationSelection = (id: string) => {
    setCreationSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(pid => pid !== id);
      return [...prev, id];
    });
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return; // Prevent deleting last session
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions[0].id);
    }
  };

  const handleAddCharacter = (char: Character) => {
    // Add to global characters list
    setAllCharacters(prev => [...prev, char]);

    // Also add to current session if active
    if (currentSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const currentChars = s.characters || [];
          // Avoid duplicates
          if (currentChars.find(c => c.id === char.id)) return s;
          return { ...s, characters: [...currentChars, char], lastModified: Date.now() };
        }
        return s;
      }));
    }
  };

  const handleUpdateCharacter = (updatedChar: Character) => {
    setAllCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));

    // Optional: Update in current session if present
    if (currentSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId && s.characters) {
          return {
            ...s,
            characters: s.characters.map(c => c.id === updatedChar.id ? updatedChar : c)
          };
        }
        return s;
      }));
    }
  };

  const handleDeleteCharacter = (charId: string) => {
    setAllCharacters(prev => prev.filter(c => c.id !== charId));
  };

  const handleRemoveCharacterFromSession = (charId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          characters: (s.characters || []).filter(c => c.id !== charId),
          lastModified: Date.now()
        };
      }
      return s;
    }));
  };

  const handleAddCharacterToSession = (char: Character) => {
    if (currentSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const currentChars = s.characters || [];
          if (currentChars.find(c => c.id === char.id)) return s;
          return { ...s, characters: [...currentChars, char], lastModified: Date.now() };
        }
        return s;
      }));
    }
  };

  const updateCurrentSession = (updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, ...updates, lastModified: Date.now() } : s
    ));
  };

  const handleUpdateUserProfile = (updates: Partial<typeof userProfile>) => {
    const newProfile = { ...userProfile, ...updates };
    setUserProfile(newProfile);

    // Live update the current session's instruction to reflect profile changes immediately
    const generated = generateSystemPrompt(
      currentSession.characters || [],
      currentSession.instructionId,
      maxSpeakers,
      minWords,
      maxWords,
      newProfile,
      currentSession.selectedSituation?.content
    );
    updateCurrentSession({ customInstruction: generated });
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    // NEW: Check if session has at least 1 character
    const sessionCharacters = currentSession.characters || [];
    if (sessionCharacters.length === 0) {
      alert('Please add at least one character to this chat before sending messages.\n\nOpen the sidebar and select characters to add them to the scene.');
      return;
    }

    const userText = input.trim();
    setInput('');
    setIsSending(true);

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    // Optimistic update
    const updatedMessages = [...messages, newUserMessage];
    updateCurrentSession({ messages: updatedMessages });

    try {
      const messageWithContext = userText;

      // Use 'messages' (previous history) instead of 'updatedMessages' to avoid duplicating the current user message
      // SLIDING WINDOW: Only send the last N messages to avoid token limits
      const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

      const historyForApi = recentMessages.map(m => ({
        role: m.role,
        content: m.role === 'user' ? m.content! : JSON.stringify(m.structuredContent)
      }));

      // Use custom instruction if set, otherwise generate dynamic prompt
      let currentInstruction = currentSession.customInstruction?.trim();

      if (!currentInstruction) {
        // If no custom instruction, generate one based on session characters
        // Fallback to DEFAULT_CHARACTERS if session has no characters (migration/legacy support)
        const sessionCharacters = (currentSession.characters && currentSession.characters.length > 0)
          ? currentSession.characters
          : DEFAULT_CHARACTERS;

        // Always include user profile in system instructions
        currentInstruction = generateSystemPrompt(sessionCharacters, currentSession.instructionId, maxSpeakers, minWords, maxWords, userProfile);
      }

      // Resolve API configuration for this session
      const effectiveConfig = resolveAPIConfig(
        currentSession.apiConfig,
        {
          endpoint: apiEndpoint,
          apiKey,
          model,
          temperature,
          topP,
          maxTokens,
          maxSpeakers,
          minWords,
          maxWords
        }
      );

      // Create placeholder message immediately
      const placeholderId = (Date.now() + 1).toString();
      const placeholderMessage: ChatMessage = {
        id: placeholderId,
        role: 'model',
        structuredContent: { content: [{ type: 'narration', text: "..." }], sceneVisualPrompt: "" },
        reasoning: "",
        timestamp: Date.now(),
      };

      // Add placeholder to UI
      const messagesWithPlaceholder = [...updatedMessages, placeholderMessage];
      updateCurrentSession({ messages: messagesWithPlaceholder });

      const { segment, reasoning } = await generateStoryResponse(
        messageWithContext, // Send message with character context
        historyForApi,
        effectiveConfig.temperature,
        effectiveConfig.topP,
        effectiveConfig.maxTokens,
        currentInstruction,
        effectiveConfig.endpoint,
        effectiveConfig.apiKey,
        effectiveConfig.model,
        (partial) => {
          // STREAMING UPDATE
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const msgs = s.messages.map(m => {
                if (m.id === placeholderId) {
                  return {
                    ...m,
                    structuredContent: partial.segment,
                    reasoning: partial.reasoning
                  };
                }
                return m;
              });
              return { ...s, messages: msgs, lastModified: Date.now() };
            }
            return s;
          }));
        }
      );

      // Final update to ensure consistency
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = s.messages.map(m => {
            if (m.id === placeholderId) {
              return {
                ...m,
                structuredContent: segment,
                reasoning: reasoning
              };
            }
            return m;
          });
          return { ...s, messages: msgs, lastModified: Date.now() };
        }
        return s;
      }));

    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRenameSession = (id: string, newName: string) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, name: newName, lastModified: Date.now() } : s
    ));
  };

  const handleUndo = () => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        // Remove last 2 messages (User + AI)
        // If odd number (e.g. user sent but AI failed), remove 1
        // But usually we want to remove the last "turn"
        const newMessages = s.messages.slice(0, -2);
        return { ...s, messages: newMessages, lastModified: Date.now() };
      }
      return s;
    }));
    setShowSessionMenu(false);
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the entire chat history? This cannot be undone.')) {
      updateCurrentSession({ messages: [] });
      setShowSessionMenu(false);
    }
  };

  const handleRetry = async (failedMessageId: string) => {
    if (isSending) return;

    // 1. Find the failed message and remove it
    const failedMsgIndex = messages.findIndex(m => m.id === failedMessageId);
    if (failedMsgIndex === -1) return;

    const messagesAfterRemoval = messages.filter(m => m.id !== failedMessageId);
    updateCurrentSession({ messages: messagesAfterRemoval });

    // 2. Find the last user message (trigger)
    const lastUserMsg = messagesAfterRemoval[messagesAfterRemoval.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    setIsSending(true);
    try {
      const userText = lastUserMsg.content || "";

      // History is everything BEFORE the last user message
      const historyMessages = messagesAfterRemoval.slice(0, -1);
      // SLIDING WINDOW: Only send the last N messages
      const recentHistory = historyMessages.slice(-MAX_CONTEXT_MESSAGES);

      const historyForApi = recentHistory.map(m => ({
        role: m.role,
        content: m.role === 'user' ? m.content! : JSON.stringify(m.structuredContent)
      }));

      // Use custom instruction if set, otherwise generate      // Build prompt if not custom
      let currentInstruction = currentSession.customInstruction;
      if (!currentInstruction) {
        const sessionCharacters = currentSession.characters && currentSession.characters.length > 0
          ? currentSession.characters
          : DEFAULT_CHARACTERS;
        currentInstruction = generateSystemPrompt(sessionCharacters, currentSession.instructionId, maxSpeakers, minWords, maxWords, userProfile);
      }

      // Create placeholder message immediately
      const placeholderId = Date.now().toString();
      const placeholderMessage: ChatMessage = {
        id: placeholderId,
        role: 'model',
        structuredContent: { content: [{ type: 'narration', text: "..." }], sceneVisualPrompt: "" },
        reasoning: "",
        timestamp: Date.now(),
      };

      // Add placeholder to UI
      const messagesWithPlaceholder = [...messagesAfterRemoval, placeholderMessage];
      updateCurrentSession({ messages: messagesWithPlaceholder });

      const { segment, reasoning } = await generateStoryResponse(
        userText,
        historyForApi,
        temperature,
        topP,
        maxTokens,
        currentInstruction,
        apiEndpoint,
        apiKey,
        model,
        (partial) => {
          // STREAMING UPDATE
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const msgs = s.messages.map(m => {
                if (m.id === placeholderId) {
                  return {
                    ...m,
                    structuredContent: partial.segment,
                    reasoning: partial.reasoning
                  };
                }
                return m;
              });
              return { ...s, messages: msgs, lastModified: Date.now() };
            }
            return s;
          }));
        }
      );

      // Final update
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = s.messages.map(m => {
            if (m.id === placeholderId) {
              return {
                ...m,
                structuredContent: segment,
                reasoning: reasoning
              };
            }
            return m;
          });
          return { ...s, messages: msgs, lastModified: Date.now() };
        }
        return s;
      }));

    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMessage = messages[msgIndex];

    // Only allow jumping to user messages
    if (targetMessage.role !== 'user') return;

    // Fill input with the user's message content
    setInput(targetMessage.content || '');

    // Delete this message and everything after it
    const newMessages = messages.slice(0, msgIndex);
    updateCurrentSession({ messages: newMessages });

    // Focus the input so user can edit right away
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // --- Render Helpers ---
  const getSlotStyle = (index: number, total: number) => {
    // Distribute across bottom
    // If 1: center
    // If 2: left/right
    // If >2: spread
    if (total === 1) return { left: '50%', transform: 'translateX(-50%)' };

    // Calculate percentage position
    const step = 100 / (total - 1); // 0 to 100
    // But we want some padding from edges, say 10% to 90%
    if (total === 2) {
      return index === 0 ? { left: '0%' } : { right: '0%' };
    }

    const safeWidth = 80; // use 80% of width
    const start = 10;
    const pos = start + (index * (safeWidth / (total - 1)));
    return { left: `${pos}%`, transform: 'translateX(-50%)' };
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col font-sans overflow-hidden bg-black">

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSwitchSession={(id) => { setCurrentSessionId(id); setIsSidebarOpen(false); }}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onAddCharacter={handleAddCharacter}
        onUpdateCharacter={handleUpdateCharacter}
        onDeleteCharacter={handleDeleteCharacter}
        allCharacters={allCharacters}
        currentSessionCharacters={currentSession.characters || []}
        onAddCharacterToSession={handleAddCharacterToSession}
        onRemoveCharacterFromSession={handleRemoveCharacterFromSession}
      />

      {/* 1. Fullscreen Background Layer */}
      <BackgroundCollage
        key={isCreatingSession ? 'creation_mode' : currentSession.id}
        characters={isCreatingSession ? allCharacters : (currentSession.characters || [])}
        sessionId={isCreatingSession ? 'creation_mode' : currentSession.id}
        onCharacterClick={isCreatingSession ? handleToggleCreationSelection : undefined}
        selectionMode={isCreatingSession}
        selectedIds={creationSelectedIds}
        background={currentSession.background}
        onEditModeChange={setIsEditingBackground}
      />

      {/* Creation Mode UI Overlay */}
      {isCreatingSession && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 pointer-events-none">

          {/* Mode Selection Screen */}
          {creationMode === null && (
            <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-12 max-w-5xl w-full animate-slide-up">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-bold text-white">Create New Chat</h2>
                <button
                  onClick={() => { setIsCreatingSession(false); setCreationMode(null); }}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Mode Selection Buttons */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <button
                  onClick={() => setCreationMode('quick')}
                  className="group bg-gradient-to-br from-pink-600/30 to-purple-600/30 hover:from-pink-600/50 hover:to-purple-600/50 border-2 border-pink-500/30 hover:border-pink-500 rounded-2xl p-8 transition-all transform hover:scale-105"
                >
                  <div className="text-6xl mb-4">⚡</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Quick Start</h3>
                  <p className="text-white/70">Choose from preset templates</p>
                </button>
                <button
                  onClick={() => { setCreationMode('custom'); setCreationStep(1); }}
                  className="group bg-gradient-to-br from-blue-600/30 to-cyan-600/30 hover:from-blue-600/50 hover:to-cyan-600/50 border-2 border-blue-500/30 hover:border-blue-500 rounded-2xl p-8 transition-all transform hover:scale-105"
                >
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Custom Setup</h3>
                  <p className="text-white/70">Full customization wizard</p>
                </button>
              </div>
            </div>
          )}

          {/* Quick Start Mode */}
          {creationMode === 'quick' && (
            <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-12 max-w-6xl w-full animate-slide-up">
              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={() => setCreationMode(null)}
                  className="text-white/70 hover:text-white transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <h2 className="text-3xl font-bold text-white">Quick Start Templates</h2>
                <button
                  onClick={() => { setIsCreatingSession(false); setCreationMode(null); }}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {PRESET_TEMPLATES.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleQuickStartPreset(preset)}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-pink-500/50 rounded-2xl p-6 text-left transition-all transform hover:scale-105 group"
                  >
                    <div className="text-4xl mb-3">{preset.emoji}</div>
                    <h3 className="text-xl font-bold text-white mb-2">{preset.name}</h3>
                    <p className="text-white/70 text-sm mb-4">{preset.description}</p>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{preset.characterIds.length} characters</span>
                      <span>•</span>
                      <span>{preset.apiConfig.useGlobalDefaults ? 'Default settings' : 'Custom settings'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Setup Mode - Multi-step */}
          {creationMode === 'custom' && (
            <div className="pointer-events-auto bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-10 max-w-6xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar animate-slide-up">
              {/* Header with Step Indicator */}
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  {creationStep > 1 && (
                    <button
                      onClick={() => setCreationStep(prev => prev - 1)}
                      className="text-white/70 hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  )}
                  <h2 className="text-3xl font-bold text-white">Custom Chat Setup</h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white/50 font-mono text-sm">Step {creationStep}/4</span>
                  <button
                    onClick={() => { setIsCreatingSession(false); setCreationMode(null); }}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Step 1: Scenario Selection */}
              {creationStep === 1 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white mb-4">Select Scenario Template</h3>
                  <p className="text-white/70">Choose a scenario template for your chat. You can customize the system instruction later in settings.</p>

                  <div>
                    <label className="block text-white font-bold mb-3">Scenario Template</label>
                    <select
                      value={creationScenarioId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreationScenarioId(val);
                        // default the situation to the first available for the selected template
                        const tpl = allTemplates.find(t => t.id === val) as any;
                        if (tpl && Array.isArray(tpl.situations) && tpl.situations.length > 0) {
                          setCreationSituationId(tpl.situations[0].id);
                        } else {
                          setCreationSituationId('');
                        }
                      }}
                      className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-pink-500"
                    >
                      {allTemplates.map(inst => (
                        <option key={inst.id} value={inst.id} className="bg-gray-900">{inst.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Situation Selection (if template defines situations) */}
                  {(() => {
                    const tpl = allTemplates.find(t => t.id === creationScenarioId) as any;
                    if (tpl && Array.isArray(tpl.situations) && tpl.situations.length > 0) {
                      return (
                        <div>
                          <label className="block text-white font-bold mb-3 mt-4">Situation</label>
                          <select
                            value={creationSituationId}
                            onChange={(e) => setCreationSituationId(e.target.value)}
                            className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-white focus:outline-none focus:border-pink-500"
                          >
                            {tpl.situations.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.title || s.brief || s.id}</option>
                            ))}
                          </select>
                          <p className="text-xs text-white/50 mt-1">Choose a specific situation for this scenario (optional).</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <button
                    onClick={() => setCreationStep(2)}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-6 py-4 rounded-xl transition-all"
                  >
                    Next: Select Characters
                  </button>
                </div>
              )}

              {/* Step 2: Character Selection */}
              {creationStep === 2 && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-white">Select Characters</h3>
                    <div className="flex items-center gap-4">
                      <span className="text-pink-400 font-mono">{creationSelectedIds.length} Selected</span>
                      <button
                        onClick={() => {
                          if (creationSelectedIds.length === allCharacters.length) {
                            setCreationSelectedIds([]);
                          } else {
                            setCreationSelectedIds(allCharacters.map(c => c.id));
                          }
                        }}
                        className="text-pink-400 hover:text-pink-300 transition-colors text-sm uppercase font-bold"
                      >
                        {creationSelectedIds.length === allCharacters.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                  <p className="text-white/70">Click characters on the background to select them, or use the buttons below. You can create with 0 characters and add them later from the sidebar.</p>

                  <div className="grid grid-cols-4 gap-4">
                    {allCharacters.map(char => (
                      <button
                        key={char.id}
                        onClick={() => handleToggleCreationSelection(char.id)}
                        className={`p-4 rounded-xl border-2 transition-all ${creationSelectedIds.includes(char.id)
                          ? 'border-pink-500 bg-pink-500/20'
                          : 'border-white/20 bg-white/5 hover:bg-white/10'
                          }`}
                      >
                        <img src={char.avatar} alt={char.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                        <p className="text-white font-bold text-sm">{char.name}</p>
                        <p className="text-white/50 text-xs">{char.role}</p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCreationStep(3)}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-6 py-4 rounded-xl transition-all"
                  >
                    Next: API Configuration
                  </button>
                </div>
              )}

              {/* Step 3: API Configuration */}
              {creationStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white mb-4">API Configuration</h3>

                  <div className="flex items-center gap-4 mb-6">
                    <input
                      type="checkbox"
                      id="useGlobalDefaults"
                      checked={creationAPIConfig.useGlobalDefaults}
                      onChange={(e) => setCreationAPIConfig({ ...creationAPIConfig, useGlobalDefaults: e.target.checked })}
                      className="w-5 h-5 accent-pink-500"
                    />
                    <label htmlFor="useGlobalDefaults" className="text-white font-bold">Use Global Defaults</label>
                  </div>

                  {!creationAPIConfig.useGlobalDefaults && (
                    <div className="space-y-4 bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-white text-sm font-bold mb-2">Temperature</label>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={creationAPIConfig.temperature ?? temperature}
                            onChange={(e) => setCreationAPIConfig({ ...creationAPIConfig, temperature: parseFloat(e.target.value) })}
                            className="w-full bg-black/50 border border-white/20 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-sm font-bold mb-2">Max Tokens</label>
                          <input
                            type="number"
                            min="1024"
                            max="32768"
                            step="1024"
                            value={creationAPIConfig.maxTokens ?? maxTokens}
                            onChange={(e) => setCreationAPIConfig({ ...creationAPIConfig, maxTokens: parseInt(e.target.value) })}
                            className="w-full bg-black/50 border border-white/20 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-sm font-bold mb-2">Min Words</label>
                          <input
                            type="number"
                            min="0"
                            max="500"
                            step="50"
                            value={creationAPIConfig.minWords ?? minWords}
                            onChange={(e) => setCreationAPIConfig({ ...creationAPIConfig, minWords: parseInt(e.target.value) })}
                            className="w-full bg-black/50 border border-white/20 rounded-lg p-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-white text-sm font-bold mb-2">Max Words</label>
                          <input
                            type="number"
                            min="50"
                            max="2000"
                            step="50"
                            value={creationAPIConfig.maxWords ?? maxWords}
                            onChange={(e) => setCreationAPIConfig({ ...creationAPIConfig, maxWords: parseInt(e.target.value) })}
                            className="w-full bg-black/50 border border-white/20 rounded-lg p-2 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setCreationStep(4)}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-6 py-4 rounded-xl transition-all"
                  >
                    Next: Review & Create
                  </button>
                </div>
              )}

              {/* Step 4: Review and Create */}
              {creationStep === 4 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-white mb-4">Review & Create</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-white font-bold mb-2">Chat Name</label>
                      <input
                        type="text"
                        value={creationChatName}
                        onChange={(e) => setCreationChatName(e.target.value)}
                        placeholder={`Story ${sessions.length + 1}`}
                        className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-white placeholder-white/50 focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-white/70">Scenario:</span>
                        <span className="text-white font-bold">{allTemplates.find(s => s.id === creationScenarioId)?.label || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">Characters:</span>
                        <span className="text-white font-bold">{creationSelectedIds.length} selected</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/70">API Config:</span>
                        <span className="text-white font-bold">{creationAPIConfig.useGlobalDefaults ? 'Global Defaults' : 'Custom Settings'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleStartChat}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xl font-bold px-8 py-5 rounded-xl shadow-[0_0_40px_rgba(236,72,153,0.5)] hover:shadow-[0_0_60px_rgba(236,72,153,0.7)] transition-all transform hover:scale-105 active:scale-95"
                  >
                    Create Chat
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}




      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 w-full max-w-2xl border border-white/20 ring-1 ring-white/10 text-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-white/70 hover:text-pink-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10 flex-wrap">
              <button
                onClick={() => setActiveSettingsTab('chat')}
                className={`px-4 py-2 font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeSettingsTab === 'chat' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
              >
                Chat Settings
              </button>
              <button
                onClick={() => setActiveSettingsTab('api')}
                className={`px-4 py-2 font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeSettingsTab === 'api' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
              >
                API Settings
              </button>
              <button
                onClick={() => setActiveSettingsTab('templates')}
                className={`px-4 py-2 font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeSettingsTab === 'templates' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveSettingsTab('profile')}
                className={`px-4 py-2 font-bold transition-all whitespace-nowrap flex-shrink-0 ${activeSettingsTab === 'profile' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-white/50 hover:text-white/80'}`}
              >
                User Profile
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {/* Chat Settings Tab */}
              {activeSettingsTab === 'chat' && (
                <div className="space-y-6">

                  {/* Scenario Selection */}
                  <div>
                    <label className="block text-sm font-bold mb-2">Scenario Template</label>
                    <select
                      value={currentSession.instructionId}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateCurrentSession({ instructionId: val });
                        // Load the template into custom instruction editor and reset selected situation if present
                        const selected = allTemplates.find(i => i.id === val) as any;
                        if (selected) {
                          // Pick first situation if exists
                          const firstSituation = Array.isArray(selected.situations) && selected.situations.length > 0 ? selected.situations[0] : undefined;
                          updateCurrentSession({ selectedSituation: firstSituation });

                          const generated = generateSystemPrompt(currentSession.characters || [], val, maxSpeakers, minWords, maxWords, userProfile, firstSituation?.content);
                          updateCurrentSession({ customInstruction: generated });
                        }
                      }}
                      className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                    >
                      {allTemplates.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Situation Selector for current template */}
                  {(() => {
                    const tpl = allTemplates.find(t => t.id === currentSession.instructionId) as any;
                    if (tpl && Array.isArray(tpl.situations) && tpl.situations.length > 0) {
                      return (
                        <div className="mt-4">
                          <label className="block text-sm font-bold mb-2">Selected Situation</label>
                          <select
                            value={currentSession.selectedSituation?.id || (tpl.situations[0] && tpl.situations[0].id) || ''}
                            onChange={(e) => {
                              const sid = e.target.value;
                              const sit = tpl.situations.find((s: any) => s.id === sid);
                              updateCurrentSession({ selectedSituation: sit });
                              // Regenerate instruction including situation
                              const generated = generateSystemPrompt(currentSession.characters || [], currentSession.instructionId, maxSpeakers, minWords, maxWords, userProfile, sit?.content);
                              updateCurrentSession({ customInstruction: generated });
                            }}
                            className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                          >
                            {tpl.situations.map((s: any) => (
                              <option key={s.id} value={s.id}>{s.title || s.brief || s.id}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Custom System Instruction Editor */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bold">Custom System Instruction</label>
                      <button
                        onClick={() => {
                          const selected = allTemplates.find(i => i.id === currentSession.instructionId);
                          if (selected) {
                            const generated = generateSystemPromptWithContent(currentSession.characters || [], selected.content, maxSpeakers, minWords, maxWords, userProfile);
                            updateCurrentSession({ customInstruction: generated });
                          }
                        }}
                        className="text-xs bg-pink-500/20 hover:bg-pink-500/40 text-pink-200 px-3 py-1 rounded-full transition-colors"
                      >
                        Regenerate from Characters
                      </button>
                    </div>
                    <textarea
                      value={currentSession.customInstruction || ''}
                      onChange={(e) => updateCurrentSession({ customInstruction: e.target.value })}
                      placeholder="Edit or write your custom system instruction here. Leave empty to auto-generate from template + characters."
                      className="w-full h-48 bg-black/30 border border-white/20 rounded-xl p-3 text-white text-sm focus:border-pink-500 focus:outline-none resize-none custom-scrollbar"
                    />
                    <p className="text-xs text-white/50 mt-1">💡 This instruction will be sent to the API. Edit freely to customize AI behavior. Chat history is NOT affected by regeneration.</p>

                    {/* Preview of Auto-Generated Instruction (if custom is empty) */}
                    {!currentSession.customInstruction && (
                      <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-xs text-white/70 font-bold mb-2">📋 Auto-Generated Preview (will be used if you leave the field empty):</p>
                        <pre className="text-xs text-white/60 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                          {/* Always show preview with user profile */}
                          {generateSystemPrompt(currentSession.characters || [], currentSession.instructionId, maxSpeakers, minWords, maxWords, userProfile)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Max Speakers */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Max Speakers per Reply</span>
                      <span className="text-pink-300">{maxSpeakers}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="7"
                      step="1"
                      value={maxSpeakers}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMaxSpeakers(val);
                        // Auto-regenerate prompt when this changes
                        // Always include user profile when regenerating from characters
                        const generated = generateSystemPrompt(currentSession.characters || [], currentSession.instructionId, val, minWords, maxWords, userProfile);
                        updateCurrentSession({ customInstruction: generated });
                      }}
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Word Count Control - Dual Range Slider */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Response Length (Words)</span>
                      <span className="text-pink-300">{minWords} - {maxWords}</span>
                    </label>
                    <div className="relative h-2 bg-white/20 rounded-lg">
                      {/* Track Fill */}
                      <div
                        className="absolute h-full bg-pink-500 rounded-lg"
                        style={{
                          left: `${(minWords / 2000) * 100}%`,
                          right: `${100 - (maxWords / 2000) * 100}%`
                        }}
                      />
                      {/* Min Slider */}
                      <input
                        type="range"
                        min="0"
                        max="2000"
                        step="50"
                        value={minWords}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val <= maxWords) {
                            setMinWords(val);
                            // Always include user profile when word count changes
                            const generated = generateSystemPrompt(currentSession.characters || [], currentSession.instructionId, maxSpeakers, val, maxWords, userProfile);
                            updateCurrentSession({ customInstruction: generated });
                          }
                        }}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-pink-400 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                      />
                      {/* Max Slider */}
                      <input
                        type="range"
                        min="0"
                        max="2000"
                        step="50"
                        value={maxWords}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= minWords) {
                            setMaxWords(val);
                            // Always include user profile when max words changes
                            const generated = generateSystemPrompt(currentSession.characters || [], currentSession.instructionId, maxSpeakers, minWords, val, userProfile);
                            updateCurrentSession({ customInstruction: generated });
                          }
                        }}
                        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-pink-400 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                      />
                    </div>
                    <p className="text-xs text-white/50 mt-2">💡 AI will write between {minWords} and {maxWords} words per response</p>
                  </div>

                  {/* Font Size Control */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Font Size (Base)</span>
                      <span className="text-pink-300">{fontSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold">Show Thinking Process</label>
                    <input
                      type="checkbox"
                      checked={showThinking}
                      onChange={(e) => setShowThinking(e.target.checked)}
                      className="w-5 h-5 accent-pink-500 rounded focus:ring-pink-500"
                    />
                  </div>

                  {/* Background Settings */}
                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <label className="text-sm font-bold">Background Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => updateCurrentSession({ background: { type: 'default' } })}
                        className={`py-2 text-xs rounded-lg border ${(!currentSession.background || currentSession.background.type === 'default') ? 'bg-pink-500 text-white border-pink-500' : 'bg-white/5 text-white/70 border-white/10'}`}
                      >
                        Collage
                      </button>
                      <button
                        onClick={() => updateCurrentSession({ background: { type: 'paper' } })}
                        className={`py-2 text-xs rounded-lg border ${currentSession.background?.type === 'paper' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white/5 text-white/70 border-white/10'}`}
                      >
                        Paper
                      </button>
                      <button
                        onClick={() => updateCurrentSession({ background: { type: 'custom', value: currentSession.background?.value || '' } })}
                        className={`py-2 text-xs rounded-lg border ${currentSession.background?.type === 'custom' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white/5 text-white/70 border-white/10'}`}
                      >
                        Custom
                      </button>
                    </div>

                    {currentSession.background?.type === 'custom' && (
                      <input
                        type="text"
                        placeholder="Image URL..."
                        value={currentSession.background.value || ''}
                        onChange={(e) => updateCurrentSession({ background: { ...currentSession.background!, value: e.target.value } })}
                        className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                      />
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        if (confirm('Clear chat history for this session?')) {
                          updateCurrentSession({ messages: [] });
                          setShowSettings(false);
                        }
                      }}
                      className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 rounded-xl font-bold transition-all"
                    >
                      Clear History
                    </button>
                  </div>
                </div>
              )}

              {/* API Settings Tab */}
              {activeSettingsTab === 'api' && (
                <div className="space-y-6">

                  {/* Quick Provider Presets */}
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <label className="block text-xs font-bold text-white/50 mb-2 uppercase">Quick Presets</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setApiEndpoint('/api/nvidia');
                          setApiKey('');
                        }}
                        className="flex-1 py-2 px-3 bg-green-900/30 hover:bg-green-900/50 border border-green-500/30 rounded-lg text-xs text-green-200 font-bold transition-all"
                      >
                        NVIDIA Cloud
                      </button>
                      <button
                        onClick={() => {
                          setApiEndpoint('/api/ollama');
                          setApiKey('ollama'); // Dummy key often needed
                          setModel('llama3'); // Common default
                        }}
                        className="flex-1 py-2 px-3 bg-orange-900/30 hover:bg-orange-900/50 border border-orange-500/30 rounded-lg text-xs text-orange-200 font-bold transition-all"
                      >
                        Ollama (Local)
                      </button>
                      <button
                        onClick={() => {
                          setApiEndpoint('/api/lmstudio');
                          setApiKey('lm-studio');
                        }}
                        className="flex-1 py-2 px-3 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 rounded-lg text-xs text-blue-200 font-bold transition-all"
                      >
                        LM Studio
                      </button>
                    </div>
                  </div>

                  {/* API Endpoint & Model */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">API Endpoint</label>
                      <div className="flex gap-2 mb-4 ">
                        <input
                          type="text"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                          placeholder="e.g., http://localhost:11434/v1"
                          className="flex-1 bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                        />
                        <button
                          onClick={async () => {
                            setIsFetchingModels(true);
                            const models = await fetchModels(apiEndpoint, apiKey);
                            setAvailableModels(models);
                            setIsFetchingModels(false);
                            if (models.length > 0 && !models.includes(model)) {
                              setModel(models[0]);
                            }
                          }}
                          disabled={isFetchingModels}
                          className="bg-white/10 hover:bg-white/20 text-white px-4 rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                          {isFetchingModels ? '...' : 'Fetch'}
                        </button>
                      </div>

                      <label className="block text-sm font-bold mb-2">API Key (Optional)</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none mb-4"
                      />
                    </div>

                    <div ref={modelDropdownRef} className="relative">
                      <label className="block text-sm font-bold mb-2">Model</label>
                      <div className="relative">
                        <input
                          ref={modelInputRef}
                          type="text"
                          value={model}
                          onChange={(e) => {
                            setModel(e.target.value);
                            setIsModelDropdownOpen(true);
                          }}
                          onFocus={() => setIsModelDropdownOpen(true)}
                          placeholder="e.g. deepseek-ai/deepseek-r1"
                          className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none pr-10"
                        />

                        {/* Clear Button */}
                        {model && (
                          <button
                            onClick={() => {
                              setModel('');
                              setIsModelDropdownOpen(true);
                              modelInputRef.current?.focus();
                            }}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Dropdown List */}
                      {isModelDropdownOpen && availableModels.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/20 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                          {availableModels
                            .filter(m => m.toLowerCase().includes(model.toLowerCase()))
                            .map(m => (
                              <button
                                key={m}
                                onClick={() => {
                                  setModel(m);
                                  setIsModelDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-pink-500/20 hover:text-pink-300 transition-colors border-b border-white/5 last:border-0"
                              >
                                {m}
                              </button>
                            ))}
                          {availableModels.filter(m => m.toLowerCase().includes(model.toLowerCase())).length === 0 && (
                            <div className="px-4 py-2 text-sm text-white/50 italic">
                              No matching models found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Params */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Temperature (Chaos)</span>
                      <span className="text-pink-300">{temperature}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Top P */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Top P (Diversity)</span>
                      <span className="text-pink-300">{topP}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <label className="flex justify-between text-sm font-bold mb-2">
                      <span>Max Tokens (Length)</span>
                      <span className="text-pink-300">{maxTokens}</span>
                    </label>
                    <input
                      type="range"
                      min="1024"
                      max="32768"
                      step="1024"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-pink-500 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Templates Tab */}
              {activeSettingsTab === 'templates' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Custom Templates</h3>
                    <button
                      onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
                      className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                    >
                      {isCreatingTemplate ? 'Cancel' : '+ New Template'}
                    </button>
                  </div>

                  {isCreatingTemplate && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                      <h4 className="text-white font-bold">Create New Template</h4>

                      <div>
                        <label className="block text-sm font-bold mb-2 text-white">Template Name</label>
                        <input
                          type="text"
                          value={newTemplateLabel}
                          onChange={(e) => setNewTemplateLabel(e.target.value)}
                          placeholder="e.g., Epic Space Adventure"
                          className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2 text-white">Describe What You Want</label>
                        <textarea
                          value={newTemplatePrompt}
                          onChange={(e) => setNewTemplatePrompt(e.target.value)}
                          placeholder="e.g., A cyberpunk detective story where the characters are hackers investigating corporate crimes..."
                          className="w-full h-24 bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none resize-none"
                        />
                        <button
                          onClick={handleGenerateTemplateContent}
                          disabled={isGeneratingTemplate || !newTemplatePrompt.trim()}
                          className="mt-2 w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                        >
                          {isGeneratingTemplate ? 'Generating...' : '✨ Generate with AI'}
                        </button>
                      </div>

                      {generatedTemplateContent && (
                        <div>
                          <label className="block text-sm font-bold mb-2 text-white">Generated Template Content</label>
                          <textarea
                            value={generatedTemplateContent}
                            onChange={(e) => setGeneratedTemplateContent(e.target.value)}
                            className="w-full h-64 bg-black/30 border border-white/20 rounded-xl p-3 text-white text-sm focus:border-pink-500 focus:outline-none resize-none custom-scrollbar font-mono"
                          />
                          <p className="text-xs text-white/50 mt-1">💡 You can edit this before saving</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveTemplate}
                          disabled={!newTemplateLabel.trim() || !generatedTemplateContent.trim()}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                        >
                          Save Template
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingTemplate(false);
                            setNewTemplateLabel('');
                            setNewTemplatePrompt('');
                            setGeneratedTemplateContent('');
                          }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Template List */}
                  <div className="space-y-3">
                    <h4 className="text-white/70 font-bold text-sm uppercase">Default Templates</h4>
                    {SYSTEM_INSTRUCTIONS.map(template => (
                      <div key={template.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="text-white font-bold">{template.label}</h5>
                            <p className="text-white/50 text-xs mt-1">Built-in template</p>
                          </div>
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Default</span>
                        </div>
                      </div>
                    ))}

                    {customTemplates.length > 0 && (
                      <>
                        <h4 className="text-white/70 font-bold text-sm uppercase mt-6">Your Custom Templates</h4>
                        {customTemplates.map(template => (
                          <div key={template.id} className="bg-white/5 border border-pink-500/20 rounded-xl p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h5 className="text-white font-bold">{template.label}</h5>
                                <details className="mt-2">
                                  <summary className="text-white/50 text-xs cursor-pointer hover:text-white/70">View content...</summary>
                                  <pre className="text-white/60 text-xs mt-2 whitespace-pre-wrap bg-black/30 p-2 rounded max-h-40 overflow-y-auto custom-scrollbar">
                                    {template.content}
                                  </pre>
                                </details>
                              </div>
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="ml-4 text-red-400 hover:text-red-300 transition-colors"
                                title="Delete template"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {customTemplates.length === 0 && !isCreatingTemplate && (
                      <div className="text-center py-8 text-white/50">
                        <p>No custom templates yet.</p>
                        <p className="text-sm mt-1">Click "+ New Template" to create one.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* User Profile Tab */}
              {activeSettingsTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Your Profile</h3>
                    <p className="text-white/70 text-sm mb-6">Your profile details are included in system instructions to personalize the story experience.</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold mb-2">Your Name</label>
                        <input
                          type="text"
                          value={userProfile.name}
                          onChange={(e) => handleUpdateUserProfile({ name: e.target.value })}
                          placeholder="Enter your name"
                          className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2">What you're famous for</label>
                        <input
                          type="text"
                          value={userProfile.famous}
                          onChange={(e) => handleUpdateUserProfile({ famous: e.target.value })}
                          placeholder="e.g., Being an amazing storyteller, knowing everything about space, etc."
                          className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white focus:border-pink-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold mb-2">Life details & interests</label>
                        <textarea
                          value={userProfile.lifeDetails}
                          onChange={(e) => handleUpdateUserProfile({ lifeDetails: e.target.value })}
                          placeholder="Tell us about yourself - your interests, background, what you enjoy watching or learning about..."
                          className="w-full h-32 bg-black/30 border border-white/20 rounded-xl p-3 text-white text-sm focus:border-pink-500 focus:outline-none resize-none custom-scrollbar"
                        />
                        <p className="text-xs text-white/50 mt-1">💡 These details help the AI create more personalized interactions for you.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-xl font-bold hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Content Layer - Hidden during creation */}
      {!isCreatingSession && (
        <main className={`relative z-30 flex flex-col h-full w-full max-w-7xl mx-auto transition-all pointer-events-none ${isEditingBackground ? 'hidden' : ''}`}>

          {/* Header */}
          <header className="flex px-4 md:px-6 py-4 items-center justify-between z-40 pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="bg-black/30 backdrop-blur-xl border border-white/10 p-3 rounded-full text-white hover:bg-black/50 transition-all shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>

              <div className="bg-black/30 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg">
                <h1 className="text-xl font-bold text-white leading-none">{currentSession.name}</h1>
                {userProfile && userProfile.name !== 'User' && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></span>
                    <span className="text-xs text-pink-300 font-medium">{userProfile.name} Mode</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="group bg-black/30 backdrop-blur-xl border border-white/10 p-3 rounded-full text-white hover:bg-black/50 transition-all hover:rotate-90 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.43.816 1.035.79 1.696a17.843 17.843 0 000 3.758c.026.661-.295 1.266-.79 1.696m-5.323-8.08c.551.318.551 1.154 0 1.472l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069c.43.905.772 1.84.985 2.783" /></svg>
              </button>
            </div>
          </header>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col items-center justify-end overflow-hidden w-full relative">
            <div className="w-full max-w-2xl h-full flex flex-col pointer-events-auto z-40">
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 scroll-smooth space-y-6 no-scrollbar mask-image-linear-to-b pb-20"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-slide-up pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-xl p-8 rounded-[2rem] border border-white/20 shadow-2xl pointer-events-auto">
                      <h2 className="text-4xl font-bold text-white mb-4 text-shadow-lg font-sans">Scriptomania Life Sim</h2>
                      <p className="text-white/90 text-lg font-medium leading-relaxed">
                        Open the sidebar to add characters to this chat.<br />
                        Then click them to bring them into the scene.<br />
                        <span className="text-sm opacity-70">Use the menu to manage chats.</span>
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    showThinking={showThinking}
                    characters={currentSession.characters}
                    onRetry={index === messages.length - 1 ? () => handleRetry(msg.id) : undefined}
                    onJump={() => handleJumpToMessage(msg.id)}
                    isLastMessage={index === messages.length - 1}
                    isStreaming={isSending && index === messages.length - 1}
                    isNew={msg.timestamp > mountTime}
                    fontSize={fontSize}
                  />
                ))}

                {isSending && (
                  <div className="flex justify-center p-4">
                    <div className="flex space-x-3 bg-black/40 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-lg">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce delay-100"></div>
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 pb-8 w-full">
                <div className="relative flex items-center group">

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="w-full bg-black/50 backdrop-blur-2xl border border-white/20 text-white placeholder-white/50 rounded-full py-3 md:py-4 pl-14 pr-16 focus:outline-none focus:bg-black/60 focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] font-body text-base md:text-lg"
                    disabled={isSending}
                  />

                  {/* Actions Menu (Left inside Input) */}
                  <div className="absolute left-2 z-10">
                    <button
                      onClick={() => setShowSessionMenu(!showSessionMenu)}
                      className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>

                    {showSessionMenu && (
                      <div className="absolute left-0 bottom-full mb-4 w-48 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-up origin-bottom-left">
                        <button
                          onClick={handleUndo}
                          disabled={messages.length === 0}
                          className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          Undo Last
                        </button>
                        <button
                          onClick={handleClearChat}
                          disabled={messages.length === 0}
                          className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Clear Chat
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="absolute right-2 p-2.5 bg-white/10 text-white rounded-full hover:bg-pink-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95 border border-white/10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;