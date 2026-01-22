import React from "react";

export const SubjectBadge = ({ subject, compact = false, matchUserBadge = false }) => {
    if (!subject) return null;
    const subjectKey = String(subject).toLowerCase();
    const subjectIconMap = {
        sps: "📚",
        stt: "⚙️",
        custom: "📁",
    };
    const subjectIcon = subjectIconMap[subjectKey] || "📘";

    const sizeStyle = {
        gap: compact ? "0.35rem" : "0.5rem",
        padding: compact ? "0.4rem 0.8rem" : "0.5rem 1rem",
        fontSize: compact ? "0.9rem" : "1rem",
    };
    const matchUserStyle = matchUserBadge
        ? {
              height: "var(--nav-control-height)",
              padding: "0 0.8rem",
              boxSizing: "border-box",
          }
        : {};

    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "10px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                color: "var(--color-primary-light)",
                fontWeight: "800",
                ...sizeStyle,
                ...matchUserStyle,
            }}
        >
            <span style={{ fontSize: compact ? "1rem" : "1.2rem" }}>
                {subjectIcon}
            </span>
            {subject === "CUSTOM" ? "Vlastnお" : subject}
        </div>
    );
};
