import React, { useState } from "react";

export function CloudLoginScreen({ onLogin, loading }) {
    const [accessCode, setAccessCode] = useState("");
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
            <div
                className="modal"
                style={{
                    maxWidth: "400px",
                    width: "90%",
                    textAlign: "center",
                    padding: "2rem",
                }}
            >
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔒</div>
                <h2>Vstup jen pro zvané</h2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (accessCode.trim()) onLogin(accessCode.trim());
                    }}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <input
                        type="password"
                        placeholder="Zadejte kód..."
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="reviewSearchInput"
                        style={{ textAlign: "center" }}
                        autoFocus
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="navButton primary"
                        disabled={loading || !accessCode.trim()}
                    >
                        {loading ? "Ověřuji..." : "Vstoupit"}
                    </button>
                </form>
            </div>
        </div>
    );
}