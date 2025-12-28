import React, { useRef, useEffect, useState } from 'react';
import { isFlashcardStyle } from '../utils/formatting';
// Přidán import getCachedImage
import { fetchQuestionImage, getCachedImage } from '../utils/dataManager';

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
  // OPTIMALIZACE: Inicializujeme stav hned při prvním renderu
  // Pokud máme obrázek v cache, isReady bude rovnou true -> ŽÁDNÉ PROBLIKNUTÍ
  const [lazyImage, setLazyImage] = useState(() => {
      if (currentQuestion?.image_base64) return currentQuestion.image_base64;
      if (currentQuestion?.id) return getCachedImage(currentQuestion.id) || null;
      return null;
  });

  const [isReady, setIsReady] = useState(() => {
      // Pokud máme obrázek (v datech nebo cache), jsme ready hned
      if (currentQuestion?.image_base64) return true;
      if (currentQuestion?.id && getCachedImage(currentQuestion.id) !== undefined) return true;
      // Pokud otázka nemá ID, taky ready (není co stahovat)
      if (!currentQuestion?.id) return true;
      // Jinak musíme čekat na fetch
      return false;
  });

  const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
  const cardContainerRef = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchCurrent = useRef({ x: 0, y: 0 });
  const minSwipeDistance = 50;

  useEffect(() => {
    let isMounted = true;

    // Pokud už jsme ready z inicializace, fetch nespouštíme zbytečně
    // Ale pokud isReady je false, musíme to stáhnout
    if (!isReady && currentQuestion?.id) {
        const timeoutId = setTimeout(() => {
            if (isMounted) {
                console.log("QuestionCard: Timeout, zobrazuji text.");
                setIsReady(true);
            }
        }, 3000);

        const loadImage = async () => {
            try {
                // Zkusíme stáhnout (fetchQuestionImage si řeší cache uvnitř)
                const img = await fetchQuestionImage(currentQuestion.id);

                if (isMounted) {
                    setLazyImage(img);
                    setIsReady(true);
                }
            } catch (err) {
                if (isMounted) setIsReady(true);
            }
        };
        loadImage();

        return () => { 
            isMounted = false; 
            clearTimeout(timeoutId);
        };
    }
  }, [currentQuestion?.id, isReady]);

  // Scroll na odpověď
  useEffect(() => {
    if (selectedAnswer !== null && optionRefsForCurrent && optionRefsForCurrent.current && optionRefsForCurrent.current[selectedAnswer]) {
      optionRefsForCurrent.current[selectedAnswer].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedAnswer, optionRefsForCurrent]);

  // Touch eventy
  useEffect(() => {
    const element = cardContainerRef.current;
    if (!element) return;

    const handleTouchStart = (e) => {
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

      if (diffX > diffY && diffX > 10 && e.cancelable) e.preventDefault();
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isReady]);

  const handleTouchEnd = () => {
    if (!touchStart.current.x) return;
    const distanceX = touchCurrent.current.x - touchStart.current.x;
    const distanceY = touchCurrent.current.y - touchStart.current.y;
    touchStart.current = { x: 0, y: 0 };

    if (Math.abs(distanceY) > Math.abs(distanceX)) return;
    if (distanceX > minSwipeDistance) onSwipe("right");
    else if (distanceX < -minSwipeDistance) onSwipe("left");
  };

  // Loading stav - zobrazí se jen pokud opravdu nemáme data
  if (!currentQuestion || !isReady)
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
        <div className="spinner" style={{margin: "0 auto 10px auto", width: "24px", height: "24px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite"}}></div>
        <span>Načítám...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );

  const displayImage = lazyImage || currentQuestion.image_base64;

  return (
    <div
      ref={cardContainerRef}
      style={{ position: 'relative', touchAction: 'pan-y' }}
      onTouchEnd={handleTouchEnd}
      className="fade-in-content"
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
          style={{ position: 'absolute', top: '-15px', right: '-15px', background: 'transparent', border: 'none', padding: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem', zIndex: 20, opacity: 0.9 }}
        >
          🏳️
        </button>
      )}

      <div className="questionHeader">
        <h2 className="questionText">
          {isFlashcard && `#${currentQuestion.number} `}
          {currentQuestion.question}
        </h2>

        {displayImage && (
          <div className="imageWrapper" onClick={() => onZoom(displayImage)}>
            <img src={displayImage} alt="Otázka" className="questionImage" decoding="async" />
          </div>
        )}
      </div>

      <div className="options">
        {(currentQuestion.options || []).map((opt, i) => {
          let style = {};
          if (isFlashcard && showResult) {
            if (i === currentQuestion.correctIndex) style = { background: "rgba(34,197,94,0.35)", borderColor: "#22c55e" };
            if (selectedAnswer === i && i !== currentQuestion.correctIndex) style = { background: "rgba(239,68,68,0.35)", borderColor: "#ef4444" };
          } else if (((mode === "mock" || mode === "training" || mode === "real_test") && currentQuestion.userAnswer === i) || (isFlashcard && selectedAnswer === i && !showResult)) {
            style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
          }

          return (
            <button
              key={i}
              ref={(el) => { if (optionRefsForCurrent && optionRefsForCurrent.current) optionRefsForCurrent.current[i] = el; }}
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