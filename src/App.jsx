import React, { useState, useEffect, useRef } from "react";
import { QUESTIONS } from "./questions";
import { QUESTIONS_SPS } from "./questionsSPS.js";
import { QUESTIONS_STT } from "./questionsSTT.js";
// Ujistěte se, že cesta odpovídá vaší struktuře
import { SubjectSelector } from "./components/SubjectSelector.jsx";

// Načtení obrázků (vite)
const images = import.meta.glob("./images/*.png", { eager: true, as: "url" });
const IMAGES = {};
for (const path in images) {
  const fileName = path.match(/\/(\d+)\.png$/)?.[1];
  if (fileName) IMAGES[fileName] = images[path];
}

/* ---------- Small components ---------- */

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

function ResultScreen({ mode, score, trainingTime, questionSet, maxSeenIndex, onBack }) {
  const list = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
  return (
    <div className="resultScreen fadeIn">
      <h2>{mode === "mock" ? "Test dokončen!" : "Vyhodnocení tréninku"}</h2>
      <p className="bigScore">{score.correct} / {score.total}</p>
      <p className="bigPercent">{score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100)} % správně</p>
      {mode === "training" && <p className="timeSpent">Čas: {formatTime(trainingTime)}</p>}

      <div className="reviewList">
        {list.map((q, i) => (
          <div key={i} className={`reviewQuestion ${q.userAnswer === q.correctIndex ? "correct" : q.userAnswer !== undefined ? "wrong" : "unanswered"}`}>
            <strong>{i + 1}. {q.question}</strong>
            {IMAGES[q.number] && <img src={IMAGES[q.number]} alt="" className="questionImage small" onClick={() => window.open(IMAGES[q.number], "_blank")} />}
            <div><strong>Správná odpověď:</strong> {q.options[q.correctIndex]}</div>
            {q.userAnswer !== undefined && (
              <div><strong>Tvá odpověď:</strong> {q.options[q.userAnswer]} {q.userAnswer === q.correctIndex ? "(správně)" : "(špatně)"}</div>
            )}
          </div>
        ))}
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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

function QuestionCard({ currentQuestion, mode, showResult, selectedAnswer, onSelect, optionRefsForCurrent, disabled, isKeyboardMode }) {
  if (!currentQuestion || !currentQuestion.options) {
    return <div>Načítání otázky...</div>;
  }

  return (
    <div>
      <div className="questionHeader">
        <h2 className="questionText">
          {mode === "random" && `#${currentQuestion.number} `}
          {currentQuestion.question}
        </h2>
        {IMAGES[currentQuestion.number] && (
          <div className="imageWrapper">
            <img src={IMAGES[currentQuestion.number]} alt="Otázka" className="questionImage" onClick={() => window.open(IMAGES[currentQuestion.number], "_blank")} />
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
          } 
          else if (mode === "random" && !showResult) {
             // Random mód - zvýraznění kurzorem jen pokud je aktivní klávesnice
             if (selectedAnswer === i && isKeyboardMode) {
               style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa", outline: "2px solid #60a5fa" };
             }
          } 
          else if ((mode === "mock" || mode === "training")) {
             // Mock/Training - zobrazení odpovědi, kterou uživatel vybral
             // Pro navigaci (kurzor) by zde taky mohlo být isKeyboardMode, 
             // ale v těchto módech se odpověď hned označí, takže to necháme takto.
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
              onClick={() => {
                if (!disabled) onSelect(i);
              }}
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

/* ---------- Utilities ---------- */

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ---------- Main App ---------- */

export default function App() {
  const [subject, setSubject] = useState(null); 
  const [customQuestions, setCustomQuestions] = useState(null); 
  const [activeQuestionsCache, setActiveQuestionsCache] = useState(null); 
  const [menuSelection, setMenuSelection] = useState(0); 
  const menuButtonsRef = useRef([]);

  const [mode, setMode] = useState(null); 
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
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  const optionRefsForCurrent = useRef({});
  const scrollRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    QUESTIONS.forEach((q, i) => { q._localIndex = i; });
    QUESTIONS_SPS.forEach((q, i) => { q._localIndex = i; });
    QUESTIONS_STT.forEach((q, i) => { q._localIndex = i; });
  }, []);

  useEffect(() => {
    const getActive = () => {
      let base = [];
      if (subject === "SPS") base = QUESTIONS_SPS;
      else if (subject === "STT") base = QUESTIONS_STT;
      else if (subject === "DEFAULT" || subject === "QUESTIONS") base = QUESTIONS;
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

  // --- GLOBAL MOUSE & KEYBOARD DETECTION ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Ignorovat, pokud se myš nepohnula (některé prohlížeče střílí event při kliku)
      if (Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0) {
        if (isKeyboardMode) {
          setIsKeyboardMode(false);
          if (mode === "random" && !showResult) {
            setSelectedAnswer(null);
          }
        }
      }
    };

    const handleKeyDown = () => {
      if (!isKeyboardMode) {
        setIsKeyboardMode(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isKeyboardMode, mode, showResult]);

  useEffect(() => {
    if (mode !== "training") return;
    if (currentIndex > maxSeenIndex) {
      setMaxSeenIndex(currentIndex);
    }
  }, [currentIndex, mode]);

  useEffect(() => {
    if ((mode !== "mock" && mode !== "random") || !cardRef.current) return;
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [currentIndex, mode]);

  // Auto scroll answer
  useEffect(() => {
    if (mode !== "random" || selectedAnswer === null || !isKeyboardMode) return;

    const refs = optionRefsForCurrent.current?.[questionSet[currentIndex]?._localIndex] || [];
    const selectedBtn = refs[selectedAnswer];

    if (selectedBtn && cardRef.current) {
      setTimeout(() => {
        const btnRect = selectedBtn.getBoundingClientRect();
        const headerOffset = 150; 

        if (btnRect.bottom > window.innerHeight) {
          selectedBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        else if (btnRect.top < headerOffset) {
           const scrollAmount = window.scrollY + btnRect.top - headerOffset - 20;
           window.scrollTo({ top: scrollAmount, behavior: "smooth" });
        }
        selectedBtn.focus({ preventScroll: true }); 
      }, 50);
    }
  }, [selectedAnswer, currentIndex, mode, questionSet, isKeyboardMode]);

  useEffect(() => {
    if (mode !== "training" || finished) return;
    const t = setInterval(() => setTrainingTime((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  useEffect(() => {
    if (mode !== "mock" || finished) return;
    const t = setInterval(() => {
      setTimeLeft((x) => {
        if (x <= 1) return 0;
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  useEffect(() => {
    if (mode === "mock" && timeLeft === 0 && !finished) {
      submitTest();
    }
  }, [mode, timeLeft, finished]);

  /* ---------- Keyboard Handling ---------- */
  useEffect(() => {
    if (!mode || mode === "review") return;

    const onKey = (e) => {
      const curQ = questionSet[currentIndex] || { options: [] };
      const opts = curQ.options.length;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
         e.preventDefault();
      }

      // --- UP / W ---
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        if (mode === "random" && !showResult) {
          const newIdx = selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts;
          selectRandomAnswer(newIdx);
        } else if (mode !== "random") {
          const newIdx = curQ.userAnswer === undefined ? opts - 1 : (curQ.userAnswer - 1 + opts) % opts;
          handleAnswer(newIdx);
        }
      }

      // --- DOWN / S ---
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        if (mode === "random" && !showResult) {
          const newIdx = selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts;
          selectRandomAnswer(newIdx);
        } else if (mode !== "random") {
          const newIdx = curQ.userAnswer === undefined ? 0 : (curQ.userAnswer + 1) % opts;
          handleAnswer(newIdx);
        }
      }

      // --- LEFT / A ---
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else {
          const newIdx = Math.max(0, currentIndex - 1);
          moveToQuestion(newIdx);
        }
      }

      // --- RIGHT / D / ENTER ---
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight" || e.key === "Enter") {
        if (mode === "random" && showResult) {
          nextRandomQuestion();
        } 
        else if (mode === "random" && !showResult) {
          if (selectedAnswer !== null) confirmRandomAnswer();
        } 
        else {
          // Mock / Training / Review - go to next
          const newIdx = currentIndex + 1;
          moveToQuestion(newIdx);
        }
      }

      // --- SPACE ---
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
        if (fullscreenImage) setFullscreenImage(null);
        else if (showConfirmSubmit) setShowConfirmSubmit(false);
        else if (showConfirmExit) setShowConfirmExit(false);
        else if (mode === "random" && showResult) clearAnswer();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, questionSet, currentIndex, showResult, showConfirmSubmit, showConfirmExit, fullscreenImage, maxSeenIndex, finished, selectedAnswer, isKeyboardMode]);

  /* ---------- Mode logic ---------- */

  const prepareQuestionSet = (baseQuestions) => {
    return baseQuestions.map((q, idx) => ({ ...q, options: [...(q.options || [])], userAnswer: undefined, _localIndex: idx }));
  };

  const startRandomMode = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(shuffled);
    setMode("random");
    setCurrentIndex(0);
    setScore({ correct: 0, total: 0 });
    setFinished(false);
    setSelectedAnswer(null);
    setShowResult(false);
    optionRefsForCurrent.current = {};
    setIsKeyboardMode(false);
  };

  const startMockTest = () => {
    const pool = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length)).map((q, idx) => ({ ...q, _localIndex: idx }));
    setQuestionSet(sel);
    setTimeLeft(1800);
    setMode("mock");
    setCurrentIndex(0);
    setMaxSeenIndex(0);
    setFinished(false);
    optionRefsForCurrent.current = {};
    setIsKeyboardMode(false);
  };

  const startTrainingMode = () => {
    const all = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    setQuestionSet(all);
    setMode("training");
    setCurrentIndex(0);
    setMaxSeenIndex(0);
    setTrainingTime(0);
    setFinished(false);
    optionRefsForCurrent.current = {};
    setIsKeyboardMode(false);
  };

  const startReviewMode = () => {
    const all = activeQuestionsCache || prepareQuestionSet(QUESTIONS_SPS);
    setQuestionSet(all);
    setMode("review");
  };

  const selectRandomAnswer = (idx) => {
    if (finished || mode !== "random" || showResult) return;
    setSelectedAnswer(idx);
    setIsKeyboardMode(true);
  };

  const clickRandomAnswer = (idx) => {
    if (finished || mode !== "random" || showResult) return;
    const currentQ = questionSet[currentIndex];
    if (!currentQ) return;
    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = idx;
      copy[currentIndex] = q;
      return copy;
    });
    setSelectedAnswer(idx);
    setShowResult(true);
    setScore((s) => {
      let correct = s.correct;
      let total = s.total;
      if (idx === currentQ.correctIndex) correct += 1;
      total += 1;
      return { correct, total };
    });
  };

  const confirmRandomAnswer = () => {
    if (finished || mode !== "random") return;
    const currentQ = questionSet[currentIndex];
    if (!currentQ) return;
    const answerToSave = selectedAnswer !== null ? selectedAnswer : -1;
    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = answerToSave;
      copy[currentIndex] = q;
      return copy;
    });
    setShowResult(true);
    if (selectedAnswer !== null) {
      setScore((s) => {
        let correct = s.correct;
        let total = s.total;
        if (selectedAnswer === currentQ.correctIndex) correct += 1;
        total += 1;
        return { correct, total };
      });
    } else {
      setSelectedAnswer(-1);
    }
  };

  const handleAnswer = (idx) => {
    if (finished || mode === "review") return;
    setIsKeyboardMode(true);
    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = idx;
      copy[currentIndex] = q;
      return copy;
    });
  };

  const clearAnswer = () => {
    setQuestionSet((prev) => {
      const copy = [...prev];
      if (!copy[currentIndex]) return prev;
      copy[currentIndex] = { ...copy[currentIndex], userAnswer: undefined };
      return copy;
    });
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const moveToQuestion = (newIdx) => {
    const maxQuestion = questionSet.length - 1;
    const boundedIdx = Math.max(0, Math.min(newIdx, maxQuestion));
    if (mode === "training" && boundedIdx > maxSeenIndex && boundedIdx > currentIndex) {
      setMaxSeenIndex(boundedIdx);
    }
    setCurrentIndex(boundedIdx);
    if (mode === "random") {
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const nextRandomQuestion = () => {
    if (!questionSet.length) return;
    let nextIdx;
    let attempts = 0;
    do {
      nextIdx = Math.floor(Math.random() * questionSet.length);
      attempts++;
    } while (nextIdx === currentIndex && questionSet.length > 1 && attempts < 10);

    setCurrentIndex(nextIdx);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const confirmSubmit = () => setShowConfirmSubmit(true);
  const cancelSubmit = () => setShowConfirmSubmit(false);

  const submitTest = () => {
    const questionsToEval = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
    const correct = questionsToEval.filter((q) => q.userAnswer === q.correctIndex).length;
    setScore({ correct, total: questionsToEval.length });
    setFinished(true);
    setShowConfirmSubmit(false);
  };

  const tryReturnToMenu = () => {
    if ((mode === "mock" || mode === "training") && !finished) setShowConfirmExit(true);
    else resetToMenu();
  };

  const confirmExit = () => { resetToMenu(); setShowConfirmExit(false); };

  const resetToMenu = () => {
    setMode(null);
    setQuestionSet([]);
    setCurrentIndex(0);
    setFinished(false);
    setFullscreenImage(null);
    optionRefsForCurrent.current = {};
    setScore({ correct: 0, total: 0 });
    setShowResult(false);
    setSelectedAnswer(null);
    setMaxSeenIndex(0);
    setIsKeyboardMode(false);
  };

  const parseCSV = (csvText) => {
    // Basic CSV parser placeholder logic
    // Replace with real parsing logic
    const lines = csvText.trim().split('\n');
    return lines.map((l, i) => ({ number: i, question: l, options: ["A", "B"], correctIndex: 0 }));
  };

  const handleFileUpload = async (questions) => {
    if (!questions || !Array.isArray(questions)) return;
    const normalized = questions.map((q, idx) => {
      if (!q.options || !Array.isArray(q.options)) q.options = [];
      return {
        number: q.number ?? idx + 1,
        question: q.question ?? `Otázka ${idx + 1}`,
        options: q.options,
        correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
      };
    });
    setCustomQuestions(normalized);
    setSubject("CUSTOM");
  };

  // --- MENU KEYBOARD NAVIGATION ---
  useEffect(() => {
    if (mode) return;

    const handleMenuNav = (e) => {
      const key = e.key.toLowerCase();

      if (key === "w" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsKeyboardMode(true);
        if (!subject) setMenuSelection((prev) => (prev - 1 + 3) % 3);
        else setMenuSelection((prev) => (prev - 1 + 4) % 4);
      } else if (key === "s" || e.key === "ArrowDown") {
        e.preventDefault();
        setIsKeyboardMode(true);
        if (!subject) setMenuSelection((prev) => (prev + 1) % 3);
        else setMenuSelection((prev) => (prev + 1) % 4);
      } else if (key === "d" || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        setIsKeyboardMode(true);

        // Handling Enter/Right Arrow
        if (!subject) {
          if (menuSelection === 0) setSubject("SPS");
          else if (menuSelection === 1) setSubject("STT");
          else if (menuSelection === 2) {
             // Pokud máme input ve SubjectSelectoru, musíme ho odpálit tam
             // nebo přes document query, ale zde je selector unmounted,
             // takže to řeší button click v SubjectSelectoru.
             // Pro klávesnici zde můžeme zkusit najít input:
             const fileInput = document.querySelector("input[type='file']");
             fileInput?.click();
          }
        } else {
          if (menuSelection === 0) startRandomMode();
          else if (menuSelection === 1) startMockTest();
          else if (menuSelection === 2) startTrainingMode();
          else if (menuSelection === 3) startReviewMode();
        }
      } else if (key === "a" || e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        if (subject) setSubject(null);
      }
    };

    window.addEventListener("keydown", handleMenuNav);
    return () => window.removeEventListener("keydown", handleMenuNav);
  }, [mode, subject, menuSelection]);

  useEffect(() => {
    if (!mode && menuButtonsRef.current && menuButtonsRef.current[menuSelection]) {
      setTimeout(() => {
        menuButtonsRef.current[menuSelection]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [menuSelection, mode]);

  /* ---------- Render ---------- */

  if (!mode) {
    if (!subject) {
      return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <SubjectSelector 
            menuSelection={menuSelection}
            onSelectSubject={(subj) => setSubject(subj.toUpperCase())} 
            onUploadFile={handleFileUpload} 
            isKeyboardMode={isKeyboardMode} // NOVÉ
          />
        </div>
      );
    }

    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <h1 className="title">Trénink uzavřených otázek</h1>
        <div className="menuColumn">
          <button ref={(el) => menuButtonsRef.current[0] = el} className={`menuButton ${menuSelection === 0 && isKeyboardMode ? "selected" : ""}`} onClick={startRandomMode}>Flashcards</button>
          <button ref={(el) => menuButtonsRef.current[1] = el} className={`menuButton ${menuSelection === 1 && isKeyboardMode ? "selected" : ""}`} onClick={startMockTest}>Test nanečisto (40 otázek, 30 min)</button>
          <button ref={(el) => menuButtonsRef.current[2] = el} className={`menuButton ${menuSelection === 2 && isKeyboardMode ? "selected" : ""}`} onClick={startTrainingMode}>Tréninkový režim</button>
          <button ref={(el) => menuButtonsRef.current[3] = el} className={`menuButton ${menuSelection === 3 && isKeyboardMode ? "selected" : ""}`} onClick={startReviewMode}>Prohlížení otázek</button>
        </div>
        <button className="menuBackButton" onClick={() => setSubject(null)} style={{ marginTop: "2rem" }}>Změnit předmět</button>

        <div style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6" }}>
          Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />
          Mezerník – potvrzení • Enter – potvrzení / další • Esc – zrušit
        </div>
      </div>
    );
  }

  // Zbytek renderu... (Review a Quiz)
  if (mode === "review") {
    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
        <h1 className="title">Prohlížení otázek ({subject === "CUSTOM" ? "Vlastní" : subject})</h1>
        <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
        <div className="reviewGrid">
          {questionSet.map((q) => (
            <div key={q.number} className="reviewCard">
              <div className="reviewHeader"><strong>#{q.number}.</strong> {q.question}</div>
              {IMAGES[q.number] && <img src={IMAGES[q.number]} alt="" className="reviewImage" onClick={() => window.open(IMAGES[q.number], "_blank")} />}
              <div className="reviewAnswer"><strong>Správná:</strong> <span className="correctText">{q.options[q.correctIndex]}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

  return (
    <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
      <div className="stickyHeader">
        <div className="topBarRight">
          <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
          <div className="topControls">
            {mode === "mock" && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
            {mode === "training" && !finished && <div className="timer" style={{ color: "#a3a3a3" }}>{formatTime(trainingTime)}</div>}
            {(mode === "mock" || mode === "training") && !finished && <button className="submitTopButton" onClick={confirmSubmit}>{mode === "training" ? "Vyhodnotit" : "Odevzdat"}</button>}
          </div>
        </div>

        <h1 className="title">{mode === "random" ? "Flashcards" : mode === "mock" ? "Test nanečisto" : "Tréninkový režim"}</h1>

        <div className="progress">
          {mode === "random"
            ? `Zodpovězeno: ${questionSet.filter(q => q.userAnswer !== undefined).length} | Správně: ${score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0} %`
            : `Otázka ${currentIndex + 1} / ${mode === "training" ? maxSeenIndex + 1 : questionSet.length}`}
        </div>
      </div>

      <div className="card" ref={cardRef}>
        {!finished ? (
          <>
            <QuestionCard 
              currentQuestion={currentQuestion} 
              mode={mode} 
              showResult={showResult} 
              selectedAnswer={selectedAnswer} 
              onSelect={(i) => mode === "random" ? clickRandomAnswer(i) : handleAnswer(i)} 
              optionRefsForCurrent={optionRefsForCurrent} 
              disabled={mode === "random" && showResult}
              isKeyboardMode={isKeyboardMode}
            />

            {mode === "random" && !showResult && (
              <div className="actionButtons right">
                <button className="navButton primary" onClick={confirmRandomAnswer}>Potvrdit</button>
              </div>
            )}

            {mode === "random" && showResult && (
              <div className="actionButtons right">
                <button className="navButton" onClick={nextRandomQuestion}>Další otázka</button>
              </div>
            )}

            {(mode === "mock" || mode === "training") && (
              <>
                <div className="actionButtons spaced">
                  <button className="navButton" onClick={() => {
                    const newIdx = Math.max(0, currentIndex - 1);
                    moveToQuestion(newIdx);
                  }} disabled={currentIndex === 0}>Předchozí</button>
                  <button className="navButton" onClick={() => {
                    const newIdx = currentIndex + 1;
                    moveToQuestion(newIdx);
                  }} disabled={currentIndex === questionSet.length - 1}>Další</button>
                </div>

                <div className="navigatorWrapper" ref={scrollRef}>
                  <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={moveToQuestion} mode={mode} maxSeenIndex={maxSeenIndex} />
                </div>
              </>
            )}
          </>
        ) : (
          <ResultScreen mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={resetToMenu} />
        )}
      </div>

      {fullscreenImage && (
        <div className="fullscreenOverlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Fullscreen" className="fullscreenImage" />
          <button className="closeFullscreen" onClick={() => setFullscreenImage(null)}>×</button>
        </div>
      )}

      {showConfirmSubmit && (
        <ConfirmModal title={`Opravdu chceš ${mode === "mock" ? "odevzdat test" : "vyhodnotit otázky"}?`} message={`Tato akce je nevratná.`} onCancel={cancelSubmit} onConfirm={submitTest} />
      )}

      {showConfirmExit && (
        <ConfirmModal title={`Opravdu chceš opustit test?`} message={`Všechen pokrok bude ztracen.`} onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Opustit" cancelText="Zůstat" />
      )}
    </div>
  );
}
