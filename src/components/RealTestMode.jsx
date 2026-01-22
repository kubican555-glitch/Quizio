import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { QuestionCard } from "./QuestionCard";
import { Navigator } from "./Navigator";
import { ConfirmModal } from "./Modals";
import { CustomImageModal } from "./CustomImageModal";
import { SubjectBadge } from "./SubjectBadge";
import { UserBadgeDisplay } from "./UserBadgeDisplay";
import { ThemeToggle } from "./ThemeToggle";
import { formatTime } from "../utils/formatting";
import { ResultScreen } from "./ResultScreen";

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
    onTestCompleted,
}) {
    // ID řádku v databázi
    const [resultRowId, setResultRowId] = useState(null);
    const sessionStartedRef = useRef(false);

    // --- VÝPOČET ZÁKLADNÍHO LIMITU ---
    const getNominalDuration = () => test.time_limit * 60;

    const [questionSet, setQuestionSet] = useState(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [readyQuestionId, setReadyQuestionId] = useState(null);

    // Defaultně nastavíme plný čas, ale useEffect níže ho může zkrátit pokud jde o resume
    const [timeLeft, setTimeLeft] = useState(getNominalDuration());

    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [direction, setDirection] = useState("right");
    const [finalResult, setFinalResult] = useState(null);
    const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);

    const cardRef = useRef(null);
    const optionRefsForCurrent = useRef({});
    const questionSetRef = useRef(questionSet);
    const timeLeftRef = useRef(timeLeft);
    const testStartTimeRef = useRef(Date.now());

    const testDurationMs = test.time_limit * 60 * 1000;

    // --- 1. SMART START SESSION (RESUME & RESTORE ANSWERS) ---
    useEffect(() => {
        const startSession = async () => {
            if (sessionStartedRef.current) return;
            sessionStartedRef.current = true;

            try {
                // Hledáme existující 'running' session
                // DŮLEŽITÉ: Načítáme i sloupec 'answers', abychom je mohli obnovit
                const { data: existingData } = await supabase
                    .from("test_results")
                    .select("id, created_at, answers")
                    .eq("test_id", test.id)
                    .eq("user_id", userId)
                    .eq("status", "running")
                    .maybeSingle();

                if (existingData) {
                    console.log(
                        "🔄 Návrat do rozpracovaného testu:",
                        existingData.id,
                    );
                    setResultRowId(existingData.id);

                    // --- A) OBNOVENÍ ODPOVĚDÍ ---
                    if (
                        existingData.answers &&
                        Array.isArray(existingData.answers)
                    ) {
                        setQuestionSet((prevSet) => {
                            return prevSet.map((q) => {
                                // Najdeme, zda pro tuto otázku existuje uložená odpověď
                                // Hledáme podle čísla otázky (qNum)
                                const savedAnswer = existingData.answers.find(
                                    (a) => a.qNum === q.number,
                                );
                                if (savedAnswer) {
                                    return {
                                        ...q,
                                        userAnswer: savedAnswer.user,
                                    };
                                }
                                return q;
                            });
                        });
                    }

                    // --- B) SYNCHRONIZACE ČASU ---
                    const dbStartTime = new Date(
                        existingData.created_at,
                    ).getTime();
                    testStartTimeRef.current = dbStartTime;

                    const now = Date.now();
                    const elapsedSeconds = Math.floor(
                        (now - dbStartTime) / 1000,
                    );
                    const totalLimitSeconds = getNominalDuration();

                    let remaining = totalLimitSeconds - elapsedSeconds;

                    if (test.close_at) {
                        const closeTime = new Date(test.close_at).getTime();
                        const secondsUntilClose = Math.floor(
                            (closeTime - now) / 1000,
                        );
                        remaining = Math.min(remaining, secondsUntilClose);
                    }

                    remaining = Math.max(0, remaining);
                    setTimeLeft(remaining);
                } else {
                    // Nový test
                    console.log("🆕 Zakládám nový test...");
                    const { data, error } = await supabase
                        .from("test_results")
                        .insert([
                            {
                                test_id: test.id,
                                student_name: user,
                                user_id: userId,
                                score_correct: 0,
                                score_total: initialQuestions.length,
                                answers: [],
                                time_spent: 0,
                                cheat_score: 0,
                                status: "running",
                            },
                        ])
                        .select()
                        .single();

                    if (data) {
                        setResultRowId(data.id);
                        testStartTimeRef.current = Date.now();

                        let duration = getNominalDuration();
                        if (test.close_at) {
                            const closeTime = new Date(test.close_at).getTime();
                            const secondsUntilClose = Math.floor(
                                (closeTime - Date.now()) / 1000,
                            );
                            duration = Math.min(
                                duration,
                                Math.max(0, secondsUntilClose),
                            );
                        }
                        setTimeLeft(duration);
                    }
                }
            } catch (err) {
                console.error("Chyba při startu session:", err);
            }
        };

        startSession();
    }, []);

    // Udržování referencí
    useEffect(() => {
        questionSetRef.current = questionSet;
    }, [questionSet]);
    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    const currentQuestion = questionSet[currentIndex];
    const currentQuestionId =
        currentQuestion?.id || currentQuestion?.number || currentIndex;
    const isContentReady =
        readyQuestionId === currentQuestionId || !currentQuestion?.image_base64;
    const selectedAnswer =
        currentQuestion?.userAnswer !== undefined
            ? currentQuestion.userAnswer
            : null;

    useEffect(() => {
        if (!currentQuestion?.image_base64) {
            setReadyQuestionId(currentQuestionId);
        }
    }, [currentQuestionId, currentQuestion?.image_base64]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (readyQuestionId !== currentQuestionId) {
                setReadyQuestionId(currentQuestionId);
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentQuestionId, readyQuestionId]);

    useEffect(() => {
        window.currentTestIndex = currentIndex;
        window.totalTestQuestions = questionSet.length;
        return () => {
            window.currentTestIndex = undefined;
            window.totalTestQuestions = undefined;
        };
    }, [currentIndex, questionSet.length]);

    // --- FUNKCE PRO PRŮBĚŽNÉ UKLÁDÁNÍ (PROGRESS SAVING) ---
    const saveProgressToDb = async (updatedQuestionSet) => {
        if (!resultRowId) return;

        // Vytvoříme pole odpovědí ve formátu pro DB
        const answersToSave = updatedQuestionSet.map((q) => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex,
        }));

        try {
            // Updating pouze 'answers', status necháváme 'running'
            await supabase
                .from("test_results")
                .update({ answers: answersToSave })
                .eq("id", resultRowId);
        } catch (err) {
            console.error("Chyba při průběžném ukládání:", err);
            // Zde nedáváme alert, ať to uživatele neruší při každém kliknutí
        }
    };

    // --- FINALIZACE TESTU ---
    const saveResultsToDb = async (finalData) => {
        try {
            let targetId = resultRowId;
            if (!targetId) {
                const { data } = await supabase
                    .from("test_results")
                    .select("id")
                    .eq("test_id", test.id)
                    .eq("user_id", userId)
                    .eq("status", "running")
                    .maybeSingle();
                if (data) targetId = data.id;
            }

            let error;
            if (targetId) {
                const { error: uErr } = await supabase
                    .from("test_results")
                    .update({
                        score_correct: finalData.score_correct,
                        score_total: finalData.score_total,
                        answers: finalData.answers,
                        time_spent: finalData.time_spent,
                        status: "completed",
                    })
                    .eq("id", targetId);
                error = uErr;
            } else {
                const payload = { ...finalData, status: "completed" };
                const { error: iErr } = await supabase
                    .from("test_results")
                    .insert([payload]);
                error = iErr;
            }
            if (error) alert("Chyba při ukládání: " + error.message);
        } catch (err) {
            console.error(err);
        }
    };

    const executeAutoSubmit = () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setShowConfirmSubmit(false);

        const currentQuestions = questionSetRef.current;
        const correctCount = currentQuestions.filter(
            (q) => q.userAnswer === q.correctIndex,
        ).length;
        const totalCount = currentQuestions.length;
        const answersToSave = currentQuestions.map((q) => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex,
        }));

        const start = testStartTimeRef.current;
        const now = Date.now();
        const timeSpentSeconds = Math.floor((now - start) / 1000);

        setFinalResult({
            score: { correct: correctCount, total: totalCount },
            timeSpent: timeSpentSeconds,
            timeLeft: 0,
        });
        setShowAutoSubmitModal(true);
        setTimeout(() => {
            setShowAutoSubmitModal(false);
        }, 3000);

        saveResultsToDb({
            test_id: test.id,
            student_name: user,
            user_id: userId,
            score_correct: correctCount,
            score_total: totalCount,
            answers: answersToSave,
            time_spent: timeSpentSeconds,
            cheat_score: 0,
        }).then(() => {
            if (onTestCompleted) onTestCompleted(test.id);
            setIsSubmitting(false);
        });
    };

    const handleTimeExpiredRef = useRef(executeAutoSubmit);
    useEffect(() => {
        handleTimeExpiredRef.current = executeAutoSubmit;
    });

    useEffect(() => {
        if (finalResult) return;
        const calculateRemainingTime = () => {
            const elapsed = Date.now() - testStartTimeRef.current;
            const totalLimitMs = test.time_limit * 60 * 1000;
            let remaining = Math.ceil((totalLimitMs - elapsed) / 1000);

            if (test.close_at) {
                const closeTime = new Date(test.close_at).getTime();
                const untilClose = Math.ceil((closeTime - Date.now()) / 1000);
                remaining = Math.min(remaining, untilClose);
            }

            return Math.max(0, remaining);
        };

        const handleVisibilityChange = () => {
            if (
                document.visibilityState === "visible" &&
                !isSubmittingRef.current &&
                !finalResult
            ) {
                const remaining = calculateRemainingTime();
                if (remaining <= 0) handleTimeExpiredRef.current();
                else setTimeLeft(remaining);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        const timer = setInterval(() => {
            const remaining = calculateRemainingTime();
            if (remaining <= 0) {
                clearInterval(timer);
                if (!isSubmittingRef.current) handleTimeExpiredRef.current();
                setTimeLeft(0);
            } else setTimeLeft(remaining);
        }, 1000);
        return () => {
            clearInterval(timer);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [finalResult, test.time_limit, test.close_at]);

    // --- KLIKNUTÍ NA ODPOVĚĎ + PRŮBĚŽNÉ ULOŽENÍ ---
    const handleAnswer = (answerIndex) => {
        if (finalResult) return;

        // 1. Aktualizace lokálního stavu
        setQuestionSet((prev) => {
            const newSet = [...prev];
            newSet[currentIndex] = {
                ...newSet[currentIndex],
                userAnswer: answerIndex,
            };

            // 2. Průběžné uložení do DB (fire and forget - nečekáme na await)
            saveProgressToDb(newSet);

            return newSet;
        });
    };

    const moveToQuestion = (index) => {
        if (index < 0 || index >= questionSet.length) return;
        setReadyQuestionId(null);
        setDirection(index < currentIndex ? "left" : "right");
        setCurrentIndex(index);
    };

    const submitTest = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setShowConfirmSubmit(false);

        const currentQuestions = questionSet;
        const correctCount = currentQuestions.filter(
            (q) => q.userAnswer === q.correctIndex,
        ).length;
        const totalCount = currentQuestions.length;
        const answersToSave = currentQuestions.map((q) => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex,
        }));

        const start = testStartTimeRef.current;
        const now = Date.now();
        const timeSpentSeconds = Math.floor((now - start) / 1000);

        await saveResultsToDb({
            test_id: test.id,
            student_name: user,
            user_id: userId,
            score_correct: correctCount,
            score_total: totalCount,
            answers: answersToSave,
            time_spent: timeSpentSeconds,
            cheat_score: 0,
        });

        if (onTestCompleted) onTestCompleted(test.id);
        setFinalResult({
            score: { correct: correctCount, total: totalCount },
            timeSpent: timeSpentSeconds,
            timeLeft: Math.max(0, timeLeft),
        });
        setIsSubmitting(false);
    };

    useEffect(() => {
        if (finalResult) return;
        const handleKeyDown = (e) => {
            if (showConfirmSubmit || isSubmitting) return;
            const optsCount = currentQuestion?.options?.length || 4;
            switch (e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    if (selectedAnswer === null) handleAnswer(optsCount - 1);
                    else
                        handleAnswer(
                            (selectedAnswer - 1 + optsCount) % optsCount,
                        );
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
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        currentIndex,
        selectedAnswer,
        showConfirmSubmit,
        isSubmitting,
        currentQuestion,
        finalResult,
    ]);

    const handleSwipe = (dir) => {
        if (finalResult || showConfirmSubmit || isSubmitting) return;
        if (dir === "left" && currentIndex < questionSet.length - 1)
            moveToQuestion(currentIndex + 1);
        else if (dir === "right" && currentIndex > 0)
            moveToQuestion(currentIndex - 1);
    };

    const renderContent = () => {
        if (finalResult && !showAutoSubmitModal) {
            return (
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
            );
        }
        return (
            <>
                <div className="top-navbar navbar-tiered">
                    <div className="navbar-group nav-primary">
                        <span
                            style={{
                                fontWeight: "bold",
                                color: "var(--color-primary)",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            📝 TEST PROBÍHÁ
                        </span>
                    </div>
                    <div className="navbar-group nav-status">
                        <SubjectBadge subject={test.subject} compact matchUserBadge />
                        <div
                            className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}
                        >
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                    <div className="navbar-group nav-actions">
                        <UserBadgeDisplay
                            user={user}
                            compactOnMobile={true}
                        />
                        <ThemeToggle
                            currentTheme={theme}
                            toggle={toggleTheme}
                        />
                    </div>
                </div>
                <div className="quizContentWrapper">
                    <h1 className="title">{test.title}</h1>
                    <div className="progressBarContainer">
                        <div
                            className="progressBarFill"
                            style={{
                                width: `${((currentIndex + 1) / questionSet.length) * 100}%`,
                            }}
                        ></div>
                    </div>
                    <div className="progressText">
                        Otázka {currentIndex + 1} / {questionSet.length}
                    </div>
                    <div className="card" ref={cardRef}>
                        <div
                            key={currentIndex}
                            className={
                                direction === "left"
                                    ? "slide-in-left"
                                    : "slide-in-right"
                            }
                            style={{
                                width: "100%",
                                visibility: isContentReady
                                    ? "visible"
                                    : "hidden",
                            }}
                        >
                            <QuestionCard
                                currentQuestion={currentQuestion}
                                mode="real_test"
                                showResult={false}
                                selectedAnswer={selectedAnswer}
                                onSelect={handleAnswer}
                                optionRefsForCurrent={optionRefsForCurrent}
                                disabled={finalResult !== null}
                                isKeyboardMode={true}
                                currentSubject={test.subject}
                                onZoom={setFullscreenImage}
                                onSwipe={handleSwipe}
                                score={{ correct: 0, total: 0 }}
                                onReady={() =>
                                    setReadyQuestionId(currentQuestionId)
                                }
                            />
                        </div>
                        {!isContentReady && (
                            <div className="card-loading-overlay">
                                <div className="loadingSpinner small"></div>
                            </div>
                        )}
                        <div className="actionButtons spaced">
                            <button
                                className="navButton"
                                onClick={() => moveToQuestion(currentIndex - 1)}
                                disabled={
                                    currentIndex === 0 || finalResult !== null
                                }
                            >
                                Předchozí
                            </button>
                            {currentIndex < questionSet.length - 1 ? (
                                <button
                                    className="navButton"
                                    onClick={() =>
                                        moveToQuestion(currentIndex + 1)
                                    }
                                    disabled={finalResult !== null}
                                >
                                    Další
                                </button>
                            ) : (
                                <button
                                    className="navButton"
                                    style={{
                                        opacity: 0.5,
                                        cursor: "not-allowed",
                                    }}
                                    disabled={true}
                                >
                                    Další
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
                            <div
                                style={{
                                    marginTop: "2rem",
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                            >
                                <button
                                    className="navButton primary"
                                    style={{
                                        padding: "10px 30px",
                                        fontSize: "0.95rem",
                                        minWidth: "150px",
                                    }}
                                    onClick={() => setShowConfirmSubmit(true)}
                                    disabled={finalResult !== null}
                                >
                                    Odevzdat test
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div
            className="container fadeIn"
            style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}
        >
            <CustomImageModal
                src={fullscreenImage}
                onClose={() => setFullscreenImage(null)}
            />
            {showAutoSubmitModal && (
                <ConfirmModal
                    title="Čas vypršel"
                    message="Časový limit pro tento test vypršel. Vaše odpovědi byly automaticky uloženy."
                    onCancel={() => setShowAutoSubmitModal(false)}
                    onConfirm={() => setShowAutoSubmitModal(false)}
                    confirmText="Zobrazit výsledky"
                    danger={false}
                    hideButtons={true}
                />
            )}
            {showConfirmSubmit && (
                <ConfirmModal
                    title="Odevzdat test?"
                    message="Opravdu chcete test ukončit a odevzdat? Tuto akci nelze vrátit."
                    onCancel={() => setShowConfirmSubmit(false)}
                    onConfirm={() => submitTest()}
                    confirmText="ODEVZDAT"
                    danger={true}
                />
            )}
            {renderContent()}
            <div className="footer"></div>
        </div>
    );
}
