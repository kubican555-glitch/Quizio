import React from "react";

export const MainMenu = ({
    scheduledTests,
    completedTestIds = [], // Defaultní hodnota pro jistotu
    menuSelection,
    isKeyboardMode,
    isTeacher,
    userClass,
    mistakesCount,
    onOpenScheduled,
    onStartMock,
    onStartSmart,
    onStartRandom,
    onStartReview,
    onOpenTeacherManager,
    onStartMistakes,
    onClearMistakes,
    onOpenHistory
}) => {
    const canSeeScheduledTests = userClass === "4.B";

    // Filtrujeme aktivní testy: musí být otevřené A ZÁROVEŇ nesmí být hotové
    // Slouží pro Badge (červené číslo)
    const activeTestsCount = scheduledTests.filter(test => {
        const now = new Date();
        const isOpen = now >= new Date(test.open_at) && now <= new Date(test.close_at);
        const isCompleted = completedTestIds.includes(test.id);
        return isOpen && !isCompleted; 
    }).length;

    return (
        <div className="menuColumn" style={{ maxWidth: '600px' }}>
            {/* Rychlé upozornění nahoře - ZMĚNA: Kontrola isCompleted */}
            {canSeeScheduledTests && scheduledTests.some(t => {
                const now = new Date();
                const isOpen = now >= new Date(t.open_at) && now <= new Date(t.close_at);
                const isCompleted = completedTestIds.includes(t.id);
                return isOpen && !isCompleted; // Zobrazit jen pokud NENÍ hotovo
            }) && (
                <div className="alert-box" style={{marginBottom: '1rem', cursor: 'pointer'}} onClick={onOpenScheduled}>
                    🔔 Máš aktivní písemku! Klikni zde pro otevření.
                </div>
            )}

            {/* --- STANDARDNÍ MENU --- */}
            <button className={`menuButton primary-style ${menuSelection % 8 === 0 && isKeyboardMode ? "selected" : ""}`} onClick={onStartMock}>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'left' }}>Test nanečisto</span>
                <div className="test-details"><span>⏱️ 30 min</span><span>❓ 40 otázek</span></div>
                <div className="test-icon-container">✅</div>
            </button>

            <div className="menuColumn" style={{ marginTop: '0', maxWidth: '600px' }}>

                {/* ZMĚNA: Tlačítko se zobrazí pouze pokud existuje alespoň jeden test (scheduledTests.length > 0).
                    Odstraněno "|| isTeacher", protože učitel má své vlastní tlačítko níže. */}
                {scheduledTests.length > 0 && canSeeScheduledTests && (
                    <button className={`menuButton list-style ${menuSelection % 8 === 1 && isKeyboardMode ? "selected" : ""}`} onClick={onOpenScheduled}>
                        <span className="list-icon">🗓️</span>
                        <div style={{ flexGrow: 1, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>Plánované testy</span>
                            <small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Písemky a úkoly zadané učitelem.</small>
                        </div>
                        {/* Badge zobrazuje počet aktivních NEHOTOVÝCH testů */}
                        {activeTestsCount > 0 && <span className="badge">{activeTestsCount}</span>}
                    </button>
                )}

                <button className={`menuButton list-style ${menuSelection % 8 === 2 && isKeyboardMode ? "selected" : ""}`} onClick={onStartSmart}>
                    <span className="list-icon">🎓</span>
                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Chytré učení</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Opakování s rozestupy dle historie tvých chyb.</small></div>
                </button>
                <button className={`menuButton list-style ${menuSelection % 8 === 3 && isKeyboardMode ? "selected" : ""}`} onClick={onStartRandom}>
                    <span className="list-icon">🧠</span>
                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Flashcards</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Náhodný trénink s okamžitou kontrolou.</small></div>
                </button>

                <button className={`menuButton list-style ${menuSelection % 8 === 4 && isKeyboardMode ? "selected" : ""}`} onClick={onStartReview}>
                    <span className="list-icon">📚</span>
                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Prohlížení otázek</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Vyhledávání a kontrola všech otázek v přehledném gridu.</small></div>
                </button>

                {/* Tlačítko pro správu testů - vidí ho jen učitel */}
                {isTeacher && (
                    <button 
                        className={`menuButton list-style ${menuSelection % 8 === 5 && isKeyboardMode ? "selected" : ""}`} 
                        onClick={onOpenTeacherManager} 
                        style={{ 
                            marginTop: '0.5rem', 
                            borderColor: 'var(--color-primary)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex'
                        }}
                    >
                        <span className="list-icon">👨‍🏫</span>
                        <div style={{ flexGrow: 1, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>Správa testů</span>
                            <small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>
                                Plánování písemek a přehled výsledků.
                            </small>
                        </div>
                    </button>
                )}

                <button className={`menuButton list-style danger-style ${menuSelection % 8 === 6 && isKeyboardMode ? "selected" : ""}`} onClick={onStartMistakes} style={{ marginTop: '1.5rem' }}>
                    <span className="list-icon">🚑</span>
                    <span style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600, color: 'var(--color-text-main)' }}>Opravna chyb</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Znovu testuje pouze otázky, ve kterých jsi chyboval.</small></span>
                    {mistakesCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>({mistakesCount})</span>
                            <button onClick={(e) => { e.stopPropagation(); onClearMistakes(); }} title="Vymazat všechny chyby" className="clearMistakesIcon" style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', padding: '0', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                        </div>
                    ) : (<span style={{ opacity: 0.6 }}>✓</span>)}
                </button>

                <div 
                    className={`history-footer-btn ${menuSelection % 8 === 7 && isKeyboardMode ? "selected" : ""}`} 
                    onClick={onOpenHistory} 
                    style={{ 
                        marginTop: '1.5rem', 
                        padding: '0.8rem 1.2rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: menuSelection % 8 === 7 && isKeyboardMode ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s ease',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        width: 'fit-content',
                        margin: '1.5rem auto 0 auto',
                        boxShadow: menuSelection % 8 === 7 && isKeyboardMode ? '0 0 15px rgba(59, 130, 246, 0.2)' : 'none'
                    }}
                >
                    <span>Historie výsledků</span>
                    <span style={{ opacity: 0.8 }}>📊</span>
                </div>
                <div className="keyboard-hints" style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6", flexShrink: 0, marginBottom: "1rem" }}>
                    Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />Mezerník – potvrzení • Enter – potvrzení / další • Esc – zrušit
                </div>
            </div>
        </div>
    );
};
