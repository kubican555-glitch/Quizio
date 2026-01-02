import React from 'react';
import { SubjectBadge } from './SubjectBadge';
import { UserBadgeDisplay } from './UserBadgeDisplay';
import { ThemeToggle } from './ThemeToggle';

export function ScheduledTestsList({ 
    scheduledTests, 
    onBack, 
    subject, 
    user, 
    syncing, 
    theme, 
    toggleTheme, 
    onStartGradedTest, 
    onStartPractice,
    completedTestIds = [],
    testPracticeStats = {},
    onRefresh // PŘIDÁNO
}) {
    // Helper funkce pro formátování data
    const formatDate = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            {/* --- TOP NAVBAR --- */}
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>
                        <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span>
                        <span className="mobile-hide-text">Zpět</span>
                    </button>
                    <div className="mobile-hidden">
                        <SubjectBadge subject={subject} compact />
                    </div>
                </div>
                <div className="navbar-group">
                     {/* TLAČÍTKO OBNOVIT */}
                     <button 
                        className="menuBackButton" 
                        onClick={onRefresh}
                        title="Obnovit seznam testů"
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            border: '1px solid rgba(255, 255, 255, 0.1)', 
                            cursor: 'pointer',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        🔄
                    </button>

                    <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile={true} />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>

            <div className="quizContentWrapper">
                {/* --- HEADER --- */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 className="title" style={{ marginBottom: '0.5rem' }}>Naplánované testy</h1>
                    <p className="subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        Zde najdeš přehled všech písemek vypsaných učitelem. Můžeš si je nanečisto vyzkoušet nebo spustit ostrý test.
                    </p>
                </div>

                {/* --- EMPTY STATE --- */}
                {scheduledTests.length === 0 ? (
                    <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: "4rem 2rem", 
                        color: "var(--color-text-secondary)",
                        background: "var(--color-card-bg)",
                        borderRadius: "24px",
                        border: "1px solid var(--color-card-border)",
                        marginTop: "1rem",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.05)"
                    }}>
                        <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.8 }}>📭</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "0.5rem", color: "var(--color-text-main)" }}>Zatím žádné testy</div>
                        <div style={{ fontSize: "1rem", opacity: 0.8 }}>Až učitel vypíše novou písemku, objeví se přímo zde.</div>
                    </div>
                ) : (
                    /* --- GRID TESTŮ --- */
                    <div className="tests-grid" style={{ display: 'grid', gap: '1.5rem', width: '100%' }}>
                        {scheduledTests.map(test => {
                            const now = new Date();
                            // Pokud nejsou data vyplněna, považujeme test za "Budoucí / Neurčeno"
                            const hasDates = test.open_at && test.close_at;
                            const isOpen = hasDates && now >= new Date(test.open_at) && now <= new Date(test.close_at);
                            const isUpcoming = hasDates && now < new Date(test.open_at);
                            const isCompleted = completedTestIds.includes(test.id);

                            // Výpočet úspěšnosti
                            const stats = testPracticeStats[test.id] || [];
                            let successRate = null;
                            if (stats.length > 0) {
                                const correctCount = stats.filter(Boolean).length;
                                successRate = Math.round((correctCount / stats.length) * 100);
                            }

                            // Konfigurace vzhledu podle stavu
                            let statusConfig = {
                                color: "#94a3b8", // Šedá (Default/Uzavřeno)
                                bg: "rgba(148, 163, 184, 0.15)",
                                border: "rgba(148, 163, 184, 0.3)",
                                icon: "🔒",
                                text: "Uzavřeno"
                            };

                            if (isCompleted) {
                                statusConfig = { color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)", icon: "✅", text: "Dokončeno" };
                            } else if (isOpen) {
                                statusConfig = { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)", icon: "🚀", text: "Probíhá" };
                            } else if (isUpcoming) {
                                statusConfig = { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", icon: "⏳", text: "Připravuje se" };
                            } else if (!hasDates) {
                                statusConfig = { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", icon: "📅", text: "Termín neurčen" };
                            }

                            return (
                                <div key={test.id} className="reviewCard" style={{ 
                                    padding: '0', 
                                    borderRadius: '20px', 
                                    overflow: 'hidden',
                                    border: `1px solid var(--color-card-border)`,
                                    background: 'var(--color-card-bg)', // Důležité pro oddělení od pozadí
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)', // Výraznější stín
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    position: 'relative'
                                }}>
                                    {/* Barevný pruh vlevo pro rychlou identifikaci */}
                                    <div style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '6px',
                                        background: statusConfig.color
                                    }}></div>

                                    {/* --- KARTA HLAVIČKA --- */}
                                    <div style={{ 
                                        padding: '1.5rem', 
                                        borderBottom: '1px solid var(--color-card-border)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '1rem',
                                        paddingLeft: '1.8rem' // Odsazení kvůli barevnému pruhu
                                    }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.5px' }}>
                                                {test.title}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.6rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
                                                <span title="Počet otázek">❓ {test.question_count} otázek</span>
                                                <span style={{ opacity: 0.3 }}>|</span>
                                                <span title="Časový limit">⏱️ {test.time_limit} min</span>
                                            </div>
                                        </div>

                                        {/* Badge stavu */}
                                        <div style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.4rem',
                                            padding: '6px 14px', 
                                            borderRadius: '20px', 
                                            background: statusConfig.bg, 
                                            color: statusConfig.color, 
                                            border: `1px solid ${statusConfig.border}`,
                                            fontSize: '0.85rem', 
                                            fontWeight: '700', 
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            <span>{statusConfig.icon}</span>
                                            {statusConfig.text}
                                        </div>
                                    </div>

                                    {/* --- KARTA TĚLO (Časy & Stats) --- */}
                                    <div style={{ padding: '1.5rem', paddingLeft: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                        {/* Časová osa (jen pokud jsou data zadána) */}
                                        {hasDates ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--color-card-border)' }}>
                                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-neutral)', fontWeight: '700', marginBottom: '0.3rem' }}>Otevření</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                                                        {formatDate(test.open_at)} <span style={{ color: 'var(--color-text-secondary)', fontWeight: '400' }}>v {formatTime(test.open_at)}</span>
                                                    </div>
                                                </div>
                                                <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--color-card-border)' }}>
                                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-neutral)', fontWeight: '700', marginBottom: '0.3rem' }}>Uzavření</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                                                        {formatDate(test.close_at)} <span style={{ color: 'var(--color-text-secondary)', fontWeight: '400' }}>v {formatTime(test.close_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-card-border)', textAlign: 'center', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                                                Termín testu bude upřesněn učitelem.
                                            </div>
                                        )}

                                        {/* Statistiky procvičování */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            background: `linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)`,
                                            padding: '0.8rem 1.2rem',
                                            borderRadius: '12px',
                                            border: '1px solid var(--color-card-border)'
                                        }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-secondary)' }}>
                                                🎯 Tvoje úspěšnost v procvičování:
                                            </span>
                                            {successRate !== null ? (
                                                <span style={{ 
                                                    fontSize: '1.2rem', 
                                                    fontWeight: '900', 
                                                    color: successRate >= 80 ? 'var(--color-success)' : successRate < 50 ? 'var(--color-error)' : 'var(--color-warning)'
                                                }}>
                                                    {successRate}%
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-neutral)', fontStyle: 'italic' }}>Zatím neprocvičováno</span>
                                            )}
                                        </div>

                                        {/* --- TLAČÍTKA AKCÍ --- */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>

                                            {/* Tlačítko OSTRÝ TEST */}
                                            <button 
                                                onClick={() => !isCompleted && onStartGradedTest(test)}
                                                disabled={!isOpen || isCompleted}
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: '12px',
                                                    border: isCompleted 
                                                        ? '2px solid var(--color-success)' 
                                                        : (isOpen ? 'none' : '2px solid var(--color-card-border)'),
                                                    fontSize: '1rem',
                                                    fontWeight: '800', // Zvýšena váha písma
                                                    cursor: (!isOpen || isCompleted) ? 'not-allowed' : 'pointer',
                                                    background: isCompleted 
                                                        ? 'var(--color-card-bg)' 
                                                        : (isOpen ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'var(--color-card-bg)'), // Výraznější gradient
                                                    color: isCompleted 
                                                        ? 'var(--color-success)' 
                                                        : (isOpen ? '#ffffff' : 'var(--color-text-neutral)'),
                                                    boxShadow: isOpen && !isCompleted ? '0 8px 25px rgba(59, 130, 246, 0.5)' : 'none', // Silnější stín
                                                    opacity: (!isOpen && !isCompleted) ? 0.6 : 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    transition: 'all 0.2s',
                                                    transform: isOpen && !isCompleted ? 'scale(1.02)' : 'none', // Mírné zvětšení pro důraz
                                                    textTransform: 'uppercase', // Kapitálky pro důraz
                                                    letterSpacing: '1px'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isOpen && !isCompleted) {
                                                        e.currentTarget.style.transform = 'scale(1.05)';
                                                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.6)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (isOpen && !isCompleted) {
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.5)';
                                                    }
                                                }}
                                            >
                                                {isCompleted ? (
                                                    <><span>✅</span> Odevzdáno</>
                                                ) : isOpen ? (
                                                    <><span>🚀</span> Spustit test</>
                                                ) : isUpcoming ? (
                                                    <><span>⏳</span> Čekejte</>
                                                ) : (!hasDates) ? (
                                                    <><span>📅</span> Termín neurčen</>
                                                ) : (
                                                    <><span>🔒</span> Uzavřeno</>
                                                )}
                                            </button>

                                            {/* Tlačítko PROCVIČIT */}
                                            <button 
                                                onClick={() => onStartPractice(test)}
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: '12px',
                                                    border: '2px solid var(--color-primary)',
                                                    background: 'transparent',
                                                    color: 'var(--color-primary)',
                                                    fontSize: '1rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--color-primary)';
                                                    e.currentTarget.style.color = '#ffffff';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = 'var(--color-primary)';
                                                }}
                                            >
                                                <span>🧠</span> Procvičit otázky
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}