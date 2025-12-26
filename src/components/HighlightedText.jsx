import React from "react";

export const HighlightedText = ({ text, highlightRegex }) => {
    if (!highlightRegex || !text) return <span>{text}</span>;
    const parts = text.split(highlightRegex);
    return (
        <span>
            {parts.map((part, i) =>
                highlightRegex.test(part) ? (
                    <span
                        key={i}
                        style={{
                            backgroundColor: "rgba(255, 255, 0, 0.25)",
                            color: "#fff",
                            padding: "0 2px",
                            borderRadius: "2px",
                            fontWeight: "bold",
                        }}
                    >
                        {part}
                    </span>
                ) : (
                    part
                ),
            )}
        </span>
    );
};