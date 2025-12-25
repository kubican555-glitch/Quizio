import React from 'react';

export function NoMistakesScreen({ onBack, subject }) {
    return (
        <div
            className="container fadeIn"
            style={{
                minHeight: "var(--vh)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div className="noMistakesCard">
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏆</div>
                <h2 style={{ color: "var(--success)", marginBottom: "0.5rem" }}>
                    Skvělá práce!
                </h2>
                <p
                    style={{
                        color: "var(--text-secondary)",
                        textAlign: "center",
                        marginBottom: "2rem",
                    }}
                >
                    V předmětu <strong>{subject}</strong> nemáš žádné
                    zaznamenané chyby.
                </p>
                <button
                    className="navButton primary"
                    style={{ marginTop: "2rem" }}
                    onClick={onBack}
                >
                    Zpět do menu
                </button>
            </div>
        </div>
    );
}