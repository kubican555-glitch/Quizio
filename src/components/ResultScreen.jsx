import React, { useState, useEffect } from 'react';
import { SubjectBadge } from './SubjectBadge';
import { UserBadgeDisplay } from './UserBadgeDisplay';
import { formatTime } from '../utils/formatting';
import { ThemeToggle } from './ThemeToggle';
// getImageUrl už nebude primárně potřeba, ale necháme ho jako fallback
import { getImageUrl } from '../utils/images';
import { HighlightedText } from './HighlightedText';
import { fetchQuestionImage } from '../utils/dataManager';

// Pomocná komponenta pro asynchronní načítání obrázku ve výsledcích
const ResultImage = ({ question, subject, onZoom }) => {
    const [imageSrc, setImageSrc] = useState(question.image_base64 || null);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            // Pokud už máme base64, nic neděláme
            if (question.image_base64) return;

            if (question.id) {
                try {
                    const img = await fetchQuestionImage(question.id);
                    if (isMounted && img) {
                        setImageSrc(img);
                    } else if (isMounted) {
                        // Fallback na starý systém, pokud fetch selže nebo nic nevrátí
                        // (pro případ, že obrázky jsou lokálně v public složce)
                        const fallbackUrl = getImageUrl(subject, question.number);
                        if (fallbackUrl) setImageSrc(fallbackUrl);
                    }
                } catch (e) {
                    console.error("Chyba načítání obrázku ve výsledcích:", e);
                }
            }
        };

        load();

        return () => { isMounted = false; };
    }, [question, subject]);

    if (!imageSrc) return null;

    return (
        <div
            className="imageWrapper small"
            onClick={() => onZoom(imageSrc)}
            style={{ marginBottom: '1rem' }}
        >
            <img
                src={imageSrc}
                alt=""
                className="questionImage small"
                loading="lazy"
            />
        </div>
    );
};

