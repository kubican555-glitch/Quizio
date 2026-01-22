import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

let modalLockCount = 0;
let savedBodyStyles = null;
let savedScrollY = 0;

const lockBodyScroll = () => {
    if (typeof document === 'undefined') return;
    modalLockCount += 1;
    if (modalLockCount > 1) return;
    const body = document.body;
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    savedBodyStyles = {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
    };
    body.classList.add('modal-open');
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
};

const unlockBodyScroll = () => {
    if (typeof document === 'undefined') return;
    modalLockCount = Math.max(0, modalLockCount - 1);
    if (modalLockCount > 0) return;
    const body = document.body;
    body.classList.remove('modal-open');
    if (savedBodyStyles) {
        body.style.overflow = savedBodyStyles.overflow;
        body.style.position = savedBodyStyles.position;
        body.style.top = savedBodyStyles.top;
        body.style.left = savedBodyStyles.left;
        body.style.right = savedBodyStyles.right;
        body.style.width = savedBodyStyles.width;
    } else {
        body.style.overflow = '';
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
    }
    window.scrollTo(0, savedScrollY || 0);
    savedBodyStyles = null;
};

const useModalScrollLock = (enabled = true) => {
    useEffect(() => {
        if (!enabled) return;
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, [enabled]);
};

export const ImageModal = ({ src, onClose }) => {
    useModalScrollLock(!!src);
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
    useModalScrollLock(true);
    return createPortal(
        <div
            className="modalOverlay"
            onClick={onCancel}
            style={{ zIndex: 5000 }}
        >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <div style={{ marginBottom: '1.5rem' }}>{message}</div>
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
                                          backgroundColor: "#ef4444",
                                          borderColor: "#ef4444",
                                          color: "white"
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

export function SmartSettingsModal({
    onStart, onCancel, totalQuestions, saveLimit = 100 }) {
    useModalScrollLock(true);
    const options = [10, 20, 50, 100];

    return createPortal(
        <div
            className="modalOverlay"
            onClick={onCancel}
            style={{ zIndex: 5000 }}
        >
            <div
                className="modal settingsModal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '500px', width: '95%' }}
            >
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>
                        🎓
                    </div>
                    <h3>Nastavení chytrého učení</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Vyber počet otázek pro tento blok.
                    </p>
                </div>

                <div className="smartGrid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '10px' 
                }}>
                    {options.map((opt) => {
                        // Zjistíme reálný počet otázek pro danou volbu
                        const count = opt === "all" ? totalQuestions : opt;

                        // Zjistíme, zda překračuje limit pro ukládání
                        // Pokud je 'all' a celkový počet je malý (např. 50), tak to limit nepřekračuje
                        // const isOverLimit = (opt === "all" && totalQuestions > saveLimit) || (typeof opt === "number" && opt > saveLimit);
                        const isOverLimit = count > saveLimit;

                        return (
                            <button
                                key={opt}
                                className="smartOptionButton"
                                onClick={() => onStart(opt)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '1rem',
                                    minHeight: '80px',
                                    // Stylizace pro varování
                                    borderColor: isOverLimit ? '#ef4444' : undefined,
                                    backgroundColor: isOverLimit ? 'rgba(239, 68, 68, 0.08)' : undefined,
                                    color: isOverLimit ? '#ef4444' : undefined,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: "1.2rem",
                                        fontWeight: "bold",
                                        lineHeight: 1.2
                                    }}
                                >
                                    {opt === "all" ? totalQuestions : opt}
                                </span>
                                <span style={{ fontSize: "0.8rem", opacity: 0.8, marginBottom: isOverLimit ? '4px' : 0 }}>
                                    {opt === "all" ? "Všechny" : "otázek"}
                                </span>

                                {isOverLimit && (
                                    <span style={{ 
                                        fontSize: "0.7rem", 
                                        fontWeight: "bold",
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        ⚠️ Neukládá postup
                                    </span>
                                )}
                            </button>
                        );
                    })}
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
