import React, { useState, useEffect, useRef } from "react";

// --- PŘÍMÝ IMPORT OTÁZEK ---
import QUESTIONS_SPS from "./questionsSPS.json"; 
import QUESTIONS_STT from "./questionsSTT.json";
import { SubjectSelector } from "./components/SubjectSelector.jsx";

// ----------------------------------------------------------------------
// Importy obrázků
const images_sps = import.meta.glob("./images/images_sps/*.png", { eager: true, as: "url" });
const images_stt = import.meta.glob("./images/images_stt/*.png", { eager: true, as: "url" });
const images_custom = import.meta.glob("./images/*.png", { eager: true, as: "url" });

const allImagesMap = {
  SPS: images_sps,
  STT: images_stt,
  CUSTOM: images_custom,
  DEFAULT: images_custom, 
};
// ----------------------------------------------------------------------

/* ---------- Utilities ---------- */

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

const getImageUrl = (subject, questionNumber) => {
  const effectiveSubject = subject && allImagesMap[subject] ? subject : 'DEFAULT';
  const numStr = String(questionNumber);

  let pathPrefix;
  if (effectiveSubject === 'SPS') {
    pathPrefix = './images/images_sps/';
  } else if (effectiveSubject === 'STT') {
    pathPrefix = './images/images_stt/';
  } else {
    pathPrefix = './images/';
  }

  const imageKey = `${pathPrefix}${numStr}.png`;
  return allImagesMap[effectiveSubject]?.[imageKey] || null;
};

// --- CHYTRÉ VYHLEDÁVÁNÍ ---
const removeAccents = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const getSmartRegex = (search) => {
  if (!search) return null;
  const map = {
    'a': '[aá]', 'e': '[eéě]', 'i': '[ií]', 'o': '[oó]', 'u': '[uúů]',
    'y': '[yý]', 'c': '[cč]', 'd': '[dď]', 'n': '[nň]', 'r': '[rř]',
    's': '[sš]', 't': '[tť]', 'z': '[zž]'
  };
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.split('').map(char => {
     const lower = char.toLowerCase();
     return map[lower] || char; 
  }).join('');

  return new RegExp(`(${pattern})`, 'gi');
};

const HighlightedText = ({ text, highlightRegex }) => {
  if (!highlightRegex || !text) return <span>{text}</span>;
  const parts = text.split(highlightRegex);
  return (
    <span>
      {parts.map((part, i) => 
        highlightRegex.test(part) ? 
          <span key={i} style={{ backgroundColor: "rgba(255, 255, 0, 0.25)", color: "#fff", padding: "0 2px", borderRadius: "2px", fontWeight: "bold" }}>{part}</span> : 
          part
      )}
    </span>
  );
};

/* ---------- Small components ---------- */

// --- OPRAVENÝ IMAGE MODAL (LIGHTBOX) ---
const ImageModal = ({ src, onClose }) => {
    if (!src) return null;
    return (
        <div 
            className="modalOverlay" // Odstranil jsem "fadeIn", aby nekolidoval s fixní pozicí
            onClick={onClose} 
            style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.92)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                zIndex: 9999, // Velmi vysoký Z-index
                cursor: 'zoom-out', 
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                width: '100vw',
                height: '100vh',
                padding: '0'
            }}
        >
            {/* Obrázek bez obalového divu pro maximální spolehlivost */}
            <img 
                src={src} 
                alt="Fullscreen" 
                style={{ 
                    minWidth: '50vw', 
                    maxWidth: '96vw', 
                    maxHeight: '96vh', 
                    objectFit: 'contain',
                    borderRadius: '4px',
                    boxShadow: '0 0 50px rgba(0,0,0,1)',
                    backgroundColor: '#fff',
                    cursor: 'default' // Aby uživatel věděl, že na obrázek se "nekliká" pro zavření (klikne se vedle)
                }} 
                // Zrušil jsem stopPropagation, aby i klik na obrázek zavřel modal (pokud to tak chcete),
                // ALE lepší UX je, když klik na obrázek NIC neudělá a zavírá se jen okolím.
                // Pokud chcete zavírat i klikem na obrázek, smažte tento řádek:
                onClick={(e) => e.stopPropagation()} 
            />

            {/* Křížek pro explicitní zavření */}
            <div 
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '30px',
                    color: 'white',
                    fontSize: '40px',
                    opacity: 0.8,
                    cursor: 'pointer',
                    zIndex: 10000
                }}
            >
                &times;
            </div>
        </div>
    );
};