export const ResultScreen = ({
    mode,
    score,
    trainingTime,
    questionSet,
    maxSeenIndex,
    onBack,
    currentSubject,
    timeLeftAtSubmit,
    onZoom,
    user,
    syncing,
    onReport,
    theme,
    toggleTheme
}) => {
    if (mode === 'real_test') {
        const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

        let scoreColor = '#3b82f6';
        if (percentage >= 85) scoreColor = '#22c55e';
        else if (percentage >= 50) scoreColor = '#fbbf24';
        else scoreColor = '#ef4444';

        const circleStyle = {
            background: `conic-gradient(${scoreColor} ${percentage * 3.6}deg, rgba(255,255,255,0.1) 0deg)`
        };

        return (
            <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="top-navbar" style={{ width: '100%', maxWidth: '600px' }}>
                    <div className="navbar-group">
                        <SubjectBadge subject={currentSubject} />
                    </div>
                    <div className="navbar-group">
                        <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile />
                        <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                    </div>
                </div>
                <div className="resultScreen" style={{ maxWidth: '600px', width: '100%', marginTop: 0 }}>
                    <h1 className="title" style={{ marginBottom: '2rem' }}>Výsledek testu</h1>

                    <div className="score-circle-container" style={circleStyle}>
                        <div className="score-circle-inner">
                            <span className="score-percentage" style={{ color: scoreColor }}>{percentage}%</span>
                            <span className="score-fraction">{score.correct} / {score.total}</span>
                        </div>
                    </div>

                    <div style={{ 
                        marginTop: '2rem', 
                        padding: '1.5rem', 
                        background: 'var(--color-card-bg)', 
                        border: '1px solid var(--color-card-border)', 
                        borderRadius: '16px',
                        textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                            Test byl úspěšně odeslán.
                        </p>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Zbývající čas: <strong>{formatTime(timeLeftAtSubmit || 0)}</strong>
                        </p>
                    </div>

                    <button 
                        className="navButton primary" 
                        onClick={onBack} 
                        style={{ width: '100%', marginTop: '2rem', padding: '1rem' }}
                    >
                        Zpět do menu
                    </button>
                </div>
            </div>
        );
    }

    const list =
        mode === "training"
            ? questionSet.slice(0, maxSeenIndex + 1)
            : mode === "smart" || mode === "mistakes"
              ? [] 
              : questionSet;

    if (mode === "smart" || mode === "mistakes") {
        return (
            <div
                className="container fadeIn"
                style={{ justifyContent: "center", alignItems: "center", display: "flex", height: "100%" }}
            >
                <div
                    className="card"
                    style={{
                        textAlign: "center",
                        maxWidth: "500px",
                        width: "100%",
                        padding: "3rem 2rem"
                    }}
                >
                    <div style={{ marginBottom: "1.5rem" }}>
                        <SubjectBadge subject={currentSubject} />
                    </div>
                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
                        {mode === "mistakes" ? "🧹" : "🎓"}
                    </div>
                    <h2 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
                        {mode === "mistakes"
                            ? "Opravna vyčištěna!"
                            : "Balíček dokončen!"}
                    </h2>
                    <p style={{color: 'var(--color-text-secondary)', marginBottom: '2rem'}}>
                        Skvělá práce, pokračuj v učení!
                    </p>
                    <div
                        className="timer"
                        style={{ marginBottom: "2rem", fontSize: "1.2rem", display: 'inline-flex' }}
                    >
                        ⏱️ {formatTime(trainingTime)}
                    </div>
                    <button
                        className="navButton primary"
                        style={{ width: "100%" }}
                        onClick={onBack}
                    >
                        Zpět do menu
                    </button>
                </div>
            </div>
        );
    }

    const percentage = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);

    let circleColor = "#3b82f6";
    if (percentage >= 80) circleColor = "#22c55e";
    else if (percentage < 50) circleColor = "#ef4444";
    else circleColor = "#fbbf24";

    const circleStyle = {
        background: `conic-gradient(${circleColor} ${percentage * 3.6}deg, rgba(255,255,255,0.1) 0deg)`
    };

    return (
        <div className="container fadeIn">
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>
                        ← <span className="mobile-hide-text">Menu</span>
                    </button>
                    <SubjectBadge subject={currentSubject} />
                </div>
                <div className="navbar-group">
                    <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>

            <div className="resultScreen">
                <h2 className="title" style={{marginBottom: '2rem'}}>
                    {mode === "mock" ? "Výsledek testu" : "Souhrn tréninku"}
                </h2>

                <div className="score-circle-container" style={circleStyle}>
                    <div className="score-circle-inner">
                        <span className="score-percentage">{percentage}%</span>
                        <span className="score-fraction">{score.correct} / {score.total}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', color: 'var(--color-text-secondary)', fontSize: '1.1rem', gap: '0.5rem', alignItems: 'center' }}>
                     <span>⏱️ Doba trvání:</span>
                     <span style={{ fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                        {mode === "mock" ? formatTime(30 * 60 - timeLeftAtSubmit) : formatTime(trainingTime)}
                     </span>
                </div>

                <div className="review-header-title">
                    🔍 Přehled odpovědí
                </div>

                <div className="reviewList">
                    {list.map((q, i) => {
                        const isCorrect = q.userAnswer === q.correctIndex;
                        const isUnanswered = q.userAnswer === undefined;

                        let statusIcon = "✅";
                        let statusColor = "var(--color-success)";

                        if (isUnanswered) {
                            statusIcon = "⚪";
                            statusColor = "var(--color-text-neutral)";
                        } else if (!isCorrect) {
                            statusIcon = "❌";
                            statusColor = "var(--color-error)";
                        }

                        const borderColor = isCorrect 
                            ? "var(--color-success)" 
                            : isUnanswered 
                                ? "var(--color-text-neutral)" 
                                : "var(--color-error)";

                        return (
                            <div 
                                key={i} 
                                className="review-item"
                                style={{ 
                                    borderLeft: `5px solid ${borderColor}`,
                                }}
                            >
                                <div className={`review-item-content ${isCorrect ? "correct" : isUnanswered ? "unanswered" : "wrong"}`}>
                                    <div className="review-item-header">
                                        <div style={{ flex: 1 }}>
                                            <span className="review-number">
                                                Otázka {i + 1} <span style={{ opacity: 0.7, fontWeight: 'normal' }}>(#{q.number})</span>
                                                <button
                                                    onClick={() => onReport(q.number)}
                                                    className="report-btn-inline"
                                                    title="Nahlásit chybu"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        fontSize: '0.9rem',
                                                        cursor: 'pointer',
                                                        marginLeft: '10px',
                                                        opacity: 0.6,
                                                        padding: '2px 6px',
                                                        borderRadius: '4px'
                                                    }}
                                                >
                                                    🏳️
                                                </button>
                                            </span>
                                            <div className="review-question-text">
                                                <HighlightedText text={q.question} />
                                            </div>
                                        </div>
                                        <div className="review-status-icon" style={{ color: statusColor }}>
                                            {statusIcon}
                                        </div>
                                    </div>

                                    {/* POUŽITÍ NOVÉ KOMPONENTY PRO OBRÁZEK */}
                                    <ResultImage 
                                        question={q} 
                                        subject={currentSubject} 
                                        onZoom={onZoom} 
                                    />

                                    <div className="review-answers-grid">
                                        <div className="review-answer-row">
                                            <span className="label-correct">Správně:</span>
                                            <span className="text-val highlight">
                                                <HighlightedText text={q.options[q.correctIndex]} />
                                            </span>
                                        </div>

                                        {!isCorrect && (
                                            <div className="review-answer-row">
                                                <span className="label-wrong">Tvoje:</span>
                                                <span className="text-val">
                                                    {isUnanswered ? (
                                                        <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Neodpovězeno</span>
                                                    ) : (
                                                        <HighlightedText text={q.options[q.userAnswer]} />
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    className="navButton primary"
                    style={{ marginTop: "3rem", width: "100%", padding: "1.2rem", fontSize: "1.1rem" }}
                    onClick={onBack}
                >
                    Zpět do hlavního menu
                </button>
            </div>
        </div>
    );
};