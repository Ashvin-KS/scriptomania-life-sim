import React, { useState, useRef } from 'react';
import { ChatSession, Character } from '../types';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    currentSessionId: string;
    onSwitchSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
    onRenameSession: (id: string, newName: string) => void;
    onAddCharacter: (char: Character) => void;
    onUpdateCharacter: (char: Character) => void;
    onDeleteCharacter: (charId: string) => void;
    // New props for dynamic character management
    allCharacters: Character[];
    currentSessionCharacters: Character[];
    onAddCharacterToSession: (char: Character) => void;
    onRemoveCharacterFromSession: (charId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    sessions,
    currentSessionId,
    onSwitchSession,
    onNewSession,
    onDeleteSession,
    onRenameSession,
    onAddCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    allCharacters,
    currentSessionCharacters,
    onAddCharacterToSession,
    onRemoveCharacterFromSession
}) => {
    const [isAddingChar, setIsAddingChar] = useState(false);
    const [editingCharId, setEditingCharId] = useState<string | null>(null);

    // Form State
    const [charName, setCharName] = useState('');
    const [charRole, setCharRole] = useState('');
    const [charPersonality, setCharPersonality] = useState('');
    const [charAppearance, setCharAppearance] = useState('');
    const [charSpeakingStyle, setCharSpeakingStyle] = useState('');
    const [charAvatar, setCharAvatar] = useState<string | null>(null);
    const [charGallery, setCharGallery] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Renaming State
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCharAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setCharGallery(prev => [...prev, result]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveCharacter = () => {
        if (charName && charRole && charAvatar) {
            const characterData: Character = {
                id: editingCharId || Date.now().toString(),
                name: charName,
                role: charRole,
                avatar: charAvatar,
                personality: charPersonality,
                appearance: charAppearance,
                speakingStyle: charSpeakingStyle,
                gallery: charGallery.length > 0 ? charGallery : [charAvatar]
            };

            if (editingCharId) {
                onUpdateCharacter(characterData);
            } else {
                onAddCharacter(characterData);
            }

            resetForm();
        }
    };

    const resetForm = () => {
        setIsAddingChar(false);
        setEditingCharId(null);
        setCharName('');
        setCharRole('');
        setCharPersonality('');
        setCharAppearance('');
        setCharSpeakingStyle('');
        setCharAvatar(null);
        setCharGallery([]);
    };

    const startEditingCharacter = (char: Character) => {
        setEditingCharId(char.id);
        setCharName(char.name);
        setCharRole(char.role);
        setCharPersonality(char.personality || '');
        setCharAppearance(char.appearance || '');
        setCharSpeakingStyle(char.speakingStyle || '');
        setCharAvatar(char.avatar);
        setCharGallery(char.gallery || [char.avatar]);
        setIsAddingChar(true);
    };

    const startEditing = (session: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setEditName(session.name);
    };

    const saveRename = (id: string) => {
        if (editName.trim()) {
            onRenameSession(id, editName.trim());
        }
        setEditingSessionId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') {
            saveRename(id);
        } else if (e.key === 'Escape') {
            setEditingSessionId(null);
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Panel */}
            <div className={`fixed top-0 left-0 h-full w-full md:w-80 bg-gray-900/95 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white tracking-wide">Menu</h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">

                    {/* Chat Sessions */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider">Chat Sessions</h3>
                            <button
                                onClick={onNewSession}
                                className="text-xs bg-white/10 hover:bg-pink-500 text-white px-2 py-1 rounded transition-colors"
                            >
                                + New
                            </button>
                        </div>
                        <div className="space-y-2">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${session.id === currentSessionId ? 'bg-pink-500/20 border border-pink-500/50' : 'hover:bg-white/5 border border-transparent'}`}
                                    onClick={() => onSwitchSession(session.id)}
                                >
                                    {editingSessionId === session.id ? (
                                        <input
                                            autoFocus
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onBlur={() => saveRename(session.id)}
                                            onKeyDown={(e) => handleKeyDown(e, session.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-black/50 text-white text-sm px-2 py-1 rounded border border-pink-500/50 w-full outline-none"
                                        />
                                    ) : (
                                        <>
                                            <div className="truncate text-white/90 text-sm font-medium flex-1">
                                                {session.name || "Untitled Chat"}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => startEditing(session, e)}
                                                    className="text-white/30 hover:text-blue-400 p-1"
                                                    title="Rename"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                                    className="text-white/30 hover:text-red-400 p-1"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Character Management */}
                    <section>
                        <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-4">Session Characters</h3>

                        {/* Active Session Characters */}
                        <div className="mb-6 space-y-2">
                            {currentSessionCharacters.length === 0 ? (
                                <p className="text-xs text-white/40 italic">No characters in this chat yet.</p>
                            ) : (
                                currentSessionCharacters.map(char => (
                                    <div key={char.id} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/10">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <img src={char.avatar} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                                            <div className="truncate">
                                                <div className="text-xs font-bold text-white">{char.name}</div>
                                                <div className="text-[10px] text-white/50 truncate">{char.role}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onRemoveCharacterFromSession(char.id)}
                                            className="text-white/30 hover:text-red-400 p-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-4">Character Library</h3>

                        {/* Library / Add New */}
                        {!isAddingChar ? (
                            <div className="space-y-3">
                                {/* List Available Characters */}
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {allCharacters.map(char => {
                                        const isInSession = currentSessionCharacters.some(c => c.id === char.id);
                                        return (
                                            <div key={char.id} className="relative group">
                                                <button
                                                    onClick={() => !isInSession && onAddCharacterToSession(char)}
                                                    disabled={isInSession}
                                                    className={`w-full aspect-square rounded-lg overflow-hidden border ${isInSession ? 'border-pink-500 opacity-50 cursor-default' : 'border-white/20 hover:border-white/80 hover:scale-105 transition-all'}`}
                                                    title={char.name}
                                                >
                                                    <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                                                    {isInSession && (
                                                        <div className="absolute inset-0 bg-pink-500/40 flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEditingCharacter(char); }}
                                                    className="absolute top-1 right-1 bg-black/60 hover:bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                                    title="Edit Character"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setIsAddingChar(true)}
                                    className="w-full py-3 border border-dashed border-white/20 rounded-xl text-white/50 hover:text-white hover:border-white/50 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    <span>Create New Character</span>
                                </button>
                            </div>
                        ) : (
                            <div className="bg-black/40 p-4 rounded-xl border border-white/10 space-y-3 animate-fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-white font-bold text-sm">{editingCharId ? 'Edit Character' : 'New Character'}</h4>
                                    {editingCharId && (
                                        <button
                                            onClick={() => {
                                                if (confirm('Are you sure you want to delete this character?')) {
                                                    onDeleteCharacter(editingCharId);
                                                    resetForm();
                                                }
                                            }}
                                            className="text-red-400 hover:text-red-300 text-xs"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    placeholder="Name"
                                    value={charName}
                                    onChange={(e) => setCharName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                />
                                <input
                                    type="text"
                                    placeholder="Role / Title"
                                    value={charRole}
                                    onChange={(e) => setCharRole(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                />
                                <textarea
                                    placeholder="Personality / Behavior (Optional)"
                                    value={charPersonality}
                                    onChange={(e) => setCharPersonality(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none resize-none h-20"
                                />
                                <textarea
                                    placeholder="Appearance (Optional)"
                                    value={charAppearance}
                                    onChange={(e) => setCharAppearance(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none resize-none h-20"
                                />
                                <input
                                    type="text"
                                    placeholder="Speaking Style (e.g. Sarcastic, Shouts, Whispers)"
                                    value={charSpeakingStyle}
                                    onChange={(e) => setCharSpeakingStyle(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                />

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/70 uppercase">Avatar & Gallery</label>

                                    {/* Main Avatar Preview */}
                                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                        {/* Current Avatar */}
                                        <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-pink-500">
                                            {charAvatar ? (
                                                <img src={charAvatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-white/5 flex items-center justify-center text-xs text-white/30">No Avatar</div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-pink-500 text-[10px] text-white text-center font-bold">MAIN</div>
                                        </div>

                                        {/* Gallery Items */}
                                        {charGallery.filter(img => img !== charAvatar).map((img, idx) => (
                                            <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-white/20 group">
                                                <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                                                    <button
                                                        onClick={() => setCharAvatar(img)}
                                                        className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded hover:bg-pink-400"
                                                    >
                                                        Set Main
                                                    </button>
                                                    <button
                                                        onClick={() => setCharGallery(prev => prev.filter(i => i !== img))}
                                                        className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-400"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add New Image Button */}
                                        <div
                                            onClick={() => galleryInputRef.current?.click()}
                                            className="flex-shrink-0 w-20 h-20 rounded-lg border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/5 hover:border-white/50 transition-all"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Add Image URL..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.currentTarget.value;
                                                if (val) {
                                                    setCharGallery(prev => [...prev, val]);
                                                    if (!charAvatar) setCharAvatar(val);
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                    />

                                    <input
                                        ref={galleryInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            handleGalleryFileChange(e);
                                            // Also set as avatar if none exists
                                            if (!charAvatar && e.target.files?.[0]) {
                                                handleFileChange(e);
                                            }
                                        }}
                                        className="hidden"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={resetForm}
                                        className="flex-1 py-2 text-xs text-white/70 hover:text-white bg-white/5 rounded hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveCharacter}
                                        disabled={!charName || !charRole || !charAvatar}
                                        className="flex-1 py-2 text-xs text-white bg-pink-600 rounded hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save Character
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 text-center">
                    <p className="text-xs text-white/30">v0.2.0 • Scriptomania Life Sim</p>
                </div>
            </div>
        </>
    );
};

export default Sidebar;