const SubjectBadge = ({ subject, compact = false }) => {
    if (!subject) return null;
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: compact ? '0.4rem 0.8rem' : '0.5rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: 'var(--color-primary-light)',
            fontWeight: '800',
            fontSize: compact ? '0.9rem' : '1rem',
            whiteSpace: 'nowrap'
        }}>
            {subject === "CUSTOM" ? "Vlastní" : subject}
        </div>
    );
};

function ConfirmModal({ title, message, onCancel, onConfirm, confirmText = "Ano, pokračovat", cancelText = "Zrušit" }) {
  return (
    <div className="modalOverlay" onClick={onCancel} style={{zIndex: 5000}}> 
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modalButtons">
          <button className="navButton" onClick={onCancel}>{cancelText}</button>
          <button className="navButton primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ mode, score, trainingTime, questionSet, maxSeenIndex, onBack, currentSubject, timeLeftAtSubmit, onZoom }) {
  const list = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
  return (
    <div className="resultScreen fadeIn">
      <div style={{ marginBottom: '1rem' }}>
        <SubjectBadge subject={currentSubject} />
      </div>

      <h2>{mode === "mock" ? "Test dokončen!" : "Vyhodnocení tréninku"}</h2>
      <p className="bigScore">{score.correct} / {score.total}</p>
      <p className="bigPercent">{score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100)} % správně</p>

      {mode === "mock" && <p className="timeSpent">Zbývající čas: {formatTime(timeLeftAtSubmit)}</p>}
      {mode === "training" && <p className="timeSpent">Čas strávený tréninkem: {formatTime(trainingTime)}</p>}

      <div className="reviewList">
        {list.map((q, i) => {
          const imageUrl = getImageUrl(currentSubject, q.number); 
          return (
            <div key={i} className={`reviewQuestion ${q.userAnswer === q.correctIndex ? "correct" : q.userAnswer !== undefined ? "wrong" : "unanswered"}`}>
              <strong>{i + 1}. {q.question}</strong>
              {imageUrl && (
                  <div className="imageWrapper small" onClick={() => onZoom(imageUrl)} style={{cursor: 'zoom-in', marginTop: '0.5rem', display: 'inline-block'}}>
                    <img src={imageUrl} alt="" className="questionImage small" />
                  </div>
              )}
              <div style={{marginTop: '0.5rem'}}><strong>Správná odpověď:</strong> <span style={{color: 'var(--color-review-correct)'}}>{q.options[q.correctIndex]}</span></div>
              {q.userAnswer !== undefined && (
                <div><strong>Tvá odpověď:</strong> <span style={{color: q.userAnswer === q.correctIndex ? 'var(--color-review-correct)' : 'var(--color-error)'}}>{q.options[q.userAnswer]}</span> {q.userAnswer === q.correctIndex ? "(správně)" : "(špatně)"}</div>
              )}
            </div>
          );
        })}
      </div>

      <button className="navButton primary" style={{ marginTop: "2rem" }} onClick={onBack}>Zpět do menu</button>
    </div>
  );
}

