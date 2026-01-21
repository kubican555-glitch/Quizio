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
                    📌 Máš aktivní písemku! Klikni zde pro otevření.
                </div>
            )}

            {/* --- STANDARDNÍ MENU --- */}
            <button className={`menuButton primary-style ${menuSelection % 8 === 0 && isKeyboardMode ? "selected" : ""}`} onClick={onStartMock}>
                <span style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'left' }}>Test nanečisto</span>
                <div className="test-details"><span>⏱️ 30 min</span><span>❓ 40 otázek</span></div>
                <div className="test-icon-container">✅</div>
            </button>

            <div className="menuColumn" style={{ marginTop: '0', maxWidth: '700px' }}>
                <div className="menuGrid">

                {/* ZMĚNA: Tlačítko se zobrazí pouze pokud existuje alespoň jeden test (scheduledTests.length > 0).
                    Odstraněno "|| isTeacher", protože učitel má své vlastní tlačítko níže. */}
                {scheduledTests.length > 0 && canSeeScheduledTests && (
                    <button className={`menuButton list-style menuSpanFull ${menuSelection % 8 === 1 && isKeyboardMode ? "selected" : ""}`} onClick={onOpenScheduled}>
                        <span className="list-icon">📅</span>
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
                    <span className="list-icon">🔎</span>
                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Prohlížení otázek</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Vyhledávání a kontrola otázek.</small></div>
                </button>

                <button className={`menuButton list-style ${menuSelection % 8 === 7 && isKeyboardMode ? "selected" : ""}`} onClick={onOpenHistory}>
                    <span className="list-icon">📊</span>
                    <span style={{ flexGrow: 1, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>Historie výsledků</span>
                        <small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Přehled dosažených výsledků a trendů.</small>
                    </span>
                </button>

                {/* Tlačítko pro správu testů - vidí ho jen učitel */}
                {isTeacher && (
                    <button 
                        className={`menuButton list-style menuSpanFull ${menuSelection % 8 === 5 && isKeyboardMode ? "selected" : ""}`} 
                        onClick={onOpenTeacherManager} 
                        style={{ 
                            borderColor: 'var(--color-primary)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex'
                        }}
                    >
                        <span className="list-icon">🛠️</span>
                        <div style={{ flexGrow: 1, textAlign: 'left' }}>
                            <span style={{ display: 'block', fontWeight: 600 }}>Správa testů</span>
                            <small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>
                                Plánování písemek a přehled výsledků.
                            </small>
                        </div>
                    </button>
                )}

                <button className={`menuButton list-style danger-style menuSpanFull ${menuSelection % 8 === 6 && isKeyboardMode ? "selected" : ""}`} onClick={onStartMistakes}>
                    <span className="list-icon">🚑</span>
                    <span style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600, color: 'var(--color-text-main)' }}>Opravna chyb</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Znovu testuje pouze otázky, ve kterých jsi chyboval.</small></span>
                    {mistakesCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>({mistakesCount})</span>
                            <button onClick={(e) => { e.stopPropagation(); onClearMistakes(); }} title="Vymazat všechny chyby" className="clearMistakesIcon" style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', padding: '0', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                        </div>
                    ) : (<span style={{ opacity: 0.6 }}>?</span>)}
                </button>

                </div>
            </div>
        </div>
    );
};
