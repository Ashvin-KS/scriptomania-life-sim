import React, { useState, useEffect, useRef } from 'react';

interface FluidTextProps {
    text: string;
    speed?: number; // ms per char
    className?: string;
    onComplete?: () => void;
    canComplete?: boolean;
}

const FluidText: React.FC<FluidTextProps> = ({ text, speed = 15, className, onComplete, canComplete = true }) => {
    const [displayedText, setDisplayedText] = useState('');
    const index = useRef(0);
    const targetText = useRef(text);
    const isComplete = useRef(false);

    useEffect(() => {
        targetText.current = text;
        // Handle text reset or instant update
        if (text.length < index.current) {
            index.current = text.length;
            setDisplayedText(text);
        } else if (speed === 0) {
            setDisplayedText(text);
            index.current = text.length;
        }
    }, [text, speed]);

    // Watch for canComplete becoming true when we are already done
    useEffect(() => {
        if (canComplete && isComplete.current && index.current >= targetText.current.length) {
            if (onComplete) onComplete();
        }
    }, [canComplete, onComplete]);

    useEffect(() => {
        if (speed === 0) {
            if (!isComplete.current && canComplete) {
                isComplete.current = true;
                if (onComplete) onComplete();
            }
            return;
        }

        let lastTime = 0;
        let animationFrameId: number;

        const animate = (time: number) => {
            if (index.current < targetText.current.length) {
                isComplete.current = false;
                if (time - lastTime >= speed) {
                    const nextChar = targetText.current.charAt(index.current);
                    setDisplayedText((prev) => prev + nextChar);
                    index.current++;
                    lastTime = time;
                }
            } else if (!isComplete.current) {
                // Only mark as complete and fire callback if allowed
                if (canComplete) {
                    isComplete.current = true;
                    if (onComplete) onComplete();
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
    }, [speed, onComplete, canComplete]);

    // If text is empty, ensure display is empty
    if (text.length === 0 && displayedText.length > 0) {
        setDisplayedText('');
        index.current = 0;
    }

    return <span className={className}>{displayedText}</span>;
};

export default FluidText;