import React from 'react';

export const SubjectBadge = ({ subject, compact = false }) => {
    if (!subject) return null;
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: compact ? "0.4rem 0.8rem" : "0.5rem 1rem",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                color: "var(--color-primary-light)",
                fontWeight: "800",
                fontSize: compact ? "0.9rem" : "1rem",
            }}
        >
            {subject === "CUSTOM" ? "Vlastní" : subject}
        </div>
    );
};