function Navigator({ questionSet, currentIndex, setCurrentIndex, mode, maxSeenIndex }) {
  const wrapperRef = React.useRef(null);
  const dragStateRef = React.useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: 0 });

  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const buttons = wrapper.querySelectorAll('.navNumber');
    const currentButton = buttons[currentIndex];

    if (currentButton) {
      const buttonLeft = currentButton.offsetLeft;
      const buttonWidth = currentButton.offsetWidth;
      const wrapperWidth = wrapper.clientWidth;
      const targetScroll = buttonLeft + buttonWidth / 2 - wrapperWidth / 2;
      wrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleMouseDown = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.pageX;
    dragStateRef.current.scrollLeft = wrapperRef.current.scrollLeft;
    dragStateRef.current.moved = 0;
  };
  const handleMouseMove = (e) => {
    if (!dragStateRef.current.isDragging || !wrapperRef.current) return;
    const diff = e.pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };
  const handleMouseUp = () => { dragStateRef.current.isDragging = false; };
  const handleTouchStart = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.touches[0].pageX;
    dragStateRef.current.scrollLeft = wrapperRef.current.scrollLeft;
    dragStateRef.current.moved = 0;
  };
  const handleTouchMove = (e) => {
    if (!dragStateRef.current.isDragging || !wrapperRef.current) return;
    const diff = e.touches[0].pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };
  const handleTouchEnd = () => { dragStateRef.current.isDragging = false; };
  const handleButtonClick = (i) => {
    if (dragStateRef.current.moved < 5) setCurrentIndex(i);
  };

  return (
    <div
      ref={wrapperRef}
      className={`navigatorWrapper ${mode === "training" ? "noAutoScroll" : ""} ${dragStateRef.current.isDragging ? "dragging" : ""}`}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <div className="compactNavigator">
        {questionSet.map((_, i) => {
          if (mode === "training" && i > maxSeenIndex) return null;
          const isAnswered = questionSet[i]?.userAnswer !== undefined;
          return (
            <button
              key={i}
              className={`navNumber ${currentIndex === i ? "current" : ""} ${isAnswered ? "answered" : ""}`}
              onClick={() => handleButtonClick(i)}
              aria-label={`Otázka ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({ currentQuestion, mode, showResult, selectedAnswer, onSelect, optionRefsForCurrent, disabled, isKeyboardMode, currentSubject, onZoom }) {
  if (!currentQuestion || !currentQuestion.options) return <div>Načítání otázky...</div>;

  const imageUrl = getImageUrl(currentSubject, currentQuestion.number); 

  return (
    <div>
      <div className="questionHeader">
        <h2 className="questionText">
          {mode === "random" && `#${currentQuestion.number} `}
          {currentQuestion.question}
        </h2>
        {imageUrl && (
          <div className="imageWrapper" onClick={() => onZoom(imageUrl)} style={{ cursor: 'zoom-in' }}>
            <img src={imageUrl} alt="Otázka" className="questionImage" />
            <div className="fullscreenHint">🔍 Klikni pro zvětšení (klávesa F)</div>
          </div>
        )}
      </div>

      <div className="options">
        {(currentQuestion.options || []).map((opt, i) => {
          let style = {};
          if (mode === "random" && showResult) {
            if (i === currentQuestion.correctIndex) style = { background: "rgba(34,197,94,0.35)", borderColor: "#22c55e", color: "#ecfdf5" };
            if (selectedAnswer === i && i !== currentQuestion.correctIndex) style = { background: "rgba(239,68,68,0.35)", borderColor: "#ef4444", color: "#fee2e2" };
          }
          else if (mode === "random" && !showResult) {
            if (selectedAnswer === i && isKeyboardMode) {
              style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa", outline: "2px solid #60a5fa" };
            }
          }
          else if ((mode === "mock" || mode === "training")) {
            if (currentQuestion.userAnswer === i) {
              style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
            }
          }

          return (
            <button
              key={i}
              ref={(el) => {
                if (!optionRefsForCurrent.current) optionRefsForCurrent.current = {};
                if (!optionRefsForCurrent.current[currentQuestion._localIndex]) optionRefsForCurrent.current[currentQuestion._localIndex] = [];
                optionRefsForCurrent.current[currentQuestion._localIndex][i] = el;
              }}
              className="optionButton"
              style={style}
              onClick={() => { if (!disabled) onSelect(i); }}
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

const ThemeToggle = ({ currentTheme, toggle }) => (
    <button className="menuBackButton" onClick={toggle} style={{ fontSize: "1.2rem", padding: "0.5rem 0.8rem" }}>
        {currentTheme === 'dark' ? '☀️' : '🌙'}
    </button>
);


/* ---------- Main App ---------- */

export default function App() {
  const [subject, setSubject] = useState(null);
  const [customQuestions, setCustomQuestions] = useState(null);
  const [activeQuestionsCache, setActiveQuestionsCache] = useState(null);
  const [menuSelection, setMenuSelection] = useState(0);
  const menuButtonsRef = useRef([]);

  const [mode, setMode] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [searchTerm, setSearchTerm] = useState("");

  const [questionSet, setQuestionSet] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [combo, setCombo] = useState(0); 
  const [shake, setShake] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [maxSeenIndex, setMaxSeenIndex] = useState(0);
  const [trainingTime, setTrainingTime] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  // STATE PRO MODAL S OBRÁZKEM
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const [timeLeftAtSubmit, setTimeLeftAtSubmit] = useState(0);

  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const optionRefsForCurrent = useRef({});
  const cardRef = useRef(null);

  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const isModalActive = showConfirmExit || showConfirmSubmit || fullscreenImage;
    document.body.className = `${theme === 'light' ? 'light-mode' : ''} ${isModalActive ? 'modal-open' : ''}`;
  }, [theme, showConfirmExit, showConfirmSubmit, fullscreenImage]);

  useEffect(() => {
    if (Array.isArray(QUESTIONS_SPS)) QUESTIONS_SPS.forEach((q, i) => { q._localIndex = i; });
    if (Array.isArray(QUESTIONS_STT)) QUESTIONS_STT.forEach((q, i) => { q._localIndex = i; });
  }, []);

  useEffect(() => {
    const getActive = () => {
      let base = [];
      if (subject === "SPS") base = QUESTIONS_SPS;
      else if (subject === "STT") base = QUESTIONS_STT;
      else if (subject === "CUSTOM") base = Array.isArray(customQuestions) ? customQuestions : [];
      return base.map((q, idx) => ({ ...q, options: [...(q.options || [])], userAnswer: undefined, _localIndex: idx }));
    };
    const active = getActive();
    setActiveQuestionsCache(active);
  }, [subject, customQuestions]);

  useEffect(() => {
    const setVH = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight}px`);
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  // --- HISTORY API ---
  useEffect(() => {
    if (!window.history.state) {
        window.history.replaceState({ view: 'home' }, '');
    }

    const handlePopState = (event) => {
        const state = event.state;

        if (!state || state.view === 'home') {
            setSubject(null);
            setMode(null);
            setQuestionSet([]);
            setFinished(false);
            setMenuSelection(0);
        }
        else if (state.view === 'menu') {
            setSubject(state.subject);
            setMode(null);
            setQuestionSet([]);
            setFinished(false);
            setMenuSelection(0);
        }
        else if (state.view === 'quiz') {
             setSubject(state.subject);
             setMode(null);
        }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- ESC handler ---
  useEffect(() => {
      if (!fullscreenImage) return;
      const handleEsc = (e) => {
          if (e.key === "Escape") {
              setFullscreenImage(null);
              e.stopPropagation();
          }
      };
      window.addEventListener('keydown', handleEsc, { capture: true });
      return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [fullscreenImage]);

  // ---

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0) {
        if (isKeyboardMode) setIsKeyboardMode(false);
      }
    };

    const handleKeyDown = (e) => {
      if (!isKeyboardMode) setIsKeyboardMode(true);

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "f", "F"].includes(e.key.toString())) {
         e.preventDefault();
      }

      if (showConfirmExit || showConfirmSubmit) {
          return;
      }

      // LOGIKA PRO F (POUZE V REŽIMU KVÍZU)
      if (mode && (mode !== "review" && mode !== null)) {
        const currentQ = questionSet[currentIndex];
        const imageUrl = currentQ ? getImageUrl(subject, currentQ.number) : null;

        if (e.key === 'f' || e.key === 'F') {
            if (fullscreenImage) {
                setFullscreenImage(null);
                return;
            } else if (imageUrl) {
                setFullscreenImage(imageUrl);
                return;
            }
        }
      }

      if (fullscreenImage) return;

      if (finished) {
          if (["Backspace", "Enter", "ArrowLeft"].includes(e.key)) {
              window.history.back();
          }
          return;
      }

      const curQ = questionSet[currentIndex] || { options: [] };
      const opts = curQ.options.length;

      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        if (mode === "random" && !showResult) selectRandomAnswer(selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts);
        else if (mode !== "random") handleAnswer(curQ.userAnswer === undefined ? opts - 1 : (curQ.userAnswer - 1 + opts) % opts);
      }
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        if (mode === "random" && !showResult) selectRandomAnswer(selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts);
        else if (mode !== "random") handleAnswer(curQ.userAnswer === undefined ? 0 : (curQ.userAnswer + 1) % opts);
      }

      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        if (mode === "random" && showResult) {
            nextRandomQuestion();
        } else if (mode !== "random" && currentIndex === 0) {
            tryReturnToMenu();
        } else {
            moveToQuestion(Math.max(0, currentIndex - 1));
        }
      }

      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight" || e.key === "Enter") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else if (mode === "random" && !showResult) { if (selectedAnswer !== null) confirmRandomAnswer(); }
        else moveToQuestion(currentIndex + 1);
      }
      if (e.key === " ") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else if (mode === "random" && !showResult && selectedAnswer !== null) confirmRandomAnswer();
        else if (!finished && (mode === "mock" || mode === "training")) setShowConfirmSubmit(true);
      }
      if (e.key === "Backspace") {
        if (curQ.userAnswer !== undefined && mode !== "random") clearAnswer();
        else tryReturnToMenu();
      }
      if (e.key === "Escape") {
        if (mode === "random" && showResult) clearAnswer();
        else tryReturnToMenu(); 
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, questionSet, currentIndex, showResult, showConfirmSubmit, showConfirmExit, fullscreenImage, maxSeenIndex, finished, selectedAnswer, isKeyboardMode]);

  const prepareQuestionSet = (baseQuestions) => baseQuestions.map((q, idx) => ({ ...q, options: [...(q.options || [])], userAnswer: undefined, _localIndex: idx }));

  const handleSelectSubject = (subj) => {
      const upperSubj = subj.toUpperCase();
      setSubject(upperSubj);
      window.history.pushState({ view: 'menu', subject: upperSubj }, '');
  };

  const handleStartMode = (startFn, modeName) => {
      startFn();
      window.history.pushState({ view: 'quiz', subject: subject, mode: modeName }, '');
  };

  const startRandomMode = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(shuffled); setMode("random"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false);
    setCombo(0); 
  };

  const startMockTest = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length)).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(sel); setTimeLeft(1800); setMode("mock"); setCurrentIndex(0); setMaxSeenIndex(0); setFinished(false); setIsKeyboardMode(false);
  };

  const startTrainingMode = () => {
    const all = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    setQuestionSet(all); setMode("training"); setCurrentIndex(0); setMaxSeenIndex(0); setTrainingTime(0); setFinished(false); setIsKeyboardMode(false);
  };

  const startReviewMode = () => {
    const all = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    setQuestionSet(all); setMode("review");
  };

  const selectRandomAnswer = (idx) => { if (!finished && mode === "random" && !showResult) { setSelectedAnswer(idx); setIsKeyboardMode(true); } };

  const clickRandomAnswer = (idx) => { 
      if(finished || mode!=="random" || showResult) return;
      const currentQ=questionSet[currentIndex];
      const isCorrect = idx===currentQ.correctIndex;

      setQuestionSet(prev=>{ const c=[...prev]; c[currentIndex]={...c[currentIndex], userAnswer:idx}; return c; });
      setSelectedAnswer(idx); setShowResult(true);

      if (isCorrect) {
        setScore(s=>({correct:s.correct+1, total:s.total+1}));
        setCombo(c => c + 1);
      } else {
        setScore(s=>({...s, total:s.total+1}));
        if (combo >= 3) { 
            setShake(true);
            setTimeout(() => setShake(false), 500);
        }
        setCombo(0);
      }
  };

  const confirmRandomAnswer = () => { 
      if(finished || mode!=="random" || showResult) return;
      const currentQ=questionSet[currentIndex];
      const ans=selectedAnswer!==null?selectedAnswer:-1;
      const isCorrect = ans===currentQ.correctIndex;

      setQuestionSet(prev=>{ const c=[...prev]; c[currentIndex]={...c[currentIndex], userAnswer:ans}; return c; });
      setShowResult(true);

      if(ans!==-1) {
          if (isCorrect) {
              setScore(s=>({correct:s.correct+1, total:s.total+1}));
              setCombo(c => c + 1);
          } else {
              setScore(s=>({correct:s.correct, total:s.total+1}));
              if (combo >= 3) {
                  setShake(true);
                  setTimeout(() => setShake(false), 500);
              }
              setCombo(0);
          }
      } else {
          setScore(s=>({...s, total:s.total+1}));
          if (combo >= 3) {
              setShake(true);
              setTimeout(() => setShake(false), 500);
          }
          setCombo(0);
      }

      if(selectedAnswer===null) setSelectedAnswer(-1);
  };

  const handleAnswer = (idx) => {
    if (finished || mode === "review") return;
    setIsKeyboardMode(true);
    setQuestionSet(prev => { const c=[...prev]; c[currentIndex].userAnswer=idx; return c; });
  };
  const clearAnswer = () => {
      setQuestionSet(prev=>{ const c=[...prev]; if(c[currentIndex]) c[currentIndex].userAnswer=undefined; return c; });
      setSelectedAnswer(null); setShowResult(false);
  };
  const moveToQuestion = (newIdx) => {
      const b=Math.max(0, Math.min(newIdx, questionSet.length-1));
      if(mode==="training" && b>maxSeenIndex && b>currentIndex) setMaxSeenIndex(b);
      setCurrentIndex(b); if(mode==="random") { setSelectedAnswer(null); setShowResult(false); }
  };
  const nextRandomQuestion = () => {
      if(!questionSet.length)return;
      let nextIdx, attempts=0;
      do { nextIdx=Math.floor(Math.random()*questionSet.length); attempts++; } while(nextIdx===currentIndex && questionSet.length>1 && attempts<10);
      setCurrentIndex(nextIdx); setSelectedAnswer(null); setShowResult(false);
  };

  const confirmSubmit = () => setShowConfirmSubmit(true);
  const cancelSubmit = () => setShowConfirmSubmit(false);
  const submitTest = () => {
      const qEval = mode==="training" ? questionSet.slice(0,maxSeenIndex+1) : questionSet;
      const cor = qEval.filter(q=>q.userAnswer===q.correctIndex).length;
      setScore({correct:cor, total:qEval.length}); setTimeLeftAtSubmit(timeLeft); setFinished(true); setShowConfirmSubmit(false);
  };
  const tryReturnToMenu = () => {
      if((mode==="mock"||mode==="training") && !finished) setShowConfirmExit(true);
      else window.history.back();
  };

  const confirmExit = () => { 
      setShowConfirmExit(false);
      window.history.back();
  };

  const handleFileUpload = async (questions) => {
    if (!questions || !Array.isArray(questions)) return;
    const normalized = questions.map((q, idx) => ({
      number: q.number ?? idx + 1,
      question: q.question ?? `Otázka ${idx + 1}`,
      options: q.options || [],
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    }));
    setCustomQuestions(normalized); 
    setSubject("CUSTOM");
    window.history.pushState({ view: 'menu', subject: 'CUSTOM' }, '');
  };

  // Navigace v menu klávesnicí
  useEffect(() => {
    if (mode) return;
    const handleMenuNav = (e) => {
        const k=e.key.toLowerCase();
        if(k==="w"||k==="arrowup"){ e.preventDefault(); setIsKeyboardMode(true); setMenuSelection(p=>(p-1+(subject?4:3))%(subject?4:3)); }
        else if(k==="s"||k==="arrowdown"){ e.preventDefault(); setIsKeyboardMode(true); setMenuSelection(p=>(p+1)%(subject?4:3)); }
        else if(k==="d"||k==="arrowright"||k==="enter"){
             e.preventDefault(); setIsKeyboardMode(true);
             if(!subject){
                 if(menuSelection===0) handleSelectSubject("SPS");
                 else if(menuSelection===1) handleSelectSubject("STT");
                 else if(menuSelection===2) document.querySelector("input[type='file']")?.click();
             } else {
                 if(menuSelection===0) handleStartMode(startRandomMode, 'random'); 
                 else if(menuSelection===1) handleStartMode(startMockTest, 'mock'); 
                 else if(menuSelection===2) handleStartMode(startTrainingMode, 'training'); 
                 else if(menuSelection===3) handleStartMode(startReviewMode, 'review');
             }
        }
        else if(k==="a"||k==="arrowleft"||k==="backspace"){ 
            e.preventDefault(); 
            if(subject) window.history.back();
        }
    };
    window.addEventListener("keydown", handleMenuNav);
    return () => window.removeEventListener("keydown", handleMenuNav);
  }, [mode, subject, menuSelection]);


  // === RENDER ===
  const isModalActive = showConfirmExit || showConfirmSubmit;

  if (!mode) {
    if (!subject) {
      return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{width:'100%', display:'flex', justifyContent:'flex-end', padding:'1rem 0'}}>
              <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
          </div>
          <SubjectSelector menuSelection={menuSelection} onSelectSubject={handleSelectSubject} onUploadFile={handleFileUpload} isKeyboardMode={isKeyboardMode} />
        </div>
      );
    }

    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div className="navbar" style={{width:'100%', maxWidth:'800px', marginBottom:'1rem'}}>
             <div className="navbar-group">
                <button className="menuBackButton" onClick={() => window.history.back()}>← Změnit předmět</button> 
                <SubjectBadge subject={subject} compact />
             </div>
             <div className="navbar-group">
                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
             </div>
        </div>

        <h1 className="title">Trénink uzavřených otázek</h1>

        <div className="menuColumn">
          <button ref={(el) => menuButtonsRef.current[0] = el} className={`menuButton ${menuSelection === 0 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startRandomMode, 'random')}>Flashcards 🧠</button>
          <button ref={(el) => menuButtonsRef.current[1] = el} className={`menuButton ${menuSelection === 1 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startMockTest, 'mock')}>Test nanečisto ⏱️</button>
          <button ref={(el) => menuButtonsRef.current[2] = el} className={`menuButton ${menuSelection === 2 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startTrainingMode, 'training')}>Tréninkový režim 🏋️</button>
          <button ref={(el) => menuButtonsRef.current[3] = el} className={`menuButton ${menuSelection === 3 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startReviewMode, 'review')}>Prohlížení otázek 📚</button>
        </div>

        <div style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6" }}>
          Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />
          Mezerník – potvrzení • Enter – potvrzení / další • Esc – zrušit
        </div>
      </div>
    );
  }

  // --- RENDER PRO REVIEW MODE S MODALEM MIMO KONTEJNER ---
  if (mode === "review") {
      const normalizedSearch = removeAccents(searchTerm);
      const filteredQuestions = questionSet.filter(q => {
          const normQ = removeAccents(q.question); const normNum = String(q.number); const normOptions = q.options.map(opt => removeAccents(opt));
          return normQ.includes(normalizedSearch) || normNum.includes(normalizedSearch) || normOptions.some(opt => opt.includes(normalizedSearch));
      });
      const highlightRegex = getSmartRegex(searchTerm);

      return (
        <>
          {/* IMAGE MODAL MUSÍ BÝT ZDE, MIMO CONTAINER! */}
          {fullscreenImage && <ImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}

          <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
            <div className="navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={tryReturnToMenu}>← Zpět</button>
                    <SubjectBadge subject={subject} compact />
                </div>
                <div className="navbar-group">
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>

            <h1 className="title">Prohlížení otázek</h1>
            <input type="text" placeholder="Hledat (např. 'čerpadlo', číslo)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="reviewSearchInput" />

            <div className="reviewGrid">
              {filteredQuestions.map((q) => {
                const imageUrl = getImageUrl(subject, q.number); 
                return (
                  <div key={q.number} className="reviewCard">
                    <div className="reviewHeader"><strong>#{q.number}.</strong> <HighlightedText text={q.question} highlightRegex={highlightRegex} /></div>
                    {/* Kliknutí na obrázek volá setFullscreenImage */}
                    {imageUrl && <div className="imageWrapper" onClick={() => setFullscreenImage(imageUrl)} style={{cursor: 'zoom-in', marginTop: '0.5rem'}}><img src={imageUrl} alt="" className="reviewImage" /></div>}
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {q.options.map((opt, idx) => (
                            <div key={idx} style={{ fontSize: '0.9rem', color: idx === q.correctIndex ? 'var(--color-review-correct)' : 'var(--color-text-secondary)', fontWeight: idx === q.correctIndex ? 'bold' : 'normal', display: 'flex', gap: '0.5rem' }}>
                                <span>{idx === q.correctIndex ? '✅' : '•'}</span>
                                <span><HighlightedText text={opt} highlightRegex={highlightRegex} /></span>
                            </div>
                        ))}
                    </div>
                  </div>
                );
              })}
              {filteredQuestions.length === 0 && <p style={{textAlign: 'center', color: '#888', gridColumn: '1/-1'}}>Žádné otázky nenalezeny.</p>}
            </div>
          </div>
        </>
      );
  }

  const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

  let comboClass = "";
  if (combo >= 10) comboClass = "combo-high";
  else if (combo >= 5) comboClass = "combo-med";
  else if (combo >= 3) comboClass = "combo-low";

  // --- RENDER PRO OSTATNÍ MODY (TAKÉ S MODALEM MIMO KONTEJNER) ---
  return (
    <>
      {fullscreenImage && <ImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />}

      <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
        {showConfirmSubmit && <ConfirmModal title={mode === "training" ? "Ukončit trénink?" : "Odevzdat test?"} message="Jste si jisti, že chcete předčasně odevzdat?" onCancel={cancelSubmit} onConfirm={submitTest} confirmText={mode === "training" ? "Vyhodnotit" : "Odevzdat"} />}
        {showConfirmExit && <ConfirmModal title="Ukončit režim?" message="Ztracené odpovědi v Mock testu nebo progres v tréninku nebudou uloženy." onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Opravdu ukončit" />}

        {finished && (
          <ResultScreen mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={() => window.history.back()} currentSubject={subject} timeLeftAtSubmit={timeLeftAtSubmit} onZoom={setFullscreenImage} />
        )}

        {!finished && (
          <>
            <div className="navbar">
              <div className="navbar-group">
                  <button className="menuBackButton" onClick={tryReturnToMenu}>← Zpět</button>
                  <SubjectBadge subject={subject} compact />
              </div>
              <div className="navbar-group">
                  {mode === "mock" && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
                  {mode === "training" && <div className="timer" style={{ color: "#a3a3a3" }}>{formatTime(trainingTime)}</div>}
                  {(mode === "mock" || mode === "training") && <button className="submitTopButton" onClick={confirmSubmit}>{mode === "training" ? "Vyhodnotit" : "Odevzdat"}</button>}
                  <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
              </div>
            </div>

            <div className="quizContentWrapper">
              <h1 className="title">
                {mode === "random" ? "Flashcards" : mode === "mock" ? "Test nanečisto" : "Tréninkový režim"}
              </h1>

              {mode === "random" ? (
                  <div className={`flashcardHeader ${comboClass}`}>
                      <div className="statItem">
                          <span className="statLabel">Úspěšnost</span>
                          <span className="statValue">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</span>
                      </div>

                      {combo >= 3 && (
                          <div className="comboContainer">
                              <div className="comboFlame">🔥</div>
                              <div className="comboCount">{combo}x</div>
                          </div>
                      )}

                      <div className="statItem">
                          <span className="statLabel">Celkem</span>
                          <span className="statValue">{score.total}</span>
                      </div>
                  </div>
              ) : (
                  <>
                      <div className="progressBarContainer">
                          <div className="progressBarFill" style={{ width: `${((currentIndex + 1) / (mode === "training" ? maxSeenIndex + 1 : questionSet.length)) * 100}%` }}></div>
                      </div>
                      <div className="progressText">
                          Otázka {currentIndex + 1} / {mode === "training" ? maxSeenIndex + 1 : questionSet.length}
                      </div>
                  </>
              )}

              <div className={`card ${shake ? "shake" : ""}`} ref={cardRef}>
                <QuestionCard
                  currentQuestion={currentQuestion} mode={mode} showResult={showResult} selectedAnswer={selectedAnswer} onSelect={(i) => mode === "random" ? clickRandomAnswer(i) : handleAnswer(i)}
                  optionRefsForCurrent={optionRefsForCurrent} disabled={mode === "random" && showResult} isKeyboardMode={isKeyboardMode} currentSubject={subject} onZoom={setFullscreenImage}
                />

                {mode === "random" && !showResult && (
                  <div className="actionButtons right"><button className="navButton primary" onClick={confirmRandomAnswer}>Potvrdit</button></div>
                )}
                {mode === "random" && showResult && (
                  <div className="actionButtons right"><button className="navButton" onClick={nextRandomQuestion}>Další otázka</button></div>
                )}

                {(mode === "mock" || mode === "training") && (
                  <>
                    <div className="actionButtons spaced">
                      <button className="navButton" onClick={() => moveToQuestion(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>Předchozí</button>
                      <button className="navButton" onClick={() => moveToQuestion(currentIndex + 1)} disabled={currentIndex >= questionSet.length - 1}>Další</button>
                    </div>
                    <div className="navigatorPlaceholder">
                      <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={moveToQuestion} mode={mode} maxSeenIndex={maxSeenIndex} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        <div className="footer"></div>
      </div>
    </>
  );
}