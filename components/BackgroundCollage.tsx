import React, { useState, useEffect, useRef } from 'react';
import { Character, ChatBackground } from '../types';

interface BackgroundCollageProps {
  characters: Character[];
  sessionId: string;
  onCharacterClick?: (characterId: string) => void;
  selectionMode?: boolean;
  selectedIds?: string[];
  background?: ChatBackground;
  onEditModeChange?: (isEditing: boolean) => void;
}

interface CollageItem {
  id: string; // Unique instance ID
  charId: string;
  image: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

const BackgroundCollage: React.FC<BackgroundCollageProps> = ({
  characters,
  sessionId,
  onCharacterClick,
  selectionMode = false,
  selectedIds = [],
  background,
  onEditModeChange
}) => {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  // Refs for drag calculations
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  const itemStartRef = useRef<{ x: number, y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number, y: number, initialScale: number } | null>(null);

  // Load positions
  useEffect(() => {
    const saved = localStorage.getItem(`collage_layout_v2_${sessionId}`);
    if (saved) {
      try {
        const savedItems = JSON.parse(saved);
        if (Array.isArray(savedItems)) {
          setItems(savedItems);
          return;
        }
      } catch (e) {
        console.error("Failed to load collage", e);
      }
    }

    // Fallback: Try loading old format or init default
    const oldSaved = localStorage.getItem(`collage_layout_${sessionId}`);
    if (oldSaved) {
      try {
        const oldItems = JSON.parse(oldSaved);
        // Convert old format (dict) to new format (array)
        const newItems: CollageItem[] = Object.keys(oldItems).map(charId => {
          const char = characters.find(c => c.id === charId);
          return {
            id: Date.now() + Math.random().toString(),
            charId: charId,
            image: char?.avatar || '',
            ...oldItems[charId]
          };
        }).filter(i => i.image); // Only keep if we found the char/image
        setItems(newItems);
      } catch (e) {
        // Ignore
      }
    } else if (characters.length > 0) {
      // Initial Default: One for each character
      const newItems: CollageItem[] = characters.map((char, index) => {
        const cols = 4;
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          id: Date.now() + Math.random().toString(),
          charId: char.id,
          image: char.avatar,
          x: 12 + (col * 25),
          y: 12 + (row * 30),
          rotation: (Math.random() * 10) - 5,
          scale: 1,
          zIndex: index + 1
        };
      });
      setItems(newItems);
    }
  }, [sessionId]); // Only run on mount/session change, NOT on characters change (user manages items manually now)


  // Save positions
  useEffect(() => {
    if (items.length > 0 || editMode) { // Only save if we have items or explicitly edited
      localStorage.setItem(`collage_layout_v2_${sessionId}`, JSON.stringify(items));
    }
  }, [items, sessionId, editMode]);

  // Add Item
  const handleAddItem = (char: Character, img: string) => {
    const newItem: CollageItem = {
      id: Date.now().toString(),
      charId: char.id,
      image: img,
      x: 50, // Center
      y: 50,
      rotation: (Math.random() * 10) - 5,
      scale: 1,
      zIndex: Math.max(0, ...items.map(i => i.zIndex)) + 1
    };
    setItems(prev => [...prev, newItem]);
    setShowAddMenu(false);
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Handle Drag
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (!editMode) {
      const item = items.find(i => i.id === id);
      if (item) onCharacterClick?.(item.charId);
      return;
    }
    e.stopPropagation();
    setDraggingId(id);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    const item = items.find(i => i.id === id);
    if (item) {
      itemStartRef.current = { x: item.x, y: item.y };
      // Bring to front
      setItems(prev => {
        const maxZ = Math.max(0, ...prev.map(i => i.zIndex));
        return prev.map(i => i.id === id ? { ...i, zIndex: maxZ + 1 } : i);
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setResizingId(id);
    const item = items.find(i => i.id === id);
    if (item) {
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialScale: item.scale
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingId && dragStartRef.current && itemStartRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) / window.innerWidth * 100;
      const dy = (e.clientY - dragStartRef.current.y) / window.innerHeight * 100;

      setItems(prev => prev.map(i =>
        i.id === draggingId
          ? { ...i, x: itemStartRef.current!.x + dx, y: itemStartRef.current!.y + dy }
          : i
      ));
    } else if (resizingId && resizeStartRef.current) {
      const dx = e.clientX - resizeStartRef.current.x;
      const scaleChange = dx * 0.005;
      const newScale = Math.max(0.2, Math.min(5, resizeStartRef.current.initialScale + scaleChange));

      setItems(prev => prev.map(i =>
        i.id === resizingId ? { ...i, scale: newScale } : i
      ));
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
  };

  // Wheel to rotate/scale
  const handleWheel = (e: React.WheelEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();

    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (e.shiftKey) {
        const newScale = Math.max(0.2, Math.min(5, i.scale - e.deltaY * 0.001));
        return { ...i, scale: newScale };
      } else {
        const newRot = i.rotation + (e.deltaY * 0.05);
        return { ...i, rotation: newRot };
      }
    }));
  };

