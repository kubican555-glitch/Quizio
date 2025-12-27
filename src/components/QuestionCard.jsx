import React, { useRef, useEffect } from 'react';
import { isFlashcardStyle } from '../utils/formatting';

/**
 * QuestionCard - Komponenta pro zobrazení jedné otázky
 * Verze: EXKLUZIVNĚ PRO DATABÁZOVÉ OBRÁZKY (Base64)
 */
export function QuestionCard({
    currentQuestion,
    mode,
    showResult,
    selectedAnswer,
    onSelect,
    disabled,
    isKeyboardMode,
    currentSubject,
    onZoom,
    onSwipe,
    score,
    onReport,
    isExiting,
    optionRefsForCurrent 
}) {
    if (!currentQuestion || !currentQuestion.options)
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                Načítání otázky...
            </div>
        );

    // --- VÝBĚR OBRÁZKU ---
    // Nyní bereme POUZE obrázek z databáze (Base64). 
    // Žádný fallback na lokální public složku už neexistuje.
    const displayImage = currentQuestion.image_base64;

    const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
    const cardContainerRef = useRef(null);
    const touchStart = useRef({ x: 0, y: 0 });
    const touchCurrent = useRef({ x: 0, y: 0 });
    const minSwipeDistance = 50;

    // Scroll na vybranou odpověď (pro klávesnici)
    useEffect(() => {
        if (selectedAnswer !== null && optionRefsForCurrent && optionRefsForCurrent.current && optionRefsForCurrent.current[selectedAnswer]) {
            optionRefsForCurrent.current[selectedAnswer].scrollIntoView({
                behavior: "smooth",
                block: "nearest",
            });
        }
    }, [selectedAnswer, optionRefsForCurrent]);

    // Touch eventy pro swipe gesta
    useEffect(() => {
        const element = cardContainerRef.current;
        if (!element) return;

        const handleTouchStart = (e) => {
            touchStart.current = { 
                x: e.targetTouches[0].clientX, 
                y: e.targetTouches[0].clientY 
            };
            touchCurrent.current = { ...touchStart.current };
        };

        const handleTouchMove = (e) => {
            if (!touchStart.current.x) return;
            const clientX = e.targetTouches[0].clientX;
            const clientY = e.targetTouches[0].clientY;
            touchCurrent.current = { x: clientX, y: clientY };

            const diffX = Math.abs(clientX - touchStart.current.x);
            const diffY = Math.abs(clientY - touchStart.current.y);

            if (diffX > diffY && diffX > 10) {
                if (e.cancelable) e.preventDefault();
            }
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    const handleTouchEnd = () => {
        if (!touchStart.current.x) return;
        const distanceX = touchCurrent.current.x - touchStart.current.x;
        const distanceY = touchCurrent.current.y - touchStart.current.y;
        touchStart.current = { x: 0, y: 0 };

        if (Math.abs(distanceY) > Math.abs(distanceX)) return;

        if (distanceX > minSwipeDistance) onSwipe("right");
        else if (distanceX < -minSwipeDistance) onSwipe("left");
    };

    return (
        <div
            ref={cardContainerRef}
            style={{ position: 'relative', touchAction: 'pan-y' }}
            onTouchEnd={handleTouchEnd}
        >
            {isFlashcard && showResult && !isExiting && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onReport(currentQuestion.number);
                    }}
                    title="Nahlásit chybu"
                    className="report-btn-flash"
                    style={{
                        position: 'absolute',
                        top: '-15px',     
                        right: '-15px',   
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        width: '40px',    
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        zIndex: 20,
                        opacity: 0.9,
                        transition: 'opacity 0.2s'
                    }}
                >
                    🏳️
                </button>
            )}

            <div className="questionHeader">
                <h2 className="questionText">
                    {isFlashcard && `#${currentQuestion.number} `}
                    {currentQuestion.question}
                </h2>

                {/* Zobrazení obrázku z DB (Base64) */}
                {displayImage && (
                    <div
                        className="imageWrapper"
                        onClick={() => onZoom(displayImage)}
                    >
                        <img
                            src={displayImage}
                            alt="Otázka"
                            className="questionImage"
                            decoding="async"
                        />
                    </div>
                )}
            </div>

            <div className="options">
                {(currentQuestion.options || []).map((opt, i) => {
                    let style = {};

                    if (isFlashcard && showResult) {
                        if (i === currentQuestion.correctIndex)
                            style = {
                                background: "rgba(34,197,94,0.35)",
                                borderColor: "#22c55e",
                            };
                        if (selectedAnswer === i && i !== currentQuestion.correctIndex)
                            style = {
                                background: "rgba(239,68,68,0.35)",
                                borderColor: "#ef4444",
                            };
                    } 
                    else if (
                        ((mode === "mock" || mode === "training" || mode === "real_test") && currentQuestion.userAnswer === i) ||
                        (isFlashcard && selectedAnswer === i && !showResult)
                    ) {
                        style = {
                            background: "rgba(59,130,246,0.35)",
                            borderColor: "#60a5fa",
                        };
                    }

                    return (
                        <button
                            key={i}
                            ref={(el) => {
                                if (optionRefsForCurrent && optionRefsForCurrent.current) {
                                    optionRefsForCurrent.current[i] = el;
                                }
                            }}
                            className="optionButton"
                            style={style}
                            onClick={() => !disabled && onSelect(i)}
                            disabled={disabled}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}