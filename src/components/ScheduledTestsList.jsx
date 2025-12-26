import React from "react";
import { SubjectBadge } from "./SubjectBadge.jsx";
import { UserBadgeDisplay } from "./UserBadgeDisplay.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

export const ScheduledTestsList = ({
    scheduledTests,
    onBack,
    subject,
    user,
    syncing,
    theme,
    toggleTheme,
    onStartGradedTest,
    onStartPractice
}) => {
    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>← <span className="mobile-hide-text">Zpět do menu</span></button>
                    <SubjectBadge subject={subject} compact />
                </div>
                <div className="navbar-group">
                    <UserBadgeDisplay user={user} syncing={syncing} />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>
            <h1 className="title">Plánované testy 📅</h1>

            <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: '1rem' }}>
                {scheduledTests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-neutral)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                        <h3>Žádné testy</h3>
                        <p>Učitel zatím nenaplánoval žádné písemky.</p>
                    </div>
                ) : (
                    scheduledTests.map(test => {
                        const now = new Date();
                        const isOpen = now >= new Date(test.open_at) && now <= new Date(test.close_at);
                        const isClosed = now > new Date(test.close_at);

                        // Fake readiness data
                        const readiness = Math.round(Math.random() * 40 + 60); 

                        return (
                            <div key={test.id} className="card" style={{padding:'1rem', marginBottom:'1rem', borderLeft: isOpen ? '5px solid var(--color-success)' : '5px solid var(--color-border)'}}>
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                                    <div>
                                        <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{test.title}</div>
                                        <div style={{fontSize:'0.9rem', opacity:0.8, marginTop:'0.2rem'}}>Rozsah: {test.topic_range_start}-{test.topic_range_end} • {test.time_limit} min</div>
                                        <div style={{fontSize:'0.8rem', marginTop:'0.5rem', color: isOpen ? 'var(--color-success)' : (isClosed ? 'var(--color-error)' : 'var(--color-warning)')}}>{isOpen ? '🟢 OTEVŘENO - Probíhá' : (isClosed ? '🔴 UZAVŘENO' : `🟡 Otevře se: ${new Date(test.open_at).toLocaleString()}`)}</div>
                                    </div>
                                    {isOpen && (
                                        <button className="navButton primary" style={{boxShadow:'0 4px 15px rgba(34, 197, 94, 0.4)', background:'var(--color-success)', border:'none', color:'white'}} onClick={() => onStartGradedTest(test)}>SPUSTIT TEST ✍️</button>
                                    )}
                                </div>
                                <div style={{marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <div style={{fontSize:'0.9rem'}}><span style={{opacity:0.7}}>Tvoje připravenost:</span> <strong style={{color:'var(--color-primary-light)'}}>{readiness}%</strong> (posl. 20)</div>
                                    <button className="navButton" style={{padding:'0.4rem 1rem', fontSize:'0.85rem'}} onClick={() => onStartPractice(test)}>Procvičit rozsah 🎓</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};