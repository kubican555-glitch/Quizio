import React from "react";
import { createPortal } from "react-dom";

export const SessionBlockedScreen = ({ onTakeOver }) => {
    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 99999, 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            backdropFilter: 'blur(10px)',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⛔</div>
            <h1 style={{ marginBottom: '1rem', color: '#ef4444' }}>Aplikace je otevřena jinde</h1>
            <p style={{ maxWidth: '500px', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#ccc' }}>
                Z bezpečnostních důvodů může být aplikace spuštěna pouze v jednom okně prohlížeče. 
                Právě byla detekována aktivita v jiném okně nebo zařízení.
            </p>
            <button 
                onClick={onTakeOver}
                className="navButton primary"
                style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
            >
                Používat zde
            </button>
        </div>,
        document.body
    );
};