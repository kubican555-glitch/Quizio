import React from 'react';

export const ThemeToggle = ({ currentTheme, toggle }) => (
    <button
        className="menuBackButton theme-toggle-btn"
        onClick={toggle}
        title={currentTheme === "dark" ? "Přepnout na světlý" : "Přepnout na tmavý"}
        style={{
            fontSize: "1.2rem",
            padding: "0.5rem 0.8rem",
            marginLeft: "0.5rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
    >
        {currentTheme === "dark" ? "☀️" : "🌙"}
    </button>
);