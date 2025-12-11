import React, { useState, useEffect, useRef } from "react";
import QUESTIONS_SPS from "./questionsSPS.json"; 
import QUESTIONS_STT from "./questionsSTT.json";
import { SubjectSelector } from "./components/SubjectSelector.jsx";

// Importy obrázků
const images_sps = import.meta.glob("./images/images_sps/*.{png,jpg,jpeg,PNG,JPG}", { eager: true, as: "url" });
const images_stt = import.meta.glob("./images/images_stt/*.{png,jpg,jpeg,PNG,JPG}", { eager: true, as: "url" });
const images_custom = import.meta.glob("./images/*.{png,jpg,jpeg,PNG,JPG}", { eager: true, as: "url" });

const allImagesMap = {
  SPS: images_sps,
  STT: images_stt,
  CUSTOM: images_custom,
  DEFAULT: images_custom, 
  QUESTIONS: images_custom, 
};

/* ---------- Utilities ---------- */

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const getImageUrl = (subject, questionNumber) => {
  const effectiveSubject = subject && allImagesMap[subject] ? subject : 'DEFAULT';
  const numStr = String(questionNumber);
  let map = allImagesMap[effectiveSubject];
  if (!map) return null;
  const foundKey = Object.keys(map).find(key => {
      const fileName = key.split('/').pop().split('.')[0];
      return fileName === numStr;
  });
  return foundKey ? map[foundKey] : null;
};

// --- CHYTRÉ VYHLEDÁVÁNÍ ---
const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const getSmartRegex = (search) => {
  if (!search) return null;
  const map = { 'a': '[aá]', 'e': '[eéě]', 'i': '[ií]', 'o': '[oó]', 'u': '[uúů]', 'y': '[yý]', 'c': '[cč]', 'd': '[dď]', 'n': '[nň]', 'r': '[rř]', 's': '[sš]', 't': '[tť]', 'z': '[zž]' };
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
          <span key={i} className="highlightMark">{part}</span> : part
      )}
    </span>
  );
};

/* ---------- Components ---------- */

const SubjectBadge = ({ subject }) => {
    if (!subject) return null;
    return (
        <span className="subjectBadge">
            {subject === "CUSTOM" ? "Vlastní" : subject}
        </span>
    );
};

