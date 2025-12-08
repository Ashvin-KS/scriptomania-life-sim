import React, { useState } from 'react';
import { SystemInstruction, Situation } from '../types';

interface SituationEditorProps {
    templates: SystemInstruction[];
    onUpdateTemplate: (template: SystemInstruction) => void;
}

const SituationEditor: React.FC<SituationEditorProps> = ({ templates, onUpdateTemplate }) => {
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

    const handleSituationChange = (template: SystemInstruction, situationIndex: number, field: keyof Situation, value: string) => {
        const newSituations = [...(template.situations || [])];
        newSituations[situationIndex] = { ...newSituations[situationIndex], [field]: value, id: newSituations[situationIndex]?.id || `s${situationIndex + 1}` };
        onUpdateTemplate({ ...template, situations: newSituations });
    };

    const getSituations = (template: SystemInstruction) => {
        const situations = template.situations || [];
        // Ensure there are always 5 situations
        return Array.from({ length: 5 }, (_, i) => situations[i] || { id: `s${i + 1}`, title: '', brief: '', content: '' });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">Edit Situations per Template</h3>
            {templates.map(template => (
                <div key={template.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <h4 className="text-white font-bold mb-4">{template.label}</h4>
                    <div className="space-y-4">
                        {getSituations(template).map((situation, index) => (
                            <div key={index} className="border-t border-white/10 pt-4">
                                <h5 className="text-sm font-bold text-white/70 mb-2">Situation {index + 1}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Title (e.g., 'An Unexpected Guest')"
                                        value={situation.title || ''}
                                        onChange={(e) => handleSituationChange(template, index, 'title', e.target.value)}
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Brief (short one-line preview)"
                                        value={situation.brief || ''}
                                        onChange={(e) => handleSituationChange(template, index, 'brief', e.target.value)}
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm focus:border-pink-500 focus:outline-none"
                                    />
                                    <textarea
                                        placeholder="Content (full situation text to inject into prompts)"
                                        value={situation.content || ''}
                                        onChange={(e) => handleSituationChange(template, index, 'content', e.target.value)}
                                        className="w-full md:col-span-2 bg-black/30 border border-white/20 rounded-lg p-2 text-white text-sm focus:border-pink-500 focus:outline-none h-24 resize-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SituationEditor;
