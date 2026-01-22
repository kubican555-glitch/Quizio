import React, { useState, useEffect } from 'react';

export const UserBadgeDisplay = ({ user, onLogout, compactOnMobile, alwaysShowFullName }) => {
    // Bezpečný check pro SSR (Server Side Rendering) prostředí
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(max-width: 600px)').matches;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const media = window.matchMedia('(max-width: 600px)');
            const listener = (e) => setIsMobile(e.matches);
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        }
    }, []);

    if (!user) return null;

    // Získání křestního jména (pokud je user "Jméno Příjmení")
    const firstName = user.includes(' ') ? user.split(' ')[0] : user;

    const displayName = alwaysShowFullName 
        ? user 
        : (isMobile ? firstName : user);

    // První písmeno pro avatara
    const firstLetter = user.charAt(0).toUpperCase();

    return (
        <div 
            className={`user-badge ${compactOnMobile ? 'compact' : ''}`}
            style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.6rem', 
                background: 'rgba(15, 23, 42, 0.55)', 
                padding: '0 0.8rem', 
                height: 'var(--nav-control-height)',
                borderRadius: '8px', 
                border: '1px solid rgba(148, 163, 184, 0.2)',
                backdropFilter: 'blur(5px)',
                transition: 'all 0.2s ease',
                boxShadow: '0 8px 18px rgba(8, 12, 26, 0.2)'
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
                    {firstLetter}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Jméno uživatele */}
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
                        marginLeft: 'auto',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                    onMouseOut={(e) => e.currentTarget.style.opacity = 0.8}
                >
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
