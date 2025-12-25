import React, { useRef, useEffect } from 'react';
import { getImageUrl } from '../utils/images';
import { isFlashcardStyle } from '../utils/formatting';

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
    isExiting 
}) {
    if (!currentQuestion || !currentQuestion.options)
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                Načítání otázky...
            </div>
        );

    const imageUrl = getImageUrl(currentSubject, currentQuestion.number);
    const isFlashcard = isFlashcardStyle(mode);

    // Reference pro hlavní kontejner karty
    const cardContainerRef = useRef(null);

    // Ukládáme souřadnice pro výpočet směru
    const touchStart = useRef({ x: 0, y: 0 });
    const touchCurrent = useRef({ x: 0, y: 0 });
    const minSwipeDistance = 50;

    // Připojení non-passive event listeneru pro plynulejší swipe bez scrollu
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

            // Pokud je pohyb více horizontální než vertikální a větší než malý práh,
            // zablokujeme scrollování stránky
            if (diffX > diffY && diffX > 10) {
                if (e.cancelable) e.preventDefault();
            }
        };

        // passive: false je klíčové pro fungování e.preventDefault()
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    // Vyhodnocení gesta na konci dotyku
    const handleTouchEnd = () => {
        if (!touchStart.current.x) return;

        const distanceX = touchCurrent.current.x - touchStart.current.x;
        const distanceY = touchCurrent.current.y - touchStart.current.y;

        // Reset
        touchStart.current = { x: 0, y: 0 };

        // Pokud byl pohyb spíše vertikální, ignorujeme (byl to scroll)
        if (Math.abs(distanceY) > Math.abs(distanceX)) return;

        if (distanceX > minSwipeDistance) onSwipe("right"); // Swipe doprava (předchozí)
        else if (distanceX < -minSwipeDistance) onSwipe("left"); // Swipe doleva (další)
    };

    return (
        <div
            ref={cardContainerRef}
            style={{ position: 'relative', touchAction: 'pan-y' }} // pan-y je fallback
            onTouchEnd={handleTouchEnd}
        >
            {/* Tlačítko nahlášení - jen pro Flashcards po zobrazení výsledku */}
            {isFlashcard && showResult && !isExiting && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onReport(currentQuestion.number);
                    }}
                    title="Nahlásit chybu"
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
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0.9}
                >
                    🏳️
                </button>
            )}

            <div className="questionHeader">
                <h2 className="questionText">
                    {isFlashcard && `#${currentQuestion.number} `}
                    {currentQuestion.question}
                </h2>
                {imageUrl && (
                    <div
                        className="imageWrapper"
                        onClick={() => onZoom(imageUrl)}
                    >
                        <img
                            src={imageUrl}
                            alt="Otázka"
                            className="questionImage"
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
                        if (
                            selectedAnswer === i &&
                            i !== currentQuestion.correctIndex
                        )
                            style = {
                                background: "rgba(239,68,68,0.35)",
                                borderColor: "#ef4444",
                            };
                    } 
                    else if (
                        ((mode === "mock" || mode === "training") && currentQuestion.userAnswer === i) ||
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