function ConfirmModal({ title, message, onCancel, onConfirm, confirmText = "Ano, pokračovat", cancelText = "Zrušit" }) {
  return (
    <div className="modalOverlay" onClick={onCancel}> 
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

function ResultScreen({ mode, score, trainingTime, questionSet, maxSeenIndex, onBack, currentSubject, timeLeftAtSubmit }) {
  const list = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
  const backBtnRef = useRef(null);

  useEffect(() => {
    const handleResultKeys = (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); onBack(); }
    };
    window.addEventListener("keydown", handleResultKeys);
    return () => window.removeEventListener("keydown", handleResultKeys);
  }, [onBack]);

  return (
    <div className="resultScreen fadeIn">
      <div style={{marginBottom: '0.5rem'}}><SubjectBadge subject={currentSubject} /></div>
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
              {imageUrl && <img src={imageUrl} alt="" className="questionImage small" onClick={() => window.open(imageUrl, "_blank")} />}
              <div><strong>Správná odpověď:</strong> {q.options[q.correctIndex]}</div>
              {q.userAnswer !== undefined && (
                <div><strong>Tvá odpověď:</strong> {q.options[q.userAnswer]} {q.userAnswer === q.correctIndex ? "(správně)" : "(špatně)"}</div>
              )}
            </div>
          );
        })}
      </div>
      <button ref={backBtnRef} className="navButton primary" style={{ marginTop: "2rem" }} onClick={onBack}>Zpět do menu (Enter)</button>
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
      const scroll = currentButton.offsetLeft + currentButton.offsetWidth / 2 - wrapperRef.current.clientWidth / 2;
      wrapperRef.current.scrollTo({ left: scroll, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleMouseDown = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current = { isDragging: true, startX: e.pageX, scrollLeft: wrapperRef.current.scrollLeft, moved: 0 };
  };
  const handleMouseMove = (e) => {
    if (!dragStateRef.current.isDragging) return;
    const diff = e.pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };
  const handleMouseUp = () => { dragStateRef.current.isDragging = false; };
  const handleTouchStart = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current = { isDragging: true, startX: e.touches[0].pageX, scrollLeft: wrapperRef.current.scrollLeft, moved: 0 };
  };
  const handleTouchMove = (e) => {
    if (!dragStateRef.current.isDragging) return;
    const diff = e.touches[0].pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };
  const handleTouchEnd = () => { dragStateRef.current.isDragging = false; };
  const handleButtonClick = (i) => { if (dragStateRef.current.moved < 5) setCurrentIndex(i); };

  return (
    <div ref={wrapperRef} className="navigatorWrapper" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="compactNavigator">
        {questionSet.map((_, i) => {
          if (mode === "training" && i > maxSeenIndex) return null;
          return (
            <button key={i} className={`navNumber ${currentIndex === i ? "current" : ""} ${questionSet[i]?.userAnswer !== undefined ? "answered" : ""}`} onClick={() => handleButtonClick(i)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({ currentQuestion, mode, showResult, selectedAnswer, onSelect, optionRefsForCurrent, disabled, isKeyboardMode, currentSubject }) {
  if (!currentQuestion || !currentQuestion.options) return <div>Načítání...</div>;
  const imageUrl = getImageUrl(currentSubject, currentQuestion.number); 

  return (
    <div>
      <div className="questionHeader">
        <h2 className="questionText">{mode === "random" && `#${currentQuestion.number} `}{currentQuestion.question}</h2>
        {imageUrl && (
          <div className="imageWrapper">
            <img src={imageUrl} alt="Otázka" className="questionImage" onClick={() => window.open(imageUrl, "_blank")} />
            <div className="fullscreenHint">Klikni pro zvětšení</div>
          </div>
        )}
      </div>
      <div className="options">
        {(currentQuestion.options || []).map((opt, i) => {
          let style = {};
          if (mode === "random" && showResult) {
            if (i === currentQuestion.correctIndex) style = { background: "rgba(34,197,94,0.35)", borderColor: "#22c55e", color: "#ecfdf5" };
            if (selectedAnswer === i && i !== currentQuestion.correctIndex) style = { background: "rgba(239,68,68,0.35)", borderColor: "#ef4444", color: "#fee2e2" };
          } else if (mode === "random" && !showResult && selectedAnswer === i && isKeyboardMode) {
              style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa", outline: "2px solid #60a5fa" };
          } else if ((mode === "mock" || mode === "training") && currentQuestion.userAnswer === i) {
              style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
          }

          return (
            <button key={i} className="optionButton" style={style} onClick={() => !disabled && onSelect(i)} disabled={disabled}
              ref={el => { if(!optionRefsForCurrent.current[currentQuestion._localIndex]) optionRefsForCurrent.current[currentQuestion._localIndex] = []; optionRefsForCurrent.current[currentQuestion._localIndex][i] = el; }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ThemeToggle = ({ theme, toggle }) => (
    <button className="menuBackButton" onClick={toggle}>
        {theme === 'dark' ? '☀️ Světlý motiv' : '🌙 Tmavý motiv'}
    </button>
);


/* ---------- MAIN APP ---------- */

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
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [maxSeenIndex, setMaxSeenIndex] = useState(0);
  const [trainingTime, setTrainingTime] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [timeLeftAtSubmit, setTimeLeftAtSubmit] = useState(0);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  const optionRefsForCurrent = useRef({});
  const cardRef = useRef(null);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    document.body.className = `${theme === 'light' ? 'light-mode' : ''} ${(showConfirmExit || showConfirmSubmit) ? 'modal-open' : ''}`;
  }, [theme, showConfirmExit, showConfirmSubmit]);

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
    setActiveQuestionsCache(getActive());
  }, [subject, customQuestions]);

  useEffect(() => {
    const handleMouseMove = () => { if (isKeyboardMode) setIsKeyboardMode(false); };
    const handleKeyDown = () => { if (!isKeyboardMode) setIsKeyboardMode(true); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('keydown', handleKeyDown); };
  }, [isKeyboardMode]);

  useEffect(() => {
    if (mode === "training" && currentIndex > maxSeenIndex) setMaxSeenIndex(currentIndex);
    if ((mode === "mock" || mode === "random") && cardRef.current) setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [currentIndex, mode]);

  useEffect(() => {
    if (mode !== "training" || finished) return;
    const t = setInterval(() => setTrainingTime(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  useEffect(() => {
    let intervalId;
    if (mode === "mock" && !finished) {
      intervalId = setInterval(() => setTimeLeft(prev => {
         if (prev <= 1) { clearInterval(intervalId); return 0; }
         return prev - 1;
      }), 1000);
    }
    return () => clearInterval(intervalId);
  }, [mode, finished]);

  useEffect(() => {
    if (mode === "mock" && timeLeft === 0 && !finished) submitTest();
  }, [timeLeft, mode, finished]);

  useEffect(() => {
    if (!mode || mode === "review") return;
    const onKey = (e) => {
      const curQ = questionSet[currentIndex] || { options: [] };
      const opts = curQ.options.length;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        if (mode === "random" && !showResult) selectRandomAnswer(selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts);
        else if (mode !== "random") handleAnswer(curQ.userAnswer === undefined ? opts - 1 : (curQ.userAnswer - 1 + opts) % opts);
      }
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        if (mode === "random" && !showResult) selectRandomAnswer(selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts);
        else if (mode !== "random") handleAnswer(curQ.userAnswer === undefined ? 0 : (curQ.userAnswer + 1) % opts);
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else moveToQuestion(Math.max(0, currentIndex - 1));
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
         if (showConfirmSubmit) setShowConfirmSubmit(false);
         else if (showConfirmExit) setShowConfirmExit(false);
         else if (mode === "random" && showResult) clearAnswer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, questionSet, currentIndex, showResult, showConfirmSubmit, showConfirmExit, selectedAnswer, isKeyboardMode]);

  const prepareQuestionSet = (baseQuestions) => baseQuestions.map((q, idx) => ({ ...q, options: [...(q.options || [])], userAnswer: undefined, _localIndex: idx }));

  const startRandomMode = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(shuffled); setMode("random"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false);
  };
  const startMockTest = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length)).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(sel); setTimeLeft(1800); setMode("mock"); setCurrentIndex(0); setMaxSeenIndex(0); setFinished(false); setIsKeyboardMode(false);
  };
  const startTrainingMode = () => {
    setQuestionSet(activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS)); setMode("training"); setCurrentIndex(0); setMaxSeenIndex(0); setTrainingTime(0); setFinished(false); setIsKeyboardMode(false);
  };
  const startReviewMode = () => {
    setQuestionSet(activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS)); setMode("review");
  };

  const selectRandomAnswer = (idx) => { if (finished || mode !== "random" || showResult) return; setSelectedAnswer(idx); setIsKeyboardMode(true); };
  const clickRandomAnswer = (idx) => {
    if (finished || mode !== "random" || showResult) return;
    const copy = [...questionSet]; copy[currentIndex].userAnswer = idx; setQuestionSet(copy);
    setSelectedAnswer(idx); setShowResult(true);
    setScore(s => ({ correct: s.correct + (idx === questionSet[currentIndex].correctIndex ? 1 : 0), total: s.total + 1 }));
  };
  const confirmRandomAnswer = () => {
    if (finished || mode !== "random" || showResult) return;
    const answerToSave = selectedAnswer !== null ? selectedAnswer : -1;
    const copy = [...questionSet]; copy[currentIndex].userAnswer = answerToSave; setQuestionSet(copy);
    setShowResult(true);
    if (answerToSave !== -1) setScore(s => ({ correct: s.correct + (answerToSave === questionSet[currentIndex].correctIndex ? 1 : 0), total: s.total + 1 }));
    else setScore(s => ({ ...s, total: s.total + 1 }));
    if (selectedAnswer === null) setSelectedAnswer(-1);
  };
  const handleAnswer = (idx) => {
    if (finished || mode === "review") return;
    setIsKeyboardMode(true);
    const copy = [...questionSet]; copy[currentIndex].userAnswer = idx; setQuestionSet(copy);
  };
  const clearAnswer = () => {
    const copy = [...questionSet]; if (copy[currentIndex]) copy[currentIndex].userAnswer = undefined; setQuestionSet(copy);
    setSelectedAnswer(null); setShowResult(false);
  };
  const moveToQuestion = (newIdx) => {
    const bounded = Math.max(0, Math.min(newIdx, questionSet.length - 1));
    if (mode === "training" && bounded > maxSeenIndex) setMaxSeenIndex(bounded);
    setCurrentIndex(bounded);
    if (mode === "random") { setSelectedAnswer(null); setShowResult(false); }
  };
  const nextRandomQuestion = () => {
    let nextIdx, attempts = 0;
    do { nextIdx = Math.floor(Math.random() * questionSet.length); attempts++; } while (nextIdx === currentIndex && questionSet.length > 1 && attempts < 10);
    setCurrentIndex(nextIdx); setSelectedAnswer(null); setShowResult(false);
  };

  const confirmSubmit = () => setShowConfirmSubmit(true);
  const cancelSubmit = () => setShowConfirmSubmit(false);
  const submitTest = () => {
    const evalSet = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
    const correct = evalSet.filter(q => q.userAnswer === q.correctIndex).length;
    setScore({ correct, total: evalSet.length }); setTimeLeftAtSubmit(timeLeft); setFinished(true); setShowConfirmSubmit(false);
  };
  const tryReturnToMenu = () => { if ((mode === "mock" || mode === "training") && !finished) setShowConfirmExit(true); else resetToMenu(); };
  const confirmExit = () => { resetToMenu(); setShowConfirmExit(false); };
  const resetToMenu = () => { setMode(null); setQuestionSet([]); setCurrentIndex(0); setFinished(false); setScore({ correct: 0, total: 0 }); setShowResult(false); setSelectedAnswer(null); setMaxSeenIndex(0); setIsKeyboardMode(false); setMenuSelection(0); setTimeLeftAtSubmit(0); setSearchTerm(""); };
  const handleFileUpload = async (questions) => {
    const normalized = questions.map((q, idx) => ({ ...q, number: q.number ?? idx+1, question: q.question ?? `Otázka ${idx+1}`, options: q.options || [], correctIndex: q.correctIndex ?? 0 }));
    setCustomQuestions(normalized); setSubject("CUSTOM");
  };

  /* RENDER */

  if (!mode) {
    if (!subject) return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ThemeToggle theme={theme} toggle={toggleTheme} />
        <SubjectSelector menuSelection={menuSelection} onSelectSubject={(subj) => setSubject(subj.toUpperCase())} onUploadFile={handleFileUpload} isKeyboardMode={isKeyboardMode} />
      </div>
    );
    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem"}}>
            <button className="menuBackButton" onClick={() => setSubject(null)}>Změnit předmět</button> 
            <SubjectBadge subject={subject} />
            <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
        <h1 className="title">Trénink uzavřených otázek</h1>
        <div className="menuColumn">
          <button ref={el => menuButtonsRef.current[0] = el} className={`menuButton ${menuSelection === 0 && isKeyboardMode ? "selected" : ""}`} onClick={startRandomMode}>Flashcards 🧠</button>
          <button ref={el => menuButtonsRef.current[1] = el} className={`menuButton ${menuSelection === 1 && isKeyboardMode ? "selected" : ""}`} onClick={startMockTest}>Test nanečisto ⏱️</button>
          <button ref={el => menuButtonsRef.current[2] = el} className={`menuButton ${menuSelection === 2 && isKeyboardMode ? "selected" : ""}`} onClick={startTrainingMode}>Tréninkový režim 🏋️</button>
          <button ref={el => menuButtonsRef.current[3] = el} className={`menuButton ${menuSelection === 3 && isKeyboardMode ? "selected" : ""}`} onClick={startReviewMode}>Prohlížení otázek 📚</button>
        </div>
        <div style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6" }}>
          Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />Mezerník – potvrzení • Enter – potvrzení / další • Esc – zrušit
        </div>
      </div>
    );
  }

  if (mode === "review") {
    const normalizedSearch = removeAccents(searchTerm);
    const filteredQuestions = questionSet.filter(q => {
        const normQ = removeAccents(q.question); const normNum = String(q.number); const normOptions = q.options.map(opt => removeAccents(opt));
        return normQ.includes(normalizedSearch) || normNum.includes(normalizedSearch) || normOptions.some(opt => opt.includes(normalizedSearch));
    });
    const highlightRegex = getSmartRegex(searchTerm);

    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
        <div className="topBarRight">
            <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <SubjectBadge subject={subject} />
                <ThemeToggle theme={theme} toggle={toggleTheme} />
            </div>
        </div>
        <h1 className="title">Prohlížení otázek</h1>
        <input type="text" placeholder="Hledat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="reviewSearchInput" />
        <div className="reviewGrid">
          {filteredQuestions.map((q) => {
            const imageUrl = getImageUrl(subject, q.number); 
            return (
              <div key={q.number} className="reviewCard">
                <div className="reviewHeader"><strong>#{q.number}.</strong> <HighlightedText text={q.question} highlightRegex={highlightRegex} /></div>
                {imageUrl && <img src={imageUrl} alt="" className="reviewImage" onClick={() => window.open(imageUrl, "_blank")} />}
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {q.options.map((opt, idx) => (
                        <div key={idx} style={{ fontSize: '0.9rem', color: idx === q.correctIndex ? 'var(--color-review-correct)' : 'var(--color-text-secondary)', fontWeight: idx === q.correctIndex ? 'bold' : 'normal', display: 'flex', gap: '0.5rem' }}>
                            <span>{idx === q.correctIndex ? '✅' : '•'}</span><span><HighlightedText text={opt} highlightRegex={highlightRegex} /></span>
                        </div>
                    ))}
                </div>
              </div>
            );
          })}
          {filteredQuestions.length === 0 && <p style={{textAlign: 'center', color: 'var(--color-text-secondary)', gridColumn: '1/-1', marginTop: '2rem'}}>Žádné otázky nenalezeny.</p>}
        </div>
      </div>
    );
  }

  const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

  return (
    <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
      {showConfirmSubmit && <ConfirmModal title={mode === "training" ? "Ukončit trénink?" : "Odevzdat test?"} message="Jste si jisti, že chcete předčasně odevzdat?" onCancel={cancelSubmit} onConfirm={submitTest} confirmText={mode === "training" ? "Vyhodnotit" : "Odevzdat"} />}
      {showConfirmExit && <ConfirmModal title="Ukončit režim?" message="Opravdu ukončit?" onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Opravdu ukončit" />}

      {finished && (
        <ResultScreen mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={resetToMenu} currentSubject={subject} timeLeftAtSubmit={timeLeftAtSubmit} />
      )}

      {!finished && (
        <>
          <div className="stickyHeader">
            <div className="topBarRight">
              <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <SubjectBadge subject={subject} />
                  <ThemeToggle theme={theme} toggle={toggleTheme} />
              </div>
              <div className="topControls">
                {mode === "mock" && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
                {mode === "training" && <div className="timer" style={{ color: "#a3a3a3" }}>{formatTime(trainingTime)}</div>}
                {(mode === "mock" || mode === "training") && <button className="submitTopButton" onClick={confirmSubmit}>{mode === "training" ? "Vyhodnotit" : "Odevzdat"}</button>}
              </div>
            </div>

            {/* ZDE JE VÁŠ PROGRESS BAR - Vrácený do hlavičky */}
            <div className="quizContentWrapper" style={{ paddingBottom: 0 }}>
              <h1 className="title">{mode === "random" ? "Flashcards" : mode === "mock" ? "Test nanečisto" : "Tréninkový režim"}</h1>
              <div className="progress">
                {mode === "random"
                  ? `Pokusy: ${score.total} | Správně: ${score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0} %`
                  : `Otázka ${currentIndex + 1} / ${mode === "training" ? maxSeenIndex + 1 : questionSet.length}`}
              </div>
            </div>
          </div>

          <div className="quizContentWrapper">
            <div className="card" ref={cardRef}>
              <QuestionCard currentQuestion={currentQuestion} mode={mode} showResult={showResult} selectedAnswer={selectedAnswer} onSelect={(i) => mode === "random" ? clickRandomAnswer(i) : handleAnswer(i)} optionRefsForCurrent={optionRefsForCurrent} disabled={mode === "random" && showResult} isKeyboardMode={isKeyboardMode} currentSubject={subject} />

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
  );
}
