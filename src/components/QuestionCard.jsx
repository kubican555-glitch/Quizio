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
  visualSelection,
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

    const [shuffledOptions, setShuffledOptions] = useState([]);
    
    // TINDER-LIKE SWIPE STATE
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right' | null
    const [isFlying, setIsFlying] = useState(false);

    // Logic to shuffle options whenever currentQuestion changes
    useEffect(() => {
        if (currentQuestion && currentQuestion.options) {
            const optionsWithMeta = currentQuestion.options.map((opt, idx) => ({
                text: opt,
                originalIndex: idx,
                isCorrect: idx === currentQuestion.correctIndex
            }));
            
            const isMockOrRealTest = mode === 'mock' || mode === 'real_test';
            let finalShuffled = [];
            
            if (isMockOrRealTest) {
                finalShuffled = optionsWithMeta;
            } else {
                // Fisher-Yates shuffle
                const shuffled = [...optionsWithMeta];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                finalShuffled = shuffled;
            }
            setShuffledOptions(finalShuffled);
            
            // Pass the shuffled mapping back to parent for keyboard sync
            if (window.setShuffledMappingForKeyboard) {
                window.setShuffledMappingForKeyboard(finalShuffled.map(o => o.originalIndex));
            }
            
            // Re-order option refs if they exist
            if (optionRefsForCurrent && optionRefsForCurrent.current) {
                optionRefsForCurrent.current = {};
            }
        }
    }, [currentQuestion.number, currentQuestion.id, mode]); // Removed dependency on userAnswer to prevent re-shuffle on click
    
    // Reset swipe state when question changes
    useEffect(() => {
        setSwipeOffset(0);
        setIsDragging(false);
        setSwipeDirection(null);
        setIsFlying(false);
    }, [currentQuestion?.id, currentQuestion?.number]);

    const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
  const cardContainerRef = useRef(null);

  const touchStart = useRef({ x: 0, y: 0 });
  const touchCurrent = useRef({ x: 0, y: 0 });
  const minSwipeDistance = 50; // Threshold pro odlet
  const flyAwayThreshold = 80; // Práh pro spuštění odletu

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
    // Odstraněno automatické posouvání při výběru odpovědi, které způsobovalo skákání obrazovky na mobilech
    /*
    if (selectedAnswer !== null && optionRefsForCurrent && optionRefsForCurrent.current && optionRefsForCurrent.current[selectedAnswer]) {
      optionRefsForCurrent.current[selectedAnswer].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
    */
  }, [selectedAnswer, optionRefsForCurrent]);

  // 5. TOUCH EVENTY - TINDER-LIKE SWIPE (Optimalizováno pro 120Hz+)
  useEffect(() => {
    const element = cardContainerRef.current;
    if (!element || isFlying) return;

    let rafId = null;

    const handleTouchStart = (e) => {
      if (isFlying) return;
      touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
      touchCurrent.current = { ...touchStart.current };
      setIsDragging(true);
    };

    const handleTouchMove = (e) => {
      if (!touchStart.current.x || isFlying) return;
      const clientX = e.targetTouches[0].clientX;
      const clientY = e.targetTouches[0].clientY;
      touchCurrent.current = { x: clientX, y: clientY };

      const diffX = clientX - touchStart.current.x;
      const diffY = Math.abs(clientY - touchStart.current.y);
      const absDiffX = Math.abs(diffX);

      if (absDiffX > diffY && absDiffX > 5) {
        if (onSwipe && e.cancelable) {
          e.preventDefault();
        }

        // Použití requestAnimationFrame pro synchronizaci s obnovovací frekvencí displeje (60/120/144Hz)
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setSwipeOffset(diffX);
          
          if (diffX > minSwipeDistance) {
            setSwipeDirection('right');
          } else if (diffX < -minSwipeDistance) {
            setSwipeDirection('left');
          } else {
            setSwipeDirection(null);
          }
        });
      }
    };

    const handleTouchEnd = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (!touchStart.current.x || isFlying) return;
      
      const distanceX = touchCurrent.current.x - touchStart.current.x;
      const absX = Math.abs(distanceX);
      const absY = Math.abs(touchCurrent.current.y - touchStart.current.y);

      touchStart.current = { x: 0, y: 0 };
      setIsDragging(false);

      if (absX > absY && absX > flyAwayThreshold && onSwipe) {
        const direction = distanceX > 0 ? 'right' : 'left';
        const isFlashcardOrSmart = mode === 'random' || mode === 'smart_learning';
        
        if (isFlashcardOrSmart && direction === 'right') {
          setSwipeOffset(0);
          setSwipeDirection(null);
          return;
        }

        setIsFlying(true);
        setSwipeDirection(direction);
        const flyDistance = direction === 'right' ? window.innerWidth + 500 : -window.innerWidth - 500;
        setSwipeOffset(flyDistance);
        
        setTimeout(() => {
          onSwipe(direction);
        }, 200);
      } else {
        setSwipeOffset(0);
        setSwipeDirection(null);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipe, isFlying, mode]);

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

  // Výpočet rotace pro Tinder-like efekt (max ±15 stupňů)
  const rotation = isDragging ? (swipeOffset / window.innerWidth) * 15 : (isFlying ? (swipeDirection === 'right' ? 15 : -15) : 0);
  const opacity = isFlying ? 0 : 1;
  
  // Dynamické styly pro swipe - optimalizováno pro výkon a zamezení výběru textu
  const swipeStyles = {
    position: 'relative',
    touchAction: 'pan-y',
    transform: `translate3d(${swipeOffset}px, 0, 0) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.15s linear',
    opacity: opacity,
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none'
  };

  return (
    <div
      ref={cardContainerRef}
      style={swipeStyles}
      className={`questionCardContent fade-in-content ${swipeDirection ? `swiping-${swipeDirection}` : ''}`}
    >
      <style>{`
        .fade-in-content { animation: fadeInQuick 0.3s ease-out; }
        @keyframes fadeInQuick { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        /* Odstranění barevného glow při swipování, které způsobovalo highlight efekt */
        .swiping-right { }
        .swiping-left { }
        
        /* Zajištění, že žádný prvek uvnitř karty nereaguje na tap-highlight */
        .questionCardContent * {
          -webkit-tap-highlight-color: transparent !important;
          outline: none !important;
        }
      `}</style>

      {isFlashcard && (showResult || selectedAnswer !== null) && !isExiting && (
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
        {shuffledOptions.map((optObj, index) => {
          const isSelected = selectedAnswer === optObj.originalIndex || (visualSelection === index && !showResult);
          const isCorrect = optObj.isCorrect;

          let className = "optionButton";
          let style = {};

          if (showResult) {
            if (isCorrect) {
                className += " correct";
            } else if (isSelected) {
                className += " wrong";
            } else {
                className += " dim";
            }
          } else if (isSelected) {
            className += " selected";
          }

          // OPRAVA VIZUÁLNÍHO OZNAČENÍ V TESTU:
          if (!showResult && !isSelected && ((mode === "mock" || mode === "training" || mode === "real_test") && currentQuestion.userAnswer === optObj.originalIndex)) {
             className += " selected"; 
          }

          return (
            <button
              key={index}
              ref={(el) => { if (optionRefsForCurrent && optionRefsForCurrent.current) optionRefsForCurrent.current[index] = el; }}
              className={className}
              style={style}
              onClick={() => !disabled && onSelect(optObj.originalIndex)}
              disabled={disabled}
            >
              <HighlightedText text={optObj.text} />
            </button>
          );
        })}
      </div>
    </div>
  );
}