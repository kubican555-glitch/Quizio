import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { QuestionCard } from './QuestionCard';
import { Navigator } from './Navigator';
import { ConfirmModal } from './Modals';
import { CustomImageModal } from './CustomImageModal';
import { SubjectBadge } from './SubjectBadge';
import { UserBadgeDisplay } from './UserBadgeDisplay';
import { ThemeToggle } from './ThemeToggle';
import { formatTime } from '../utils/formatting';
import { ResultScreen } from './ResultScreen'; 

export function RealTestMode({ 
    test, 
    initialQuestions, 
    user, 
    userId, 
    onExit, 
    onFinish,
    theme,
    toggleTheme,
    syncing,
    onReport,
    onTestCompleted
}) {
    // --- STATE ---
    const [questionSet, setQuestionSet] = useState(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(test.time_limit * 60);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [direction, setDirection] = useState('right');
    const [finalResult, setFinalResult] = useState(null);

    // Refs
    const cardRef = useRef(null);
    const optionRefsForCurrent = useRef({});

    const currentQuestion = questionSet[currentIndex];
    const selectedAnswer = currentQuestion?.userAnswer !== undefined ? currentQuestion.userAnswer : null;

    // --- ČASOVAČ ---
    useEffect(() => {
        if (finalResult) return; 
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    submitTest(true); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [finalResult]);

    // --- LOGIKA ---
    const handleAnswer = (answerIndex) => {
        if (finalResult) return;
        setQuestionSet(prev => {
            const newSet = [...prev];
            newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: answerIndex };
            return newSet;
        });
    };

    const moveToQuestion = (index) => {
        if (index < 0 || index >= questionSet.length) return;
        setDirection(index < currentIndex ? 'left' : 'right');
        setCurrentIndex(index);
    };

    const submitTest = async (force = false) => {
        if (isSubmitting || finalResult) return;
        setIsSubmitting(true);
        setShowConfirmSubmit(false);

        const correctCount = questionSet.filter(q => q.userAnswer === q.correctIndex).length;
        const totalCount = questionSet.length;
        const answersToSave = questionSet.map(q => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex
        }));

        try {
            await supabase.from('test_results').insert([{
                test_id: test.id,
                student_name: user,
                user_id: userId,
                score_correct: correctCount,
                score_total: totalCount,
                answers: answersToSave,
                time_spent: (test.time_limit * 60) - timeLeft,
                cheat_score: 0 
            }]);

            if (onTestCompleted) onTestCompleted(test.id);

            setFinalResult({
                score: { correct: correctCount, total: totalCount },
                timeSpent: (test.time_limit * 60) - timeLeft,
                timeLeft: timeLeft
            });

            if (force) alert("Čas vypršel! Test byl automaticky odeslán.");

        } catch (error) {
            console.error("Chyba při ukládání:", error);
            alert("Chyba při ukládání výsledků. Zkuste to prosím znovu.");
            setIsSubmitting(false);
        }
    };

    // --- KLÁVESNICE ---
    useEffect(() => {
        if (finalResult) return;
        const handleKeyDown = (e) => {
            if (showConfirmSubmit || isSubmitting) return;
            const optsCount = currentQuestion?.options?.length || 4;

            switch(e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    if (selectedAnswer === null) handleAnswer(optsCount - 1);
                    else handleAnswer((selectedAnswer - 1 + optsCount) % optsCount);
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    if (selectedAnswer === null) handleAnswer(0);
                    else handleAnswer((selectedAnswer + 1) % optsCount);
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    moveToQuestion(currentIndex - 1);
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                case "Enter":
                    moveToQuestion(currentIndex + 1);
                    break;
                case " ": 
                    setShowConfirmSubmit(true);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, selectedAnswer, showConfirmSubmit, isSubmitting, currentQuestion, finalResult]);


    const handleSwipe = (dir) => {
        if (finalResult || showConfirmSubmit || isSubmitting) return;
        
        if (dir === "left") {
            moveToQuestion(currentIndex + 1);
        } else if (dir === "right") {
            moveToQuestion(currentIndex - 1);
        }
    };

    // --- RENDER ---
    if (finalResult) {
        return (
            <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
                <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />
                <ResultScreen 
                    mode="real_test"
                    score={finalResult.score}
                    trainingTime={0} 
                    timeLeftAtSubmit={finalResult.timeLeft} 
                    questionSet={questionSet}
                    maxSeenIndex={questionSet.length}
                    onBack={onExit} 
                    currentSubject={test.subject}
                    onZoom={setFullscreenImage}
                    user={user}
                    syncing={syncing}
                    onReport={onReport}
                />
            </div>
        );
    }

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />

            {showConfirmSubmit && (
                <ConfirmModal 
                    title="Odevzdat test?" 
                    message="Opravdu chcete test ukončit a odevzdat? Tuto akci nelze vrátit."
                    onCancel={() => setShowConfirmSubmit(false)} 
                    onConfirm={() => submitTest(false)} 
                    confirmText="ODEVZDAT" 
                    danger={true} 
                />
            )}

            <div className="top-navbar">
                <div className="navbar-group">
                    <span style={{fontWeight:'bold', color:'var(--color-primary)', display:'flex', alignItems:'center', gap:'0.5rem', fontSize: '0.9rem'}}>
                        📝 TEST PROBÍHÁ
                    </span>
                    <div className="mobile-hidden">
                        <SubjectBadge subject={test.subject} compact />
                    </div>
                </div>
                <div className="navbar-group">
                    <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile={true} />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>

            <div className="quizContentWrapper">
                <h1 className="title">{test.title}</h1>
                <div className="progressBarContainer">
                    <div className="progressBarFill" style={{ width: `${((currentIndex + 1) / questionSet.length) * 100}%` }}></div>
                </div>
                <div className="progressText">Otázka {currentIndex + 1} / {questionSet.length}</div>

                <div className="card" ref={cardRef}>
                    <div key={currentIndex} className={direction === 'left' ? "slide-in-left" : "slide-in-right"} style={{width: '100%'}}>
                        <QuestionCard
                            currentQuestion={currentQuestion}
                            mode="mock" 
                            showResult={false}
                            selectedAnswer={selectedAnswer}
                            onSelect={handleAnswer}
                            optionRefsForCurrent={optionRefsForCurrent}
                            disabled={false}
                            isKeyboardMode={true}
                            currentSubject={test.subject}
                            onZoom={setFullscreenImage}
                            onSwipe={handleSwipe}
                            score={{correct:0, total:0}}
                        />
                    </div>

                    <div className="actionButtons spaced">
                        <button 
                            className="navButton" 
                            onClick={() => moveToQuestion(currentIndex - 1)} 
                            disabled={currentIndex === 0}
                        >
                            Předchozí
                        </button>

                        {currentIndex < questionSet.length - 1 ? (
                            <button 
                                className="navButton" 
                                onClick={() => moveToQuestion(currentIndex + 1)}
                            >
                                Další
                            </button>
                        ) : (
                            <button 
                                className="navButton primary" 
                                onClick={() => setShowConfirmSubmit(true)}
                            >
                                Odevzdat test
                            </button>
                        )}
                    </div>

                    <div className="navigatorPlaceholder">
                        <Navigator 
                            questionSet={questionSet} 
                            currentIndex={currentIndex} 
                            setCurrentIndex={moveToQuestion} 
                            mode="real_test" 
                            maxSeenIndex={questionSet.length}
                        />
                        <div style={{ marginTop: "2rem", width: "100%", display: "flex", justifyContent: "center" }}>
                            <button 
                                className="navButton primary" 
                                style={{ padding: "10px 30px", fontSize: "0.95rem", minWidth: "150px" }} 
                                onClick={() => setShowConfirmSubmit(true)}
                            >
                                Odevzdat test
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* HiddenPreloader byl odstraněn, protože u Base64 obrázků v DB již není potřeba */}
            <div className="footer"></div>
        </div>
    );
}