  // Determine Background Style
  const renderBackground = () => {
    const type = background?.type || 'default';

    if (type === 'paper') {
      return (
        <div className="absolute inset-0 bg-[#121214]">
          <div
            className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: '30px 30px'
            }}
          ></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 z-0 pointer-events-none mix-blend-overlay"></div>
        </div>
      );
    } else if (type === 'custom' && background?.value) {
      return (
        <div className="absolute inset-0 bg-black">
          <img src={background.value} alt="Background" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
      );
    } else {
      // Default (Collage style background - dark with noise)
      return (
        <div className="absolute inset-0 bg-gray-900">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 pointer-events-none mix-blend-overlay"></div>
        </div>
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden select-none bg-black"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {renderBackground()}

      {/* Edit Mode Controls */}
      <div className="absolute top-20 right-4 md:top-4 md:right-24 z-[1000] flex gap-2 flex-col md:flex-row items-end">
        {editMode && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-blue-600 text-white border-blue-400 hover:bg-blue-500"
            >
              + Add Image
            </button>

            {/* Add Menu Dropdown */}
            {showAddMenu && (
              <div className="absolute top-full right-0 mt-2 w-72 max-w-[90vw] bg-gray-900 border border-white/20 rounded-xl p-4 shadow-2xl max-h-[60vh] overflow-y-auto custom-scrollbar">
                <h4 className="text-white text-xs font-bold mb-3 uppercase opacity-70">Select Image</h4>
                <div className="space-y-4">
                  {characters.map(char => (
                    <div key={char.id}>
                      <div className="text-white text-xs font-bold mb-2 flex items-center gap-2">
                        <img src={char.avatar} className="w-4 h-4 rounded-full" />
                        {char.name}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from(new Set([char.avatar, ...(char.gallery || [])])).map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAddItem(char, img)}
                            className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-pink-500 transition-colors"
                          >
                            <img src={img} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            const newMode = !editMode;
            setEditMode(newMode);
            onEditModeChange?.(newMode);
            if (!newMode) setShowAddMenu(false);
          }}
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${editMode ? 'bg-pink-500 text-white border-pink-400' : 'bg-black/30 text-white/50 border-white/10 hover:bg-black/50'}`}
        >
          {editMode ? 'Done Editing' : 'Edit Layout'}
        </button>
      </div>

      <div className="relative w-full h-full">
        {items.map((item) => {
          const char = characters.find(c => c.id === item.charId);
          // If character deleted, we still show the item if we have the image, but maybe fallback name
          const name = char?.name || 'Unknown';
          const role = char?.role || '';

          return (
            <div
              key={item.id}
              onMouseDown={(e) => handleMouseDown(e, item.id)}
              onWheel={(e) => handleWheel(e, item.id)}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
                zIndex: item.zIndex,
                cursor: editMode ? (draggingId ? 'grabbing' : (resizingId ? 'nwse-resize' : 'grab')) : 'pointer',
                height: 'auto'
              }}
              className={`
                        absolute transition-shadow duration-300 ease-out group
                        w-[45vw] md:w-[18vw]
                        ${editMode ? 'border-2 border-dashed border-pink-500/50' : 'hover:scale-105 hover:z-50'}
                    `}
            >
              <div className={`
                        relative overflow-hidden rounded-[2rem] border-[6px] 
                        shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm bg-white/5
                        ${!editMode && !selectionMode && 'group-hover:border-white/50 group-hover:shadow-[0_0_80px_rgba(255,182,193,0.5)]'}
                        ${selectionMode && selectedIds.includes(item.charId) ? 'border-pink-500 shadow-[0_0_50px_rgba(236,72,153,0.6)] scale-105' : 'border-white/10'}
                        ${selectionMode && !selectedIds.includes(item.charId) ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}
                    `}>
                <img
                  src={item.image}
                  alt={name}
                  draggable={false}
                  className="w-full h-full object-cover filter brightness-[0.9] contrast-125 transition-all duration-700 group-hover:brightness-110"
                />

                {/* Hover Name Badge (Only in View Mode) */}
                {(!editMode && !selectionMode) && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                    <h3 className="text-white text-3xl font-bold uppercase tracking-widest drop-shadow-2xl font-sans transform -rotate-12 group-hover:rotate-0 transition-transform duration-300">
                      {name}
                    </h3>
                  </div>
                )}

                {/* Selection Mode Name Badge (Always Visible) */}
                {selectionMode && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-md p-2 text-center border-t border-white/10">
                    <h3 className={`text-white font-bold uppercase tracking-wider font-sans transition-colors ${selectedIds.includes(item.charId) ? 'text-pink-400' : 'text-white/70'}`}>
                      {name}
                    </h3>
                    <p className="text-[10px] text-white/50 truncate">{role}</p>
                  </div>
                )}

                {/* Resize Handle (Only in Edit Mode) */}
                {editMode && (
                  <>
                    <div
                      onMouseDown={(e) => handleResizeStart(e, item.id)}
                      className="absolute bottom-0 right-0 w-8 h-8 bg-pink-500/80 cursor-nwse-resize rounded-tl-xl flex items-center justify-center hover:bg-pink-400 transition-colors z-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {/* Delete Button */}
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                      className="absolute top-0 right-0 w-8 h-8 bg-red-500/80 cursor-pointer rounded-bl-xl flex items-center justify-center hover:bg-red-400 transition-colors z-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-transparent to-black/60 z-40"></div>

      {/* Instructions Overlay in Edit Mode */}
      {editMode && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs pointer-events-none backdrop-blur-md border border-white/10 z-[1000]">
          Drag to move • Drag corner to resize • Wheel to rotate • Shift+Wheel to scale
        </div>
      )}
    </div>
  );
};

export default BackgroundCollage;