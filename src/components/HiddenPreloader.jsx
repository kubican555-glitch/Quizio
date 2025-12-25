import React from 'react';
import { getImageUrl } from '../utils/images';

export const HiddenPreloader = ({ questionSet, currentIndex, subject, mode }) => {
    if (!questionSet || questionSet.length === 0) return null;

    const rangeEnd = mode === "mock" ? questionSet.length : currentIndex + 5;
    const questionsToPreload = questionSet.slice(currentIndex + 1, rangeEnd);

    return (
        <div style={{ display: "none", width: 0, height: 0, overflow: "hidden" }}>
            {questionsToPreload.map((q) => {
                const url = getImageUrl(subject, q.number);
                if (!url) return null;
                return (
                    <img 
                        key={q.number} 
                        src={url} 
                        alt="preload" 
                        loading="eager" 
                    />
                );
            })}
        </div>
    );
};