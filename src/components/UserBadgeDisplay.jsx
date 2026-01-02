import React, { useState, useEffect } from 'react';

export const UserBadgeDisplay = ({ user, syncing, onLogout, compactOnMobile, alwaysShowFullName }) => {
    const [showCloud, setShowCloud] = useState(false);
    // Detekce mobilu pomocí JS místo CSS - zabrání zdvojení textu
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 600px)').matches : false
    );

    useEffect(() => {
        let timeout;
        if (syncing) {
            setShowCloud(true);
        } else {
            timeout = setTimeout(() => setShowCloud(false), 500);
        }
        return () => clearTimeout(timeout);
    }, [syncing]);

    // Listener pro změnu velikosti okna
    useEffect(() => {
        const media = window.matchMedia('(max-width: 600px)');
        const listener = (e) => setIsMobile(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    if (!user) return null;

    const firstName = user.split(' ')[0];

    // Logika pro zobrazení jména:
    // 1. Pokud je alwaysShowFullName -> Vždy celé jméno
    // 2. Jinak, pokud je mobil (isMobile) -> Jen křestní
    // 3. Jinak (PC) -> Celé jméno
    const displayName = alwaysShowFullName 
        ? user 
        : (isMobile ? firstName : user);

    return (
        <div 
            className={`user-badge ${compactOnMobile ? 'compact' : ''}`}
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem', 
                background: 'rgba(255,255,255,0.1)', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '50px', 
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(5px)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {/* Avatar / Ikona */}
                <div
                    style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--color-primary) 0%, #3b82f6 100%)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        flexShrink: 0 
                    }}
                >
                    {user.charAt(0).toUpperCase()}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Jméno uživatele - Vykreslí se jen JEDNOU */}
                    <span 
                        style={{ 
                            fontWeight: '600', 
                            fontSize: '0.95rem', 
                            color: 'var(--color-text-main)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {displayName}
                    </span>

                      {/* Cloud Ikona */}
                    <span 
                        style={{ 
                            fontSize: "0.9rem", 
                            opacity: showCloud ? 1 : 0,
                            transition: "opacity 0.3s ease",
                            // Rezervace místa jen ve hře (compact), v menu ne
                            display: compactOnMobile ? "inline-block" : (showCloud ? "inline-block" : "none"), 
                            width: compactOnMobile ? "1.2em" : "auto", 
                            textAlign: "center",
                            visibility: compactOnMobile ? (showCloud ? 'visible' : 'hidden') : 'visible',
                            animation: syncing ? "pulseSync 1.5s ease-in-out infinite" : "none",
                            willChange: "transform, opacity"
                        }}
                    >
                        ☁️
                        <style>{`
                            @keyframes pulseSync {
                                0% { opacity: 0.4; transform: scale(0.9) translate3d(0,0,0); }
                                50% { opacity: 1; transform: scale(1.1) translate3d(0,0,0); }
                                100% { opacity: 0.4; transform: scale(0.9) translate3d(0,0,0); }
                            }
                        `}</style>
                    </span>
                </div>
            </div>

            {/* Tlačítko odhlášení */}
            {onLogout && (
                <button 
                    onClick={onLogout} 
                    className="logout-btn"
                    title="Odhlásit se"
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: '0 0 0 0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-error, #ef4444)',
                        opacity: 0.8,
                        marginLeft: 'auto'
                    }}
                >
                    {/* New square with arrow icon */}
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="18" 
                        height="18" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            )}
        </div>
    );
};