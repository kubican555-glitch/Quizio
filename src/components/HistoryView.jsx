import React, { useMemo } from 'react';
import { HistoryGraph } from './HistoryGraph';
import { UserBadgeDisplay } from './UserBadgeDisplay';

// Pomocná funkce pro formátování času s hodinami
const formatFullTime = (seconds) => {
    if (!seconds) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);

    return parts.join(' ');
};

export const HistoryView = ({ 
    history = [], 
    totalTimeMap = {}, 
    totalQuestionsMap = {},
    sessionTime = 0, // PŘIDÁNO: Čas z aktuální session
    sessionQuestionsCount = 0, // PŘIDÁNO: Otázky z aktuální session
    onBack, 
    onDeleteRecord,
    user,
    syncing,
    currentSubject 
}) => {
    // 1. Filtrování historie podle předmětu
    const filteredHistory = useMemo(() => {
        let data = [...history];
        if (currentSubject) {
            data = data.filter(h => h.subject === currentSubject);
        }
        return data.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history, currentSubject]);

    // 2. Výpočet statistik s přičtením aktuální session (Real-time update)
    const totalTime = useMemo(() => {
        let baseTime = 0;
        if (currentSubject) {
            baseTime = totalTimeMap[currentSubject] || 0;
        } else {
            baseTime = Object.values(totalTimeMap).reduce((acc, curr) => acc + curr, 0);
        }
        // Přičteme aktuální session, abychom viděli okamžitý výsledek
        return baseTime + sessionTime;
    }, [totalTimeMap, currentSubject, sessionTime]);

    const totalQuestions = useMemo(() => {
        let baseQuestions = 0;
        if (currentSubject) {
            baseQuestions = totalQuestionsMap[currentSubject] || 0;
        } else {
            baseQuestions = Object.values(totalQuestionsMap).reduce((acc, curr) => acc + curr, 0);
        }
        // Přičteme aktuální session
        return baseQuestions + sessionQuestionsCount;
    }, [totalQuestionsMap, currentSubject, sessionQuestionsCount]);

    // 3. Výpočet detailních statistik z historie (Testy, Průměr, Max)
    const detailedStats = useMemo(() => {
        if (filteredHistory.length === 0) {
            return { count: 0, average: 0, best: 0 };
        }

        let totalPercent = 0;
        let maxPercent = 0;

        filteredHistory.forEach(item => {
            const total = item.score?.total || 1;
            const correct = item.score?.correct || 0;
            const percent = (correct / total) * 100;

            totalPercent += percent;
            if (percent > maxPercent) maxPercent = percent;
        });

        return {
            count: filteredHistory.length,
            average: Math.round(totalPercent / filteredHistory.length),
            best: Math.round(maxPercent)
        };
    }, [filteredHistory]);

    // Pomocná funkce pro ikonu módu
    const getModeIcon = (mode) => {
        switch(mode) {
            case 'mock': return '⏱️';
            case 'smart': return '🎓';
            case 'random': return '🧠';
            case 'training': return '🏋️';
            case 'mistakes': return '🚑';
            default: return '📝';
        }
    };

    // Pomocná funkce pro název módu
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

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>
                        ← <span className="mobile-hide-text">Zpět do menu</span>
                    </button>
                </div>
                <div className="navbar-group">
                    <UserBadgeDisplay user={user} syncing={syncing} />
                </div>
            </div>

            <div className="quizContentWrapper" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <h1 className="title">
                    Historie výsledků {currentSubject ? `(${currentSubject})` : ''}
                </h1>

                {/* KARTY STATISTIK (Reflektují filtr + session) */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                    gap: '1rem', 
                    marginBottom: '2rem',
                    width: '100%'
                }}>
                    {/* 1. Celkový čas */}
                    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>⏳</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'center' }}>Celkový čas</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary-light)' }}>
                            {formatFullTime(totalTime)}
                        </div>
                    </div>

                    {/* 2. Zodpovězeno */}
                    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>✅</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'center' }}>Zodpovězeno otázek</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                            {totalQuestions}
                        </div>
                    </div>

                    {/* 3. Počet testů */}
                    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>📝</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'center' }}>Dokončené testy</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                            {detailedStats.count}
                        </div>
                    </div>

                    {/* 4. Průměrná úspěšnost */}
                    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>📊</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'center' }}>Průměrná úspěšnost</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: detailedStats.average >= 75 ? 'var(--color-success)' : detailedStats.average >= 50 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                            {detailedStats.average}%
                        </div>
                    </div>

                    {/* 5. Nejlepší výsledek */}
                    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>🏆</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'center' }}>Nejlepší skóre</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>
                            {detailedStats.best}%
                        </div>
                    </div>
                </div>

                {/* GRAF (Bar chart) */}
                <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>Vývoj úspěšnosti</h3>
                    <div style={{ height: '250px', width: '100%' }}>
                        <HistoryGraph data={filteredHistory} />
                    </div>
                </div>

                {/* SEZNAM HISTORIE */}
                <h3 style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>Poslední aktivity</h3>

                {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
                        {currentSubject 
                            ? `Zatím žádná historie pro ${currentSubject}.`
                            : "Zatím žádná historie. Hurá do učení! 🚀"}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {filteredHistory.map((item) => {
                            const date = new Date(item.date);
                            const successRate = item.score?.total > 0 
                                ? Math.round((item.score.correct / item.score.total) * 100) 
                                : 0;

                            // Aktualizovaná logika barev podle nových intervalů
                            let scoreColor = 'var(--color-text-main)';
                            if (successRate >= 84) scoreColor = '#22c55e'; // 1 (84-100%)
                            else if (successRate >= 67) scoreColor = '#84cc16'; // 2 (67-83%)
                            else if (successRate >= 50) scoreColor = '#eab308'; // 3 (50-66%)
                            else if (successRate >= 33) scoreColor = '#f97316'; // 4 (33-49%)
                            else scoreColor = '#ef4444'; // 5 (0-32%)

                            return (
                                <div key={item.id} className="card" style={{ 
                                    padding: '1rem', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                        <div style={{ 
                                            fontSize: '1.8rem', 
                                            backgroundColor: 'rgba(255,255,255,0.05)', 
                                            width: '50px', 
                                            height: '50px', 
                                            borderRadius: '50%', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center' 
                                        }}>
                                            {getModeIcon(item.mode)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>
                                                {getModeName(item.mode)}
                                                {!currentSubject && item.subject && <span style={{ opacity: 0.6, fontSize: '0.85em', marginLeft: '6px' }}>({item.subject})</span>}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                {date.toLocaleDateString('cs-CZ')} • {date.toLocaleTimeString('cs-CZ', {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: scoreColor }}>
                                                {successRate}%
                                            </div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                                {item.score?.correct}/{item.score?.total}
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => onDeleteRecord(item.id)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '1.2rem',
                                                opacity: 0.4,
                                                padding: '8px',
                                                transition: 'opacity 0.2s',
                                                color: 'var(--color-text-main)'
                                            }}
                                            onMouseOver={(e) => e.target.style.opacity = 1}
                                            onMouseOut={(e) => e.target.style.opacity = 0.4}
                                            title="Smazat záznam"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};