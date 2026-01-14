import React, { useMemo, useState, useEffect } from 'react';
import { HistoryGraph } from './HistoryGraph';
import { UserBadgeDisplay } from './UserBadgeDisplay';

const formatFullTime = (seconds) => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h === 0) parts.push(`${m}m`);

    return parts.join(' ');
};

const ITEMS_PER_PAGE = 10;
const MAX_ITEMS = 20;

export const HistoryView = ({ 
    history = [], 
    totalTimeMap = {}, 
    totalQuestionsMap = {}, 
    sessionTime = 0, 
    sessionQuestionsCount = 0, 
    onBack, 
    onDeleteRecord,
    user,
    syncing,
    currentSubject,
    onRefreshRequest // Funkce pro refresh z App.js
}) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [localHistory, setLocalHistory] = useState(history);
    const [isLoading, setIsLoading] = useState(false);

    // Synchronizace props -> local state
    useEffect(() => {
        setLocalHistory(history);
    }, [history]);

    // Automaticky refresh při otevření (bez tlačítka)
    useEffect(() => {
        const autoRefresh = async () => {
            if (onRefreshRequest) {
                setIsLoading(true);
                try {
                    await onRefreshRequest();
                } catch (e) {
                    console.error("Auto-refresh failed", e);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        autoRefresh();
    }, []);

    const filteredHistory = useMemo(() => {
        let data = [...localHistory];
        if (currentSubject) {
            data = data.filter(h => h.subject === currentSubject);
        }
        return data.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [localHistory, currentSubject]);

    const statsHistory = useMemo(() => {
        return filteredHistory.slice(0, MAX_ITEMS);
    }, [filteredHistory]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    const totalTime = useMemo(() => {
        let baseTime = 0;
        if (currentSubject) {
            baseTime = totalTimeMap[currentSubject] || 0;
        } else {
            baseTime = Object.values(totalTimeMap).reduce((acc, curr) => acc + curr, 0);
        }
        return baseTime + sessionTime;
    }, [totalTimeMap, currentSubject, sessionTime]);

    const totalQuestions = useMemo(() => {
        let baseQuestions = 0;
        if (currentSubject) {
            baseQuestions = totalQuestionsMap[currentSubject] || 0;
        } else {
            baseQuestions = Object.values(totalQuestionsMap).reduce((acc, curr) => acc + curr, 0);
        }
        return baseQuestions + sessionQuestionsCount;
    }, [totalQuestionsMap, currentSubject, sessionQuestionsCount]);

    const detailedStats = useMemo(() => {
        if (statsHistory.length === 0) {
            return { count: 0, average: 0, best: 0 };
        }

        let totalPercent = 0;
        let maxPercent = 0;

        statsHistory.forEach(item => {
            const total = item.score?.total || 1;
            const correct = item.score?.correct || 0;
            const percent = (correct / total) * 100;

            totalPercent += percent;
            if (percent > maxPercent) maxPercent = percent;
        });

        return {
            count: filteredHistory.length,
            average: Math.round(totalPercent / statsHistory.length),
            best: Math.round(maxPercent)
        };
    }, [filteredHistory, statsHistory]);

    const getModeIcon = (mode) => {
        switch(mode) {
            case 'mock': return '⏱️';
            case 'smart': return '🧠';
            case 'random': return '🃏';
            case 'training': return '🎯';
            case 'mistakes': return '🛠️';
            default: return '📝';
        }
    };

    const getModeName = (mode) => {
        switch(mode) {
            case 'mock': return 'Test nanečisto';
            case 'smart': return 'Chytré učení';
            case 'random': return 'Flashcards';
            case 'training': return 'Trénink';
            case 'mistakes': return 'Opravna chyb';
            default: return mode;
        }
    };

    const getScoreColor = (successRate) => {
        if (successRate >= 84) return '#22c55e';
        if (successRate >= 67) return '#84cc16';
        if (successRate >= 50) return '#eab308';
        if (successRate >= 33) return '#f97316';
        return '#ef4444';
    };

    const getRelativeTime = (date) => {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Právě teď';
        if (minutes < 60) return `Před ${minutes} min`;
        if (hours < 24) return `Před ${hours} hod`;
        if (days < 7) return `Před ${days} dny`;
        return date.toLocaleDateString('cs-CZ');
    };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>
                        ← <span className="mobile-hide-text">Zpět do menu</span>
                    </button>
                </div>
                <div className="navbar-group">
                    {/* Tlačítko pro manuální refresh odstraněno */}
                    {/* Indikátor sync/loading zůstává pro vizuální kontrolu */}
                    <UserBadgeDisplay user={user} syncing={syncing || isLoading} />
                </div>
            </div>

            <div className="quizContentWrapper historyPage" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <h1 className="title historyTitle">
                    Historie výsledků {currentSubject ? `(${currentSubject})` : ''}
                </h1>

                <div className="historyStatsGrid">
                    <div className="historyStatCard">
                        <div className="historyStatIcon">⏳</div>
                        <div className="historyStatContent">
                            <span className="historyStatValue" style={{ color: 'var(--color-primary-light)' }}>
                                {formatFullTime(totalTime)}
                            </span>
                            <span className="historyStatLabel">Celkový čas</span>
                        </div>
                    </div>

                    <div className="historyStatCard">
                        <div className="historyStatIcon">✅</div>
                        <div className="historyStatContent">
                            <span className="historyStatValue" style={{ color: 'var(--color-success)' }}>
                                {totalQuestions}
                            </span>
                            <span className="historyStatLabel">Otázek</span>
                        </div>
                    </div>

                    <div className="historyStatCard">
                        <div className="historyStatIcon">📝</div>
                        <div className="historyStatContent">
                            <span className="historyStatValue">
                                {detailedStats.count}
                            </span>
                            <span className="historyStatLabel">Testů</span>
                        </div>
                    </div>

                    <div className="historyStatCard">
                        <div className="historyStatIcon">📊</div>
                        <div className="historyStatContent">
                            <span
                                className="historyStatValue"
                                style={{
                                    color: detailedStats.average >= 75
                                        ? 'var(--color-success)'
                                        : detailedStats.average >= 50
                                            ? 'var(--color-warning)'
                                            : 'var(--color-error)'
                                }}
                            >
                                {detailedStats.average}%
                            </span>
                            <span className="historyStatLabel">Průměr</span>
                        </div>
                    </div>

                    <div className="historyStatCard historyStatCardHighlight">
                        <div className="historyStatIcon">🏆</div>
                        <div className="historyStatContent">
                            <span className="historyStatValue" style={{ color: '#fbbf24' }}>
                                {detailedStats.best}%
                            </span>
                            <span className="historyStatLabel">Nejlepší</span>
                        </div>
                    </div>
                </div>

                <div className="card historyChartCard">
                    <h3 className="historyChartTitle">Vývoj úspěšnosti</h3>
                    <div className="historyChartCanvas">
                        <HistoryGraph data={statsHistory} />
                    </div>
                </div>

                <div className="historyListHeader">
                    <h3 className="historyListTitle">Historie aktivit</h3>
                    {totalPages > 1 && (
                        <span className="historyPageInfo">
                            {currentPage * ITEMS_PER_PAGE + 1} – {Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredHistory.length)} z {filteredHistory.length}
                        </span>
                    )}
                </div>

                {filteredHistory.length === 0 ? (
                    <div className="historyEmpty">
                        <div className="historyEmptyIcon">📭</div>
                        <p>{currentSubject 
                            ? `Zatím žádná historie pro ${currentSubject}.`
                            : "Zatím žádná historie. Hurá do učení!"}</p>
                    </div>
                ) : (
                    <>
                        <div className="historyList">
                            {paginatedHistory.map((item, index) => {
                                const date = new Date(item.date);
                                const successRate = item.score?.total > 0 
                                    ? Math.round((item.score.correct / item.score.total) * 100) 
                                    : 0;
                                const scoreColor = getScoreColor(successRate);

                                return (
                                    <div 
                                        key={item.id} 
                                        className="historyItem"
                                        style={{ animationDelay: `${index * 0.03}s`, '--score-color': scoreColor }}
                                    >
                                        <div className="historyItemLeft">
                                            <div className="historyItemIcon" style={{ 
                                                background: `linear-gradient(135deg, ${scoreColor}20, ${scoreColor}10)`,
                                                borderColor: `${scoreColor}40`
                                            }}>
                                                {getModeIcon(item.mode)}
                                            </div>
                                            <div className="historyItemInfo">
                                                <div className="historyItemMode">
                                                    {getModeName(item.mode)}
                                                    {!currentSubject && item.subject && (
                                                        <span className="historyItemSubject">{item.subject}</span>
                                                    )}
                                                </div>
                                                <div className="historyItemDate">
                                                    {getRelativeTime(date)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="historyItemRight">
                                            <div className="historyItemScore">
                                                <span className="historyItemPercent" style={{ color: scoreColor }}>
                                                    {successRate}%
                                                </span>
                                                <span className="historyItemFraction">
                                                    {item.score?.correct}/{item.score?.total}
                                                </span>
                                            </div>
                                            <button 
                                                className="historyDeleteBtn"
                                                onClick={() => onDeleteRecord(item.id)}
                                                title="Smazat záznam"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="historyPagination">
                                <button 
                                    className="historyPaginationBtn"
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    disabled={currentPage === 0}
                                >
                                    ← Novější
                                </button>
                                <div className="historyPaginationDots">
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <button
                                            key={i}
                                            className={`historyPaginationDot ${currentPage === i ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(i)}
                                        />
                                    ))}
                                </div>
                                <button 
                                    className="historyPaginationBtn"
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={currentPage === totalPages - 1}
                                >
                                    Starší →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
