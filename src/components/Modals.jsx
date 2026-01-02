import React from 'react';
import { createPortal } from 'react-dom';

export const ImageModal = ({ src, onClose }) => {
    if (!src) return null;
    return createPortal(
        <div
            className="modalOverlay"
            onClick={onClose}
            style={{
                backgroundColor: "rgba(0, 0, 0, 0.92)",
                zIndex: 9999,
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <img
                src={src}
                alt="Fullscreen"
                style={{
                    maxWidth: "96vw",
                    maxHeight: "96vh",
                    objectFit: "contain",
                    backgroundColor: "#fff",
                }}
                onClick={(e) => e.stopPropagation()}
            />
            <div
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "30px",
                    color: "white",
                    fontSize: "40px",
                    cursor: "pointer",
                }}
            >
                &times;
            </div>
        </div>,
        document.body
    );
};

export function ConfirmModal({
    title,
    message,
    onCancel,
    onConfirm,
    confirmText = "Ano, pokračovat",
    cancelText = "Zrušit",
    danger = false,
    hideButtons = false,
}) {
    return createPortal(
        <div
            className="modalOverlay"
            onClick={onCancel}
            style={{ zIndex: 5000 }}
        >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                {!hideButtons && (
                    <div
                        className="modalButtons"
                        style={{
                            display: "flex",
                            gap: "1rem",
                            justifyContent: "flex-end",
                        }}
                    >
                        <button className="navButton" onClick={onCancel}>
                            {cancelText}
                        </button>
                        <button
                            className="navButton primary"
                            onClick={onConfirm}
                            style={
                                danger
                                    ? {
                                          backgroundColor: "var(--error)",
                                          borderColor: "var(--error)",
                                      }
                                    : {}
                            }
                        >
                            {confirmText}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

export function SmartSettingsModal({ onStart, onCancel, totalQuestions }) {
    const options = [10, 20, 50, 100, 200, "all"];
    return createPortal(
        <div
            className="modalOverlay"
            onClick={onCancel}
            style={{ zIndex: 5000 }}
        >
            <div
                className="modal settingsModal"
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
                        🎓
                    </div>
                    <h3>Nastavení chytrého učení</h3>
                </div>
                <div className="smartGrid">
                    {options.map((opt) => (
                        <button
                            key={opt}
                            className="smartOptionButton"
                            onClick={() => onStart(opt)}
                        >
                            <span
                                style={{
                                    fontSize: "1.2rem",
                                    fontWeight: "bold",
                                }}
                            >
                                {opt === "all" ? totalQuestions : opt}
                            </span>
                            <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                                {opt === "all" ? "Všechny otázky" : "otázek"}
                            </span>
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: "2rem", width: "100%" }}>
                    <button
                        className="navButton"
                        onClick={onCancel}
                        style={{ width: "100%" }}
                    >
                        Zrušit
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}