import React from 'react';
import { formatDuration } from '../utils/formatting';

export const StatsPanel = ({ history, totalTimeMap, sessionTime, currentSubject, totalQuestionsMap, sessionQuestionsCount }) => {
    const mockData = history.filter(h => h.mode === 'mock');

    const savedSubjectTime = totalTimeMap[currentSubject] || 0;
    const combinedSubjectTime = savedSubjectTime + sessionTime;

    const savedQuestions = totalQuestionsMap[currentSubject] || 0;
    const combinedQuestions = savedQuestions + sessionQuestionsCount;

    const totalTests = mockData.length;

    const average = totalTests > 0 
        ? Math.round(mockData.reduce((acc, curr) => acc + (curr.score.correct / curr.score.total), 0) / totalTests * 100)
        : 0;

    const bestScore = totalTests > 0
        ? Math.max(...mockData.map(d => Math.round((d.score.correct / d.score.total) * 100)))
        : 0;

    return (
        <div className="statsRow fadeIn" style={{ flexWrap: 'wrap' }}>
            <div className="statCard">
                <span className="statVal">{formatDuration(combinedSubjectTime)}</span>
                <span className="statLbl">Čistý čas učení</span>
            </div>

            <div className="statCard">
                <span className="statVal">{combinedQuestions}</span>
                <span className="statLbl">Zodpovězeno</span>
            </div>

            <div className="statCard">
                <span className="statVal">{totalTests}</span>
                <span className="statLbl">Dokončeno testů</span>
            </div>
            <div className="statCard">
                <span className="statVal">{average}%</span>
                <span className="statLbl">Průměr</span>
            </div>
            <div className="statCard">
                <span className="statVal" style={{color: 'var(--color-success)'}}>{bestScore}%</span>
                <span className="statLbl">Nejlepší</span>
            </div>
        </div>
    );
};