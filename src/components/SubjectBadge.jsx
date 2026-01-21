import React from "react";

export const SubjectBadge = ({ subject, compact = false }) => {
    if (!subject) return null;
    const subjectKey = String(subject).toLowerCase();
    const subjectIconMap = {
        sps: "📚",
        stt: "⚙️",
        custom: "📁",
    };
    const subjectIcon = subjectIconMap[subjectKey] || "📘";

    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? "0.35rem" : "0.5rem",
                padding: compact ? "0.4rem 0.8rem" : "0.5rem 1rem",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                color: "var(--color-primary-light)",
                fontWeight: "800",
                fontSize: compact ? "0.9rem" : "1rem",
            }}
        >
            <span style={{ fontSize: compact ? "1rem" : "1.2rem" }}>
                {subjectIcon}
            </span>
            {subject === "CUSTOM" ? "Vlastnお" : subject}
        </div>
    );
};
