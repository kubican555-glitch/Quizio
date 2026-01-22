import React, { useState, useEffect } from 'react';
// Upravené cesty s prefixem 'kubican555-glitch/quizio/Quizio-37f55dfe6f961128ab030f5bfef91a0dc9284bbf/src/'
import { HighlightedText } from './HighlightedText.jsx';
import { SubjectBadge } from './SubjectBadge.jsx';
import { UserBadgeDisplay } from './UserBadgeDisplay.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { removeAccents, getSmartRegex } from '../utils/formatting.js';
import { getImageUrl } from '../utils/images.js';

export function ReviewSession({
    subject,
    questions, // pole otázek (activeTrainingQuestions)
    user,
    syncing,
    theme,
    toggleTheme,
    onBack,
    onZoom // funkce pro fullscreen obrázek (setFullscreenImage z App)
}) {
    const [searchTerm, setSearchTerm] = useState("");

    // Ošetření klávesnice pro rychlý návrat
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onBack();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onBack]);

    // Logika filtrování
    const normalizedSearch = removeAccents(searchTerm);
    const filteredQuestions = questions.filter((q) => 
        removeAccents(q.question).includes(normalizedSearch) || 
        String(q.number).includes(normalizedSearch)
    );
    const highlightRegex = getSmartRegex(searchTerm);
    const showSubjectBadge = Boolean(subject);
    const modeBadge = { label: "Prohl\u00ed\u017een\u00ed ot\u00e1zek", icon: "\uD83D\uDD0E" };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
            <div className="top-navbar navbar-tiered">
                                <div className="navbar-group nav-primary">

                    <button className="menuBackButton" onClick={onBack}>
                        ← <span className="mobile-hide-text">Zpět</span>
                    </button>
                </div>
                <div className="navbar-group nav-status">
                    <div className="subjectBadgeGroup">
                        {showSubjectBadge && (
                            <SubjectBadge subject={subject} compact matchUserBadge />
                        )}
                        {modeBadge && (
                            <>
                                {showSubjectBadge && (
                                    <span className="subjectBadgeDivider">
                                        |
                                    </span>
                                )}
                                <div className="modeBadge">
                                    <span className="modeBadgeIcon">
                                        {modeBadge.icon}
                                    </span>
                                    <span>{modeBadge.label}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="navbar-group nav-actions">
                    <UserBadgeDisplay user={user} syncing={syncing} />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>


            <input 
                type="text" 
                placeholder="Hledat..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="reviewSearchInput" 
                autoFocus
            />

            <div className="reviewGrid">
                {filteredQuestions.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#888", gridColumn: "1/-1" }}>Nic nenalezeno.</p>
                ) : (
                    filteredQuestions.map((q) => {
                        const imageUrl = getImageUrl(subject, q.number);
                        return (
                            <div key={q.number} className="reviewCard">
                                <div className="reviewHeader">
                                    <strong>#{q.number}.</strong> <HighlightedText text={q.question} highlightRegex={highlightRegex} />
                                </div>
                                {imageUrl && (
                                    <div className="imageWrapper" onClick={() => onZoom(imageUrl)}>
                                        <img src={imageUrl} alt="" className="reviewImage" />
                                    </div>
                                )}
                                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    {q.options.map((opt, idx) => (
                                        <div key={idx} style={{ 
                                            fontSize: "0.9rem", 
                                            color: idx === q.correctIndex ? "var(--color-review-correct)" : "var(--color-text-secondary)", 
                                            fontWeight: idx === q.correctIndex ? "bold" : "normal" 
                                        }}>
                                            <span>{idx === q.correctIndex ? "✅" : "•"}</span> <span><HighlightedText text={opt} highlightRegex={highlightRegex} /></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
