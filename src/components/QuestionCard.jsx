import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  optionRefsForCurrent,
  onContentReady,
  isActive = true,
  shouldLoadImage = true
}) {
  const [readyForQuestionId, setReadyForQuestionId] = useState(null);

  // 1. OPTIMALIZACE OBRÁZKŮ
  const [lazyImage, setLazyImage] = useState(() => {
      if (currentQuestion?.image_base64) return currentQuestion.image_base64;
      if (shouldLoadImage && currentQuestion?.id) return getCachedImage(currentQuestion.id) || null;
      const staticUrl = getImageUrl(currentSubject, currentQuestion?.number);
      return staticUrl || null;
  });

  // --- 2. OKAMŽITÉ MÍCHÁNÍ ODPOVĚDÍ (useMemo místo useEffect) ---
  // Toto odstraní efekt "probliknutí" pořadí odpovědí.
  // Vypočítá se to HNED při renderu, ne až po něm.
  const shuffledOptions = useMemo(() => {
      if (!currentQuestion || !currentQuestion.options) return [];

      const optionsWithMeta = currentQuestion.options.map((opt, idx) => ({
          text: opt,
          originalIndex: idx,
          isCorrect: idx === currentQuestion.correctIndex
      }));

      const isMockOrRealTest =
          mode === 'mock' || mode === 'real_test' || mode === 'duel';

      if (isMockOrRealTest) {
          return optionsWithMeta;
      } else {
          // Fisher-Yates shuffle
          const shuffled = [...optionsWithMeta];
          for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
      }
  }, [currentQuestion?.id, currentQuestion?.number, mode]); // Přepočítá se jen při změně otázky

  // --- 3. SYNC PRO KLÁVESNICI (Side Effects) ---
  // Samotné míchání už proběhlo nahoře, tady jen posíláme info ven
  useEffect(() => {
      if (isActive && shuffledOptions.length > 0) {
          if (window.setShuffledMappingForKeyboard) {
              window.setShuffledMappingForKeyboard(shuffledOptions.map(o => o.originalIndex));
          }
          if (optionRefsForCurrent && optionRefsForCurrent.current) {
              optionRefsForCurrent.current = {};
          }
      }
  }, [shuffledOptions, isActive]);

  // Signal content ready
  useEffect(() => {
      if (shuffledOptions.length > 0 && currentQuestion) {
          const qId = currentQuestion.id || currentQuestion.number;
          setReadyForQuestionId(qId);
          if (onContentReady && isActive) {
              onContentReady(qId);
          }
      }
  }, [shuffledOptions, currentQuestion?.id, currentQuestion?.number, isActive]);

  // TINDER-LIKE SWIPE STATE
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null); 
  const [isFlying, setIsFlying] = useState(false);

  // Reset swipe state when not active
  useEffect(() => {
      if (!isActive) {
          setSwipeOffset(0);
          setIsDragging(false);
          setSwipeDirection(null);
          setIsFlying(false);
      }
  }, [isActive]);

  const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
  const cardContainerRef = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchCurrent = useRef({ x: 0, y: 0 });
  const flyAwayThreshold = 80; 

  // 4. NAČÍTÁNÍ OBRÁZKU (Líné načítání)
  useEffect(() => {
    if (!shouldLoadImage) return;

    if (currentQuestion?.id) {
        if (currentQuestion.image_base64) {
            setLazyImage(currentQuestion.image_base64);
            return;
        }
        const cached = getCachedImage(currentQuestion.id);
        if (cached) {
            setLazyImage(cached);
            return;
        }
        const loadImage = async () => {
            try {
                const img = await fetchQuestionImage(currentQuestion.id);
                if (img) setLazyImage(img);
                else setLazyImage(null);
            } catch (err) { setLazyImage(null); }
        };
        loadImage();
    } else {
        setLazyImage(null);
    }
  }, [currentQuestion?.id, shouldLoadImage]);

  // 5. ZOOM LOGIKA
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "f" || e.key === "F") {
            if (lazyImage && onZoom) onZoom(lazyImage);
        }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lazyImage, onZoom, isActive]);

  // 6. TOUCH EVENTY (Swipe)
  useEffect(() => {
    if (!isActive) return;

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

      const touch = e.targetTouches[0];
      // Optimalizace: Použití changedTouches pro rychlejší odezvu
      const currentX = touch.clientX;
      const currentY = touch.clientY;
      touchCurrent.current = { x: currentX, y: currentY };

      const diffX = currentX - touchStart.current.x;
      const diffY = Math.abs(currentY - touchStart.current.y);
      const absDiffX = Math.abs(diffX);

      if (absDiffX > diffY && absDiffX > 5) { // Mírně zvýšený práh pro lepší detekci scrollu vs swipe
        if (e.cancelable) e.preventDefault();

        // Zámek na okrajích
        const isBoundaryLockedMode =
            mode === 'real_test' ||
            mode === 'mock' ||
            mode === 'duel' ||
            mode === 'random' ||
            mode === 'training' ||
            mode === 'smart' ||
            mode === 'mistakes';
        if (isBoundaryLockedMode) {
            const isFirst = window.currentTestIndex === 0;
            const isLast = window.currentTestIndex === window.totalTestQuestions - 1;
            if ((diffX > 0 && isFirst) || (diffX < 0 && isLast)) {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    setSwipeOffset(diffX * 0.05); 
                    setSwipeDirection(null);
                });
                return;
            }
        }

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setSwipeOffset(diffX);
          if (diffX > 40) setSwipeDirection('right');
          else if (diffX < -40) setSwipeDirection('left');
          else setSwipeDirection(null);
        });
      }
    };

    const handleTouchEnd = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (!touchStart.current.x || isFlying) return;

      const distanceX = touchCurrent.current.x - touchStart.current.x;
      const absX = Math.abs(distanceX);

      touchStart.current = { x: 0, y: 0 };
      setIsDragging(false);

      if (absX > flyAwayThreshold && onSwipe) {
        const direction = distanceX > 0 ? 'right' : 'left';

        const isFlashcardOrSmart = mode === 'random' || mode === 'test_practice' || mode === 'smart' || mode === 'mistakes';
        // Zákaz swipu doprava (zpět) u flashcards, nebo pokud není zodpovězeno
        if ((isFlashcardOrSmart && !showResult) || (isFlashcardOrSmart && direction === 'right')) {
          setSwipeOffset(0); setSwipeDirection(null); return;
        }

        if (mode === 'real_test' || mode === 'mock') {
            const isFirst = window.currentTestIndex === 0;
            const isLast = window.currentTestIndex === window.totalTestQuestions - 1;
            if ((direction === 'right' && isFirst) || (direction === 'left' && isLast)) {
                setSwipeOffset(0); setSwipeDirection(null); return;
            }
        }

        setIsFlying(true);
        setSwipeDirection(direction);
        const flyDistance = direction === 'right' ? window.innerWidth + 500 : -window.innerWidth - 500;
        setSwipeOffset(flyDistance);

        // Zrychlená reakce - okamžitě spustit callback, pokud je animace nastavená
        setTimeout(() => { onSwipe(direction); }, 200); // 200ms odpovídá CSS transition
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
  }, [onSwipe, isFlying, mode, isActive]);

  if (!currentQuestion) return null;

  const shouldShowNumber = mode === 'random' || mode === 'review';
  const rotation = isDragging ? (swipeOffset / window.innerWidth) * 15 : (isFlying ? (swipeDirection === 'right' ? 15 : -15) : 0);

  const cardStyles = {
    touchAction: 'pan-y',
    transform: `translate3d(${swipeOffset}px, 0, 0) rotate(${rotation}deg)`,
    // Zrychlená transition pro návrat karty (0.2s -> 0.15s)
    transition: (isDragging || isFlying) ? 'transform 0.15s cubic-bezier(0.1, 0, 0.1, 1)' : 'none',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    perspective: 1000,
    width: '100%', 
    pointerEvents: isActive ? 'auto' : 'none'
  };

  return (
    <div
      ref={cardContainerRef}
      style={cardStyles}
      className={`questionCardContent ${swipeDirection ? `swiping-${swipeDirection}` : ''}`}
    >
      <style>{`
        .questionCardContent { contain: content; }
        .questionCardContent * { -webkit-tap-highlight-color: transparent !important; outline: none !important; }
      `}</style>

      {isActive && isFlashcard && (showResult || selectedAnswer !== null) && !isExiting && (
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
            {shouldShowNumber && <span className="questionNumber">#{currentQuestion.number} </span>}
            {currentQuestion.question}
        </div>

        {lazyImage && (
          <div className="imageWrapper" onClick={() => isActive && onZoom && onZoom(lazyImage)}>
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

          if (showResult) {
            if (isCorrect) className += " correct";
            else if (isSelected) className += " wrong";
            else className += " dim";
          } else if (isSelected) {
            className += " selected";
          }

          if (!showResult && !isSelected && ((mode === "mock" || mode === "training" || mode === "real_test") && currentQuestion.userAnswer === optObj.originalIndex)) {
             className += " selected"; 
          }

          return (
            <button
              key={index}
              ref={(el) => { if (isActive && optionRefsForCurrent && optionRefsForCurrent.current) optionRefsForCurrent.current[index] = el; }}
              className={className}
              onClick={() => isActive && !disabled && onSelect(optObj.originalIndex)}
              disabled={disabled || !isActive}
            >
              <HighlightedText text={optObj.text} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
