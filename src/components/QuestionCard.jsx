import React, { useRef, useEffect, useState } from 'react';
import { isFlashcardStyle } from '../utils/formatting';
import { fetchQuestionImage, getCachedImage } from '../utils/dataManager';
import { getImageUrl } from "../utils/images"; 
import { HighlightedText } from "./HighlightedText";

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
  // 1. OPTIMALIZACE OBRÁZKŮ:
  const [lazyImage, setLazyImage] = useState(() => {
      if (currentQuestion?.image_base64) return currentQuestion.image_base64;
      if (currentQuestion?.id) return getCachedImage(currentQuestion.id) || null;
      const staticUrl = getImageUrl(currentSubject, currentQuestion?.number);
      return staticUrl || null;
  });

  const [isReady, setIsReady] = useState(() => {
      if (lazyImage) return true;
      if (!currentQuestion?.id) return true;
      return false;
  });

  const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
  const cardContainerRef = useRef(null);

  const touchStart = useRef({ x: 0, y: 0 });
  const touchCurrent = useRef({ x: 0, y: 0 });
  const minSwipeDistance = 50;

  // 2. NAČÍTÁNÍ OBRÁZKU
  useEffect(() => {
    let isMounted = true;
    if (isReady) return;

    if (currentQuestion?.id) {
        const timeoutId = setTimeout(() => {
            if (isMounted) {
                console.log("QuestionCard: Timeout načítání obrázku, zobrazuji kartu.");
                setIsReady(true);
            }
        }, 3000);

        const loadImage = async () => {
            try {
                const img = await fetchQuestionImage(currentQuestion.id);
                if (isMounted) {
                    if (img) setLazyImage(img);
                    setIsReady(true);
                }
            } catch (err) {
                console.error("Chyba při načítání obrázku v kartě:", err);
                if (isMounted) setIsReady(true);
            }
        };
        loadImage();

        return () => { 
            isMounted = false; 
            clearTimeout(timeoutId);
        };
    } else {
        setIsReady(true);
    }
  }, [currentQuestion, isReady]);

  // 3. ZOOM LOGIKA
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "f" || e.key === "F") {
            if (lazyImage && onZoom) {
                onZoom(lazyImage);
            }
        }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lazyImage, onZoom]);

  // 4. SCROLL
  useEffect(() => {
    if (selectedAnswer !== null && optionRefsForCurrent && optionRefsForCurrent.current && optionRefsForCurrent.current[selectedAnswer]) {
      optionRefsForCurrent.current[selectedAnswer].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedAnswer, optionRefsForCurrent]);

  // 5. TOUCH EVENTY
  useEffect(() => {
    const element = cardContainerRef.current;
    if (!element) return;

    const handleTouchStart = (e) => {
      // Record initial touch point
      touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
      touchCurrent.current = { ...touchStart.current };
    };

    const handleTouchMove = (e) => {
      if (!touchStart.current.x) return;
      const clientX = e.targetTouches[0].clientX;
      const clientY = e.targetTouches[0].clientY;
      touchCurrent.current = { x: clientX, y: clientY };

      const diffX = Math.abs(clientX - touchStart.current.x);
      const diffY = Math.abs(clientY - touchStart.current.y);

      // If horizontal movement is dominant, prevent scrolling to capture the swipe
      if (diffX > diffY && diffX > 10) {
        if (onSwipe && e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart.current.x) return;
      const distanceX = touchCurrent.current.x - touchStart.current.x;
      const distanceY = touchCurrent.current.y - touchStart.current.y;
      
      const absX = Math.abs(distanceX);
      const absY = Math.abs(distanceY);

      // Reset touch start
      touchStart.current = { x: 0, y: 0 };

      // Ensure horizontal swipe is dominant and meets threshold
      if (absX > absY && absX > minSwipeDistance && onSwipe) {
        if (distanceX > 0) onSwipe("right");
        else onSwipe("left");
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipe]);

  // 6. RENDER
  if (!currentQuestion || !isReady) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
        <div className="spinner" style={{margin: "0 auto 10px auto", width: "24px", height: "24px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite"}}></div>
        <span>Načítám...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- PODMÍNKA PRO ZOBRAZENÍ ČÍSLA OTÁZKY ---
  // Číslo zobrazíme POUZE pokud je mode 'random' (Flashcards) nebo 'review' (Prohlížení)
  const shouldShowNumber = mode === 'random' || mode === 'review';

  return (
    <div
      ref={cardContainerRef}
      style={{ position: 'relative', touchAction: 'pan-y' }}
      onTouchEnd={handleTouchEnd}
      className="questionCardContent fade-in-content"
    >
      <style>{`
        .fade-in-content { animation: fadeInQuick 0.3s ease-out; }
        @keyframes fadeInQuick { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {isFlashcard && showResult && !isExiting && (
        <button
          onClick={(e) => { e.stopPropagation(); onReport(currentQuestion.number); }}
          title="Nahlásit chybu"
          className="report-btn-flash"
          style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'transparent', border: 'none', padding: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', zIndex: 20, opacity: 0.7 }}
        >
          🏳️
        </button>
      )}

      <div className="questionHeader">
        <div className="questionText">
            {/* Zde je změna: Podmíněné vykreslení čísla */}
            {shouldShowNumber && <span className="questionNumber">#{currentQuestion.number} </span>}
            {currentQuestion.question}
        </div>

        {lazyImage && (
          <div className="imageWrapper" onClick={() => onZoom && onZoom(lazyImage)}>
            <img src={lazyImage} alt="Otázka" className="questionImage" decoding="async" />
            <div className="fullscreenHint mobile-hidden">Klikni nebo stiskni F</div>
          </div>
        )}
      </div>

      <div className="options">
        {(currentQuestion.options || []).map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = currentQuestion.correctIndex === index;

          let className = "optionButton";
          let style = {};

          if (showResult) {
            if (isCorrect) {
                className += " correct";
                if (isFlashcard) style = { background: "rgba(34,197,94,0.35)", borderColor: "#22c55e" };
            } else if (isSelected) {
                className += " wrong";
                if (isFlashcard) style = { background: "rgba(239,68,68,0.35)", borderColor: "#ef4444" };
            } else {
                className += " dim";
            }
          } else if (isSelected) {
            className += " selected";
            if (isFlashcard) style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
          }

          // OPRAVA VIZUÁLNÍHO OZNAČENÍ V TESTU:
          // Pokud je mode 'real_test' (nebo 'mock', 'training') a odpověď je uložená v currentQuestion.userAnswer,
          // aplikujeme styl "selected".
          if (!showResult && !isSelected && ((mode === "mock" || mode === "training" || mode === "real_test") && currentQuestion.userAnswer === index)) {
             className += " selected"; 
             // Zde přidávám explicitní silnější styl, aby to bylo vidět
             style = { background: "rgba(59, 130, 246, 0.4)", borderColor: "#3b82f6", borderWidth: "2px" };
          }

          return (
            <button
              key={index}
              ref={(el) => { if (optionRefsForCurrent && optionRefsForCurrent.current) optionRefsForCurrent.current[index] = el; }}
              className={className}
              style={style}
              onClick={() => !disabled && onSelect(index)}
              disabled={disabled}
            >
              {/* Odstraněno: <span className="optionIndex">{String.fromCharCode(65 + index)}.</span> */}
              <HighlightedText text={option} />
              {/* Odstraněny ikony: 
                  {showResult && isCorrect && <span className="resultIcon">✓</span>}
                  {showResult && isSelected && !isCorrect && <span className="resultIcon">✗</span>} 
              */}
            </button>
          );
        })}
      </div>
    </div>
  );
}