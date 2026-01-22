import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { useUserProfile } from "./hooks/useUserProfile";
import { useActivityDetection } from "./hooks/useActivityDetection";
import { useGlobalKeyboard } from "./hooks/useGlobalKeyboard";

import { SubjectSelector } from "./components/SubjectSelector.jsx";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { TestManager } from "./components/TestManager.jsx";

import { SessionBlockedScreen } from "./components/SessionBlockedScreen.jsx";
import { CloudLoginScreen } from "./components/CloudLoginScreen.jsx";
import { CustomImageModal } from "./components/CustomImageModal.jsx";
import { HighlightedText } from "./components/HighlightedText.jsx";
import { MainMenu } from "./components/MainMenu.jsx";
import { ScheduledTestsList } from "./components/ScheduledTestsList.jsx";
import { RealTestMode } from "./components/RealTestMode.jsx";

import {
    formatTime,
    removeAccents,
    getSmartRegex,
    isFlashcardStyle,
} from "./utils/formatting.js";
import { getImageUrl } from "./utils/images.js";
import {
    fetchQuestionsLightweight,
    clearImageCache,
    getCachedImage,
    fetchQuestionImage,
    preloadTestImages,
} from "./utils/dataManager.js";

import { SubjectBadge } from "./components/SubjectBadge.jsx";
import { UserBadgeDisplay } from "./components/UserBadgeDisplay.jsx";
import { HistoryView } from "./components/HistoryView.jsx";
import { ResultScreen } from "./components/ResultScreen.jsx";
import { QuestionCard } from "./components/QuestionCard.jsx";
import { Navigator } from "./components/Navigator.jsx";
import { ThemeToggle } from "./components/ThemeToggle.jsx";
import { HiddenPreloader } from "./components/HiddenPreloader.jsx";
import { ConfirmModal } from "./components/Modals.jsx";
import { NoMistakesScreen } from "./components/NoMistakesScreen.jsx";
import { ReportModal } from "./components/ReportModal.jsx";
import { SmartSettingsModal } from "./components/Modals.jsx";

import { CustomImportGuide } from "./components/CustomImportGuide.jsx";
import { LeaderboardPanel } from "./components/LeaderboardPanel.jsx";

/* ---------- Review Navigator Component ---------- */
const ReviewNavigator = ({ currentPage, totalPages, onPageChange }) => {
    const getPageNumbers = () => {
        const current = currentPage + 1;
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= current - delta && i <= current + delta)
            ) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    if (totalPages <= 1) return null;

    return (
        <div
            className="reviewPagination"
            style={{
                flexWrap: "wrap",
                gap: "0.5rem",
                justifyContent: "center",
                marginTop: "2rem",
            }}
        >
            <button
                className="reviewPaginationBtn"
                disabled={currentPage === 0}
                onClick={() => onPageChange(currentPage - 1)}
                style={{
                    padding: "0 1rem",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                ←
            </button>

            {getPageNumbers().map((page, index) => {
                const isDots = page === "...";
                const isCurrent = page === currentPage + 1;

                return (
                    <button
                        key={index}
                        className="reviewPaginationBtn"
                        onClick={() =>
                            typeof page === "number"
                                ? onPageChange(page - 1)
                                : null
                        }
                        disabled={isDots}
                        style={{
                            width: "40px",
                            height: "40px",
                            padding: 0,
                            minHeight: "40px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: isDots ? "default" : "pointer",
                            opacity: isDots ? 0.5 : 1,
                            background: isDots
                                ? "transparent"
                                : isCurrent
                                  ? "var(--color-primary)"
                                  : undefined,
                            borderColor: isDots
                                ? "transparent"
                                : isCurrent
                                  ? "var(--color-primary)"
                                  : undefined,
                            color: isCurrent ? "#fff" : undefined,
                            fontWeight: isCurrent ? "bold" : "normal",
                            boxShadow: isCurrent
                                ? "0 4px 12px rgba(59, 130, 246, 0.4)"
                                : "none",
                        }}
                    >
                        {page}
                    </button>
                );
            })}

            <button
                className="reviewPaginationBtn"
                disabled={currentPage === totalPages - 1}
                onClick={() => onPageChange(currentPage + 1)}
                style={{
                    padding: "0 1rem",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                →
            </button>
        </div>
    );
};

/* ---------- Review Image Component ---------- */

const ReviewImage = ({ q, subject, setFullscreenImage }) => {
    const [imgUrl, setImgUrl] = useState(() => {
        return (
            q.image_base64 ||
            (q.id ? getCachedImage(q.id) : null) ||
            getImageUrl(subject, q.number) ||
            (q.image && q.image.length > 5 ? q.image : null)
        );
    });

    useEffect(() => {
        if (q.id && !imgUrl) {
            fetchQuestionImage(q.id).then((url) => {
                if (url) setImgUrl(url);
            });
        }
    }, [q.id, imgUrl]);

    if (!imgUrl) return null;

    return (
        <div
            className="reviewImageWrapper"
            onClick={() => setFullscreenImage(imgUrl)}
        >
            <img
                src={imgUrl}
                alt=""
                className="reviewImage"
                onError={(e) => (e.target.style.display = "none")}
            />
        </div>
    );
};

/* ---------- Main App Component ---------- */

export default function App() {
    const {
        user,
        dbId,
        loading,
        syncing,
        isSessionBlocked,
        profileData,
        mistakes,
        history,
        testPracticeStats,
        totalTimeMap,
        totalQuestionsMap,
        login,
        logout,
        takeOverSession,
        saveData,
        refreshData,
        triggerFakeSync,
        setMistakes,
        setHistory,
    } = useUserProfile();

    // --- KONSTANTA PRO LIMIT ---
    const SMART_SAVE_LIMIT = 100;

    const [subject, setSubject] = useState(null);
    const [customQuestions, setCustomQuestions] = useState(null);

    const [theme, setTheme] = useState(
        () => localStorage.getItem("quizio_theme") || "dark",
    );
    const [activeQuestionsCache, setActiveQuestionsCache] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isTransitioningSubject, setIsTransitioningSubject] = useState(false);
    const [menuSelection, setMenuSelection] = useState(-1);
    const [mode, setMode] = useState(null);
    const [leaderboardEntries, setLeaderboardEntries] = useState([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);
    const [leaderboardError, setLeaderboardError] = useState(null);
    const [smartCountAnim, setSmartCountAnim] = useState(false);
    const [smartPrevCount, setSmartPrevCount] = useState(null);
    const smartPrevCountRef = useRef(null);
    const leaderboardClass = profileData?.class || "4.B";

    const DUEL_ANSWER_SECONDS = 45;
    const DUEL_RUSH_SECONDS = 10;
    const DUEL_RESULT_SECONDS = 3;

    const [duelOnlineUsers, setDuelOnlineUsers] = useState([]);
    const [duelInvites, setDuelInvites] = useState([]);
    const [duelInviteToShow, setDuelInviteToShow] = useState(null);
    const [duelOutgoingMatch, setDuelOutgoingMatch] = useState(null);
    const [duelActiveMatch, setDuelActiveMatch] = useState(null);
    const [duelQuestionSet, setDuelQuestionSet] = useState([]);
    const [duelAnswers, setDuelAnswers] = useState([]);
    const [duelLocalAnswers, setDuelLocalAnswers] = useState({});
    const [duelClock, setDuelClock] = useState(Date.now());
    const [duelClockOffsetMs, setDuelClockOffsetMs] = useState(0);
    const [duelStats, setDuelStats] = useState(null);
    const [duelSettings, setDuelSettings] = useState({
        questionCount: 10,
        rangeMode: "all",
        rangeStart: "",
        rangeEnd: "",
    });
    const [duelError, setDuelError] = useState("");
    const duelPresenceRef = useRef(null);
    const duelFinalizeRef = useRef(false);

    useEffect(() => {
        const syncStateFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const s = params.get("s");
            const m = params.get("m");

            if (s) setSubject(s.toUpperCase());
            else setSubject(null);

            if (m) setMode(m);
            else setMode(null);
        };

        window.addEventListener("popstate", syncStateFromUrl);
        syncStateFromUrl();
        return () => window.removeEventListener("popstate", syncStateFromUrl);
    }, []);


    useEffect(() => {
        if (!leaderboardClass) {
            setLeaderboardEntries([]);
            return;
        }

        let isActive = true;

        const fetchLeaderboard = async () => {
            setLeaderboardLoading(true);
            setLeaderboardError(null);

            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, subject_times, question_counts, class")
                .eq("class", leaderboardClass);

            if (!isActive) return;

            if (error) {
                setLeaderboardError(error.message);
                setLeaderboardEntries([]);
            } else {
                const mapped = (data || [])
                    .map((profile) => {
                        const subjectTimes = profile.subject_times || {};
                        const questionCounts = profile.question_counts || {};
                        const totalTime = Object.values(subjectTimes).reduce(
                            (sum, value) => sum + (value || 0),
                            0,
                        );
                        const totalQuestions = Object.values(
                            questionCounts,
                        ).reduce((sum, value) => sum + (value || 0), 0);
                        return {
                            id: profile.id,
                            username: profile.username,
                            subjectTimes,
                            questionCounts,
                            totalTime,
                            totalQuestions,
                        };
                    })
                    .sort((a, b) => b.totalTime - a.totalTime);

                setLeaderboardEntries(mapped);
            }

            setLeaderboardLoading(false);
        };

        fetchLeaderboard();

        return () => {
            isActive = false;
        };
    }, [leaderboardClass]);

    useEffect(() => {
        if (!dbId || !user || !profileData?.class) return;

        const channel = supabase.channel(
            `duel_presence_${profileData.class}`,
            {
                config: { presence: { key: dbId } },
            },
        );

        channel.on("presence", { event: "sync" }, () => {
            const state = channel.presenceState();
            const users = [];
            Object.values(state).forEach((entries) => {
                entries.forEach((entry) => {
                    if (entry.user_id !== dbId) {
                        users.push({
                            id: entry.user_id,
                            username: entry.username,
                            class: entry.class,
                        });
                    }
                });
            });
            setDuelOnlineUsers(users);
        });

        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                channel.track({
                    user_id: dbId,
                    username: user,
                    class: profileData.class,
                });
            }
        });

        duelPresenceRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            duelPresenceRef.current = null;
        };
    }, [dbId, user, profileData?.class]);

    useEffect(() => {
        if (!dbId) return;

        const fetchStats = async () => {
            const { data } = await supabase
                .from("duel_stats")
                .select("*")
                .eq("user_id", dbId)
                .maybeSingle();
            if (data) setDuelStats(data);
            else
                setDuelStats({
                    trophies: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                });
        };

        fetchStats();
    }, [dbId]);

    useEffect(() => {
        if (!dbId) return;

        let isActive = true;

        const fetchInvites = async () => {
            const { data: incoming } = await supabase
                .from("duel_matches")
                .select("*")
                .eq("opponent_id", dbId)
                .eq("status", "pending");

            const { data: outgoing } = await supabase
                .from("duel_matches")
                .select("*")
                .eq("challenger_id", dbId)
                .in("status", ["pending", "active"]);

            if (!isActive) return;
            setDuelInvites(incoming || []);
            setDuelOutgoingMatch(outgoing?.[0] || null);
            if (outgoing?.[0]?.status === "active") {
                setDuelActiveMatch(outgoing[0]);
                setMode("duel_match");
            }
        };

        fetchInvites();

        const channel = supabase
            .channel(`duel_matches_${dbId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "duel_matches",
                    filter: `opponent_id=eq.${dbId}`,
                },
                (payload) => {
                    const match = payload.new;
                    if (!match) return;

                    if (match.status === "pending") {
                        setDuelInvites((prev) => {
                            const exists = prev.find((i) => i.id === match.id);
                            if (exists) return prev;
                            return [...prev, match];
                        });
                    } else {
                        setDuelInvites((prev) =>
                            prev.filter((i) => i.id !== match.id),
                        );
                    }

                    if (match.status === "active") {
                        setDuelActiveMatch(match);
                        duelFinalizeRef.current = false;
                        if (subject !== match.subject) setSubject(match.subject);
                        setMode("duel_match");
                    }
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "duel_matches",
                    filter: `challenger_id=eq.${dbId}`,
                },
                (payload) => {
                    const match = payload.new;
                    if (!match) return;

                    if (match.status === "pending") {
                        setDuelOutgoingMatch(match);
                    } else if (match.status === "active") {
                        setDuelOutgoingMatch(null);
                        setDuelActiveMatch(match);
                        duelFinalizeRef.current = false;
                        if (subject !== match.subject) setSubject(match.subject);
                        setMode("duel_match");
                    } else if (
                        match.status === "declined" ||
                        match.status === "cancelled"
                    ) {
                        setDuelOutgoingMatch(null);
                    }
                },
            )
            .subscribe();

        return () => {
            isActive = false;
            supabase.removeChannel(channel);
        };
    }, [dbId, subject]);

    useEffect(() => {
        if (mode === "real_test") return;
        if (!duelInviteToShow && duelInvites.length > 0) {
            setDuelInviteToShow(duelInvites[0]);
        }
    }, [duelInvites, duelInviteToShow, mode]);

    useEffect(() => {
        if (!duelActiveMatch?.id) return;

        const channel = supabase
            .channel(`duel_match_${duelActiveMatch.id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "duel_matches",
                    filter: `id=eq.${duelActiveMatch.id}`,
                },
                (payload) => {
                    if (payload.new) setDuelActiveMatch(payload.new);
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [duelActiveMatch?.id]);

    useEffect(() => {
        if (!duelAnswers.length) return;
        const confirmed = new Set(
            duelAnswers
                .filter((answer) => answer.user_id === dbId)
                .map((answer) => answer.question_index),
        );
        if (confirmed.size === 0) return;
        setDuelLocalAnswers((prev) => {
            const next = { ...prev };
            confirmed.forEach((idx) => {
                delete next[idx];
            });
            return next;
        });
    }, [duelAnswers, dbId]);

    useEffect(() => {
        if (!duelActiveMatch?.id) return;

        const fetchAnswers = async () => {
            const { data } = await supabase
                .from("duel_answers")
                .select("*")
                .eq("match_id", duelActiveMatch.id);
            setDuelAnswers(data || []);
        };

        fetchAnswers();

        const channel = supabase
            .channel(`duel_answers_${duelActiveMatch.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "duel_answers",
                    filter: `match_id=eq.${duelActiveMatch.id}`,
                },
                (payload) => {
                    if (payload.eventType === "DELETE") {
                        setDuelAnswers((prev) =>
                            prev.filter((a) => a.id !== payload.old.id),
                        );
                        return;
                    }
                    const answer = payload.new;
                    if (!answer) return;
                    setDuelAnswers((prev) => {
                        const idx = prev.findIndex((a) => a.id === answer.id);
                        if (idx === -1) return [...prev, answer];
                        const next = [...prev];
                        next[idx] = answer;
                        return next;
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [duelActiveMatch?.id]);

    useEffect(() => {
        if (!duelActiveMatch) return;
        const ids = duelActiveMatch.question_ids || [];
        if (ids.length === 0) {
            setDuelQuestionSet([]);
            return;
        }

        const syncQuestions = async () => {
            const localMap = new Map(
                activeQuestionsCache.map((q) => [q.id, q]),
            );
            const missing = ids.filter((id) => !localMap.has(id));
            let fetched = [];

            if (missing.length > 0) {
                const { data } = await supabase
                    .from("questions")
                    .select(
                        "id, number, subject, question, options, correct_index, is_active, updated_at",
                    )
                    .in("id", missing);

                fetched =
                    data?.map((item) => ({
                        ...item,
                        correctIndex: item.correct_index,
                        options: Array.isArray(item.options) ? item.options : [],
                    })) || [];
            }

            fetched.forEach((item) => localMap.set(item.id, item));
            const ordered = ids.map((id) => localMap.get(id)).filter(Boolean);
            setDuelQuestionSet(ordered);
        };

        syncQuestions();
    }, [duelActiveMatch, activeQuestionsCache]);

    useEffect(() => {
        if (!duelActiveMatch?.id) return;
        calibrateDuelClock(duelActiveMatch.id);
    }, [duelActiveMatch?.id]);

    useEffect(() => {
        if (!duelActiveMatch?.id) return;
        const timer = setInterval(() => {
            setDuelClock(Date.now() + duelClockOffsetMs);
        }, 500);
        return () => clearInterval(timer);
    }, [duelActiveMatch?.id, duelClockOffsetMs]);

    useEffect(() => {
        if (!duelActiveMatch?.started_at) return;
        const progress = getDuelProgress(duelActiveMatch, duelClock);
        if (progress.phase === "finished") finalizeDuelMatch();
    }, [duelClock, duelActiveMatch, duelAnswers, duelQuestionSet]);

    useEffect(() => {
        if (mode === "loading") return;
        const params = new URLSearchParams();
        if (subject) params.set("s", subject.toLowerCase());
        if (mode) params.set("m", mode);

        const newUrl =
            window.location.pathname +
            (params.toString() ? "?" + params.toString() : "");
        if (
            window.location.search !== "?" + params.toString() &&
            !(window.location.search === "" && params.toString() === "")
        ) {
            window.history.pushState({ subject, mode }, "", newUrl);
        }
    }, [subject, mode]);

    const [showSmartSettings, setShowSmartSettings] = useState(false);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [showSaveProgressPrompt, setShowSaveProgressPrompt] = useState(false);

    const [showClearMistakesConfirm, setShowClearMistakesConfirm] =
        useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [reviewPage, setReviewPage] = useState(0);
    const [questionSet, setQuestionSet] = useState([]);

    useEffect(() => {
        if (mode !== "smart") {
            smartPrevCountRef.current = null;
            setSmartPrevCount(null);
            setSmartCountAnim(false);
            return;
        }

        const currentCount = questionSet.length;
        if (
            smartPrevCountRef.current !== null &&
            currentCount < smartPrevCountRef.current
        ) {
            setSmartPrevCount(smartPrevCountRef.current);
            setSmartCountAnim(true);
            const timer = setTimeout(() => setSmartCountAnim(false), 450);
            smartPrevCountRef.current = currentCount;
            return () => clearTimeout(timer);
        }
        smartPrevCountRef.current = currentCount;
    }, [mode, questionSet.length]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [combo, setCombo] = useState(0);
    const [shake, setShake] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [finished, setFinished] = useState(false);

    // --- CENTRÁLNÍ FUNKCE PRO ULOŽENÍ SMART SESSION ---
    const persistSmartSession = async (currentSet, idx, currentScore) => {
        if (!subject || !dbId || isSessionBlocked) return;
        if (currentSet.length > SMART_SAVE_LIMIT) return; // Limit

        // 1. Získáme aktuální data z profilu (pro zachování ostatních předmětů)
        const existingSessions = profileData?.smart_session || {};

        // 2. Data pro aktuální předmět
        const questionIds = currentSet.map((q) => q.number);
        const sessionData = {
            ids: questionIds,
            index: idx,
            score: currentScore,
            timestamp: Date.now(),
        };

        // 3. Merge: Existující + Aktuální
        const updatedSessions = {
            ...existingSessions,
            [subject]: sessionData,
        };

        // 4. Odeslání
        await saveData({ smart_session: updatedSessions });
    };

    // Funkce pro smazání uloženého postupu (volá se při dokončení)
    const clearSmartSession = async () => {
        if (!subject) return;
        const currentSessions = profileData?.smart_session || {};

        // Vytvoříme kopii a smažeme klíč aktuálního předmětu
        const updatedSessions = { ...currentSessions };
        delete updatedSessions[subject];

        await saveData({ smart_session: updatedSessions });
        // console.log("Smart session vyčištěna manuálně.");
    };

    // --- AUTOMATICKÉ UKLÁDÁNÍ (Backup přes useEffect) ---
    // Ukládá při změně indexu (např. posun šipkou)
    useEffect(() => {
        if (
            mode === "smart" &&
            !finished &&
            questionSet.length > 0 &&
            subject &&
            questionSet.length <= SMART_SAVE_LIMIT
        ) {
            const timer = setTimeout(() => {
                persistSmartSession(questionSet, currentIndex, score);
            }, 500); // Debounce pro navigaci
            return () => clearTimeout(timer);
        }
    }, [
        mode,
        currentIndex,
        score,
        finished,
        subject,
        questionSet,
        profileData,
    ]);

    // --- SCROLL: zachovat pozici při přechodu mezi otázkami ---
    // Posun na začátek pouze při změně režimu nebo předmětu.
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
        window.scrollTo({ top: 0, behavior: "instant" });
    }, [mode, subject]);
    // -----------------------------------------------------------------

    useEffect(() => {
        window.currentTestIndex = currentIndex;
        window.totalTestQuestions = questionSet.length;
        return () => {
            window.currentTestIndex = undefined;
            window.totalTestQuestions = undefined;
        };
    }, [currentIndex, questionSet.length]);

    const [maxSeenIndex, setMaxSeenIndex] = useState(0);
    const [trainingTime, setTrainingTime] = useState(0);

    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [showConfirmExit, setShowConfirmExit] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [timeLeftAtSubmit, setTimeLeftAtSubmit] = useState(0);

    const { isKeyboardMode, setIsKeyboardMode } = useGlobalKeyboard();
    const { sessionTime, setSessionTime, isAfk } = useActivityDetection(
        mode,
        isSessionBlocked,
    );

    const [direction, setDirection] = useState("right");
    const [exitDirection, setExitDirection] = useState(null);

    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [questionToReport, setQuestionToReport] = useState(null);

    const [scheduledTests, setScheduledTests] = useState([]);
    const [activeTest, setActiveTest] = useState(null);
    const [completedTestIds, setCompletedTestIds] = useState([]);
    const [testToStart, setTestToStart] = useState(null);

    const optionRefsForCurrent = useRef({});
    const cardRef = useRef(null);
    const containerRef = useRef(null);

    const [sessionQuestionsCount, setSessionQuestionsCount] = useState(0);
    const [readyQuestionId, setReadyQuestionId] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState(0);

    const currentQuestion = questionSet[currentIndex] || {
        question: "",
        options: [],
        correctIndex: 0,
        number: 0,
        _localIndex: currentIndex,
    };
    const currentQuestionId =
        currentQuestion.id || currentQuestion.number || currentIndex;
    const isContentReady = readyQuestionId === currentQuestionId;
    const isTeacher = user === "admin" || user === "Učitel";

    useEffect(() => {
        const savedCode = localStorage.getItem("quizio_user_code");
        if (savedCode && !user && !loading) {
            login(savedCode);
        }
    }, []);

    const saveDataToCloud = async (
        newMistakes,
        newHistory,
        timeToAdd = 0,
        questionsToAdd = 0,
        newTestStats = null,
    ) => {
        const updates = {};
        if (newMistakes !== undefined) updates.mistakes = newMistakes;
        if (newHistory !== undefined) updates.history = newHistory;
        if (newTestStats !== null) updates.test_practice_stats = newTestStats;
        if (timeToAdd > 0 && subject) {
            const currentSubjectTime = totalTimeMap[subject] || 0;
            updates.subject_times = {
                ...totalTimeMap,
                [subject]: currentSubjectTime + timeToAdd,
            };
            setSessionTime(0);
        }
        if (questionsToAdd > 0 && subject) {
            const currentCount = totalQuestionsMap[subject] || 0;
            updates.question_counts = {
                ...totalQuestionsMap,
                [subject]: currentCount + questionsToAdd,
            };
            setSessionQuestionsCount(0);
        }
        if (Object.keys(updates).length > 0) await saveData(updates);
    };

    const flushSessionStats = () => {
        if (sessionTime > 0 || sessionQuestionsCount > 0) {
            saveDataToCloud(
                undefined,
                undefined,
                sessionTime,
                sessionQuestionsCount,
            );
        }
    };

    const fetchScheduledTests = async () => {
        if (!subject || subject === "CUSTOM") return;
        const { data } = await supabase
            .from("scheduled_tests")
            .select("*")
            .eq("subject", subject)
            .order("close_at", { ascending: true });
        if (data) setScheduledTests(data);
    };

    const fetchCompletedTests = async () => {
        if (!user || !dbId) {
            setCompletedTestIds([]);
            return;
        }
        const { data } = await supabase
            .from("test_results")
            .select("test_id")
            .eq("user_id", dbId);
        if (data) {
            const ids = [...new Set(data.map((item) => item.test_id))];
            setCompletedTestIds(ids);
        }
    };

    useEffect(() => {
        if (!subject || subject === "CUSTOM") return;
        fetchScheduledTests();
        const sub = supabase
            .channel("tests_update")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "scheduled_tests" },
                fetchScheduledTests,
            )
            .subscribe();
        return () => supabase.removeChannel(sub);
    }, [subject]);

    useEffect(() => {
        if (!user || !dbId) {
            setCompletedTestIds([]);
            return;
        }
        fetchCompletedTests();
        const sub = supabase
            .channel("my_results_update")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "test_results",
                    filter: `user_id=eq.${dbId}`,
                },
                (payload) =>
                    setCompletedTestIds((prev) => [
                        ...prev,
                        payload.new.test_id,
                    ]),
            )
            .on(
                "postgres_changes",
                { event: "DELETE", schema: "public", table: "test_results" },
                fetchCompletedTests,
            )
            .subscribe();
        return () => supabase.removeChannel(sub);
    }, [user, dbId]);

    const handleManualRefresh = async () => {
        await Promise.all([
            fetchScheduledTests(),
            fetchCompletedTests(),
            refreshData(),
        ]);
    };

    const handleTestCompletion = (testId) => {
        setCompletedTestIds((prev) =>
            prev.includes(testId) ? prev : [...prev, testId],
        );
    };

    const triggerHaptic = (type) => {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            if (type === "success") navigator.vibrate(50);
            else if (type === "error") navigator.vibrate([50, 100, 50]);
            else if (type === "light") navigator.vibrate(10);
        }
    };

    const updateMistakes = (newValOrFn) => {
        const next =
            typeof newValOrFn === "function"
                ? newValOrFn(mistakes)
                : newValOrFn;
        setMistakes(next);
        saveDataToCloud(next, undefined);
    };

    const updateHistory = (newValOrFn) => {
        const next =
            typeof newValOrFn === "function" ? newValOrFn(history) : newValOrFn;
        setHistory(next);
        saveDataToCloud(undefined, next);
    };

    const handleLogout = () => {
        flushSessionStats();
        setSubject(null);
        setMode(null);
        logout();
    };

    const openHistoryWithRefresh = async () => {
        flushSessionStats();
        setMode("history");
        await refreshData();
    };

    useEffect(() => {
        if (sessionTime >= 60 || sessionQuestionsCount >= 10)
            saveDataToCloud(
                undefined,
                undefined,
                sessionTime,
                sessionQuestionsCount,
            );
    }, [sessionTime, sessionQuestionsCount]);

    useEffect(() => {
        localStorage.setItem("quizio_theme", theme);
        document.body.className = theme === "light" ? "light-mode" : "";
        document.documentElement.setAttribute("data-theme", theme);
        window.dispatchEvent(new Event("storage"));

        if (theme === "light")
            document.documentElement.style.backgroundColor = "#f8fafc";
        else document.documentElement.style.backgroundColor = "#0a0e27";
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            return next;
        });
    };

    const prepareQuestionSet = (
        baseQuestions,
        shouldShuffleOptions = false,
    ) => {
        if (!Array.isArray(baseQuestions)) return [];
        return baseQuestions.map((q, idx) => {
            let options = [...(q.options || [])];
            let correctIndex = q.correctIndex;

            if (shouldShuffleOptions) {
                const optionsWithMeta = options.map((opt, i) => ({
                    text: opt,
                    isCorrect: i === correctIndex,
                }));
                // Fisher-Yates shuffle
                for (let i = optionsWithMeta.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsWithMeta[i], optionsWithMeta[j]] = [
                        optionsWithMeta[j],
                        optionsWithMeta[i],
                    ];
                }
                options = optionsWithMeta.map((o) => o.text);
                correctIndex = optionsWithMeta.findIndex((o) => o.isCorrect);
            }

            return {
                ...q,
                options,
                correctIndex,
                userAnswer: undefined,
                _localIndex: idx,
                _instanceId: Math.random(),
            };
        });
    };

    useEffect(() => {
        const fetchQuestions = async () => {
            if (!subject) {
                setActiveQuestionsCache([]);
                return;
            }
            if (subject === "CUSTOM") {
                setActiveQuestionsCache(
                    prepareQuestionSet(customQuestions || []),
                );
                return;
            }

            setIsLoadingQuestions(true);
            const minDelay = new Promise((resolve) => setTimeout(resolve, 500));

            try {
                const { data, error } =
                    await fetchQuestionsLightweight(subject);
                await minDelay;
                if (error) throw error;
                if (data && data.length > 0) {
                    const mappedData = data.map((item) => ({
                        ...item,
                        correctIndex: item.correct_index,
                        options: Array.isArray(item.options)
                            ? item.options
                            : [],
                    }));
                    setActiveQuestionsCache(prepareQuestionSet(mappedData));
                } else {
                    setActiveQuestionsCache([]);
                }
            } catch (err) {
                console.error("Chyba při stahování otázek:", err);
                alert("Nepodařilo se stáhnout otázky z cloudu.");
                setActiveQuestionsCache([]);
            } finally {
                setIsLoadingQuestions(false);
                setIsTransitioningSubject(false);
            }
        };
        fetchQuestions();
    }, [subject, customQuestions]);

    // --- LOGIKA PRO OBNOVENÍ SMART RELACE ---
    const checkSmartSession = () => {
        const savedSession = profileData?.smart_session?.[subject];
        if (savedSession && savedSession.ids && savedSession.ids.length > 0) {
            // Máme uloženou relaci, zeptáme se uživatele
            setShowResumePrompt(true);
        } else {
            // Žádná relace, otevřeme nastavení pro novou
            setShowSmartSettings(true);
        }
    };

    const resumeSmartSession = async () => {
        setShowResumePrompt(false);
        const savedSession = profileData?.smart_session?.[subject];
        if (!savedSession) return;

        setMode("loading");
        setLoadingProgress(0);

        const sessionIds = savedSession.ids;
        const reorderedQuestions = [];

        sessionIds.forEach((id) => {
            const found = activeQuestionsCache.find((q) => q.number === id);
            if (found) {
                reorderedQuestions.push({
                    ...found,
                    _instanceId: Math.random(),
                    userAnswer: undefined,
                });
            }
        });

        const startIndex = savedSession.index || 0;
        const subsetToPreload = reorderedQuestions.slice(
            startIndex,
            startIndex + 5,
        );
        await preloadTestImages(subsetToPreload, (progress) => {
            setLoadingProgress(progress);
        });

        setQuestionSet(reorderedQuestions);
        setCurrentIndex(startIndex);
        setScore(savedSession.score || { correct: 0, total: 0 });

        setReadyQuestionId(null);
        setMode("smart");
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setTrainingTime(0);
        setCombo(0);
    };

    const startNewSmartSession = async (count) => {
        setShowResumePrompt(false);
        setShowSmartSettings(false);

        // Pokud startujeme novou, smažeme tu starou z cloudu
        const currentSmartSessions = profileData?.smart_session || {};
        const updatedSessions = { ...currentSmartSessions };
        delete updatedSessions[subject];
        saveData({ smart_session: updatedSessions });

        let pool = activeQuestionsCache;
        if (!pool || pool.length === 0) {
            alert("Žádné otázky nejsou k dispozici.");
            return;
        }

        let shuffled = [...pool]
            .sort(() => Math.random() - 0.5)
            .map((q, idx) => ({
                ...q,
                _localIndex: idx,
                _instanceId: Math.random(),
            }));
        if (count !== "all" && typeof count === "number")
            shuffled = shuffled.slice(0, count);

        // Přednačítání
        setMode("loading");
        setLoadingProgress(0);

        const subsetToPreload = shuffled.slice(0, 5);
        await preloadTestImages(subsetToPreload, (progress) => {
            setLoadingProgress(progress);
        });

        setReadyQuestionId(null);
        setQuestionSet(shuffled);
        setMode("smart");
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setTrainingTime(0);
        setCombo(0);

        // Hned uložíme počáteční stav
        if (shuffled.length <= SMART_SAVE_LIMIT) {
            persistSmartSession(shuffled, 0, { correct: 0, total: 0 });
        }
    };

    // --- END SMART LOGIC ---

    const startTestPractice = async (test) => {
        const pool = activeQuestionsCache.filter(
            (q) =>
                q.number >= test.topic_range_start &&
                q.number <= test.topic_range_end,
        );
        if (pool.length === 0) {
            alert("Žádné otázky v rozsahu.");
            return;
        }
        const shuffled = [...pool]
            .sort(() => Math.random() - 0.5)
            .map((q, idx) => ({
                ...q,
                _localIndex: idx,
                _instanceId: Math.random(),
            }));

        setMode("loading");
        setLoadingProgress(0);

        const subsetToPreload = shuffled.slice(0, 5);
        await preloadTestImages(subsetToPreload, (progress) => {
            setLoadingProgress(progress);
        });

        setReadyQuestionId(null);
        setQuestionSet(shuffled);
        setMode("test_practice");
        setActiveTest(test);
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setCombo(0);
    };

    const confirmStartTest = async () => {
        if (!testToStart) return;
        setTestToStart(null);

        const test = testToStart;
        const pool = activeQuestionsCache.filter(
            (q) =>
                q.number >= test.topic_range_start &&
                q.number <= test.topic_range_end,
        );
        const selected = [...pool]
            .sort(() => Math.random() - 0.5)
            .slice(0, test.question_count);
        const prepared = prepareQuestionSet(selected, true);

        setMode("loading");
        setLoadingProgress(0);
        await preloadTestImages(prepared, (progress) => {
            setLoadingProgress(progress);
        });

        setQuestionSet(prepared);
        setActiveTest(test);
        setReadyQuestionId(null);
        setMode("real_test");
    };

    const startGradedTest = async (test) => {
        const now = new Date();
        if (!test.open_at || !test.close_at) {
            alert("Tento test nemá stanovený termín.");
            return;
        }
        if (now < new Date(test.open_at)) {
            alert("Test ještě není otevřen.");
            return;
        }
        if (now > new Date(test.close_at)) {
            alert("Test je již uzavřen.");
            return;
        }
        if (completedTestIds.includes(test.id)) {
            alert("Tento test jste již vypracovali.");
            return;
        }
        setTestToStart(test);
    };

    const startRandomMode = async () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) {
            alert("Žádné otázky nejsou k dispozici.");
            return;
        }

        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setShowResult(false);
        setSelectedAnswer(null);
        setCurrentIndex(0);
        setCombo(0);
        setIsKeyboardMode(false);
        setReadyQuestionId(null);

        const shuffled = [...pool]
            .sort(() => Math.random() - 0.5)
            .map((q, idx) => ({
                ...q,
                _localIndex: idx,
                _instanceId: Math.random(),
            }));

        setMode("loading");
        setLoadingProgress(0);

        const subsetToPreload = shuffled.slice(0, 5);
        await preloadTestImages(subsetToPreload, (progress) => {
            setLoadingProgress(progress);
        });

        setQuestionSet(shuffled);
        setMode("random");
    };
    const startMockTest = async () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) {
            alert("Žádné otázky nejsou k dispozici.");
            return;
        }

        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setShowResult(false);
        setSelectedAnswer(null);
        setCurrentIndex(0);
        setMaxSeenIndex(0);
        setCombo(0);
        setIsKeyboardMode(false);
        setReadyQuestionId(null);

        const sel = [...pool]
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(40, pool.length));
        const prepared = prepareQuestionSet(sel, true);

        setMode("loading");
        setLoadingProgress(0);
        await preloadTestImages(prepared, (progress) => {
            setLoadingProgress(progress);
        });

        setQuestionSet(prepared);
        setTimeLeft(1800);
        setMode("mock");
    };
    const startMistakesMode = async () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) {
            alert("Žádné otázky nejsou k dispozici.");
            return;
        }
        const userMistakes = mistakes[subject] || [];
        const filtered = all.filter((q) => userMistakes.includes(q.number));
        if (filtered.length === 0) {
            setMode("no_mistakes");
            return;
        }

        const shuffled = [...filtered]
            .sort(() => Math.random() - 0.5)
            .map((q, idx) => ({
                ...q,
                _localIndex: idx,
                _instanceId: Math.random(),
            }));

        setMode("loading");
        setLoadingProgress(0);

        const subsetToPreload = shuffled.slice(0, 5);
        await preloadTestImages(subsetToPreload, (progress) => {
            setLoadingProgress(progress);
        });

        setReadyQuestionId(null);
        setQuestionSet(shuffled);
        setMode("mistakes");
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setTrainingTime(0);
        setCombo(0);
    };

    const startReviewMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) {
            alert("Žádné otázky nejsou k dispozici.");
            return;
        }
        setQuestionSet(all);
        setMode("review");
        setCombo(0);
        setReviewPage(0);
        setSearchTerm("");
    };

    const addMistake = (qNumber) =>
        updateMistakes((prev) => {
            const cur = prev[subject] || [];
            return !cur.includes(qNumber)
                ? { ...prev, [subject]: [...cur, qNumber] }
                : prev;
        });
    const removeMistake = (qNumber) =>
        updateMistakes((prev) => {
            const cur = prev[subject] || [];
            return cur.includes(qNumber)
                ? { ...prev, [subject]: cur.filter((n) => n !== qNumber) }
                : prev;
        });
    const clearMistakes = () => {
        updateMistakes((prev) => ({ ...prev, [subject]: [] }));
        setShowClearMistakesConfirm(false);
    };
    const handleSelectSubject = (subj) => {
        if (subj === "CUSTOM") {
            setShowCustomImport(true);
            return;
        }
        setIsTransitioningSubject(true);
        setSubject(subj.toUpperCase());
        setMenuSelection(0);
        setMode(null);
    };
    const handleStartMode = (startFn, modeName) => {
        if (modeName === "smart") {
            checkSmartSession();
            return;
        }
        startFn();
    };

    const shuffleArray = (list) => {
        const arr = [...list];
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    const getDuelOpponent = (match) => {
        if (!match) return null;
        const isChallenger = match.challenger_id === dbId;
        return {
            id: isChallenger ? match.opponent_id : match.challenger_id,
            username: isChallenger ? match.opponent_name : match.challenger_name,
        };
    };

    const getDuelEligibleQuestions = () => {
        if (!activeQuestionsCache || activeQuestionsCache.length === 0)
            return [];
        if (duelSettings.rangeMode === "all") return activeQuestionsCache;

        const start = Number.parseInt(duelSettings.rangeStart, 10);
        const end = Number.parseInt(duelSettings.rangeEnd, 10);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        return activeQuestionsCache.filter(
            (q) => q.number >= from && q.number <= to,
        );
    };

    const validateDuelSettings = () => {
        if (!subject) return "Nejdriv vyber predmet.";
        const eligible = getDuelEligibleQuestions();
        const allowedCounts = [2, 10, 20, 50];
        if (!allowedCounts.includes(duelSettings.questionCount)) {
            return "Vyber povoleny pocet otazek.";
        }
        if (eligible.length < duelSettings.questionCount) {
            return "V rozsahu neni dost otazek pro zvoleny pocet.";
        }
        return "";
    };

    const createDuelMatch = async (opponent) => {
        const validation = validateDuelSettings();
        if (validation) {
            setDuelError(validation);
            return;
        }

        const eligible = getDuelEligibleQuestions();
        const selectedQuestions = shuffleArray(eligible).slice(
            0,
            duelSettings.questionCount,
        );
        const questionIds = selectedQuestions.map((q) => q.id);

        const payload = {
            challenger_id: dbId,
            opponent_id: opponent.id,
            challenger_name: user,
            opponent_name: opponent.username,
            subject,
            question_count: duelSettings.questionCount,
            range_mode: duelSettings.rangeMode,
            range_start:
                duelSettings.rangeMode === "range"
                    ? Number.parseInt(duelSettings.rangeStart, 10)
                    : null,
            range_end:
                duelSettings.rangeMode === "range"
                    ? Number.parseInt(duelSettings.rangeEnd, 10)
                    : null,
            question_ids: questionIds,
            status: "pending",
        };

        const { data, error } = await supabase
            .from("duel_matches")
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error("Chyba pri vytvoreni duelu:", error);
            setDuelError("Nepodarilo se vytvorit duel.");
            return;
        }

        setDuelOutgoingMatch(data);
        setDuelError("");
        setMode("duel");
    };

    const acceptDuelInvite = async (invite) => {
        const startAt = new Date().toISOString();
        const { data, error } = await supabase
            .from("duel_matches")
            .update({
                status: "active",
                accepted_at: startAt,
                started_at: startAt,
            })
            .eq("id", invite.id)
            .eq("status", "pending")
            .select()
            .single();

        if (error || !data) {
            console.error("Chyba pri prijeti duelu:", error);
            return;
        }

        setDuelInviteToShow(null);
        setDuelInvites((prev) => prev.filter((i) => i.id !== invite.id));
        setDuelOutgoingMatch(null);
        setDuelActiveMatch(data);
        duelFinalizeRef.current = false;
        if (subject !== data.subject) setSubject(data.subject);
        setMode("duel_match");
    };

    const declineDuelInvite = async (invite) => {
        await supabase
            .from("duel_matches")
            .update({ status: "declined" })
            .eq("id", invite.id);
        setDuelInvites((prev) => prev.filter((i) => i.id !== invite.id));
        setDuelInviteToShow(null);
    };

    const cancelOutgoingDuel = async () => {
        if (!duelOutgoingMatch) return;
        await supabase
            .from("duel_matches")
            .update({ status: "cancelled" })
            .eq("id", duelOutgoingMatch.id);
        setDuelOutgoingMatch(null);
    };

    const calibrateDuelClock = async (matchId) => {
        const clientStart = Date.now();
        const { data, error } = await supabase
            .from("duel_matches")
            .select("created_at")
            .eq("id", matchId)
            .single();

        if (error || !data?.created_at) {
            setDuelClockOffsetMs(0);
            return;
        }

        const clientEnd = Date.now();
        const serverTime = new Date(data.created_at).getTime();
        const latency = (clientEnd - clientStart) / 2;
        const approxServerNow = serverTime + latency;
        setDuelClockOffsetMs(approxServerNow - clientEnd);
    };

    const getDuelProgress = (match, now) => {
        if (!match?.started_at) {
            return { index: 0, phase: "waiting", timeLeft: 0 };
        }

        const questionCount = match.question_count || 0;
        let questionStart = new Date(match.started_at).getTime();

        for (let i = 0; i < questionCount; i += 1) {
            const answersForQuestion = duelAnswers
                .filter((answer) => answer.question_index === i)
                .map((answer) => new Date(answer.answered_at).getTime())
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            const firstAnswerAt = answersForQuestion[0] ?? null;
            const secondAnswerAt = answersForQuestion[1] ?? null;

            let answerDeadline =
                questionStart + DUEL_ANSWER_SECONDS * 1000;
            if (
                firstAnswerAt &&
                firstAnswerAt + DUEL_RUSH_SECONDS * 1000 < answerDeadline
            ) {
                answerDeadline = firstAnswerAt + DUEL_RUSH_SECONDS * 1000;
            }

            let answerPhaseEnd = answerDeadline;
            if (secondAnswerAt && secondAnswerAt < answerPhaseEnd) {
                answerPhaseEnd = secondAnswerAt;
            }

            if (now < answerPhaseEnd) {
                return {
                    index: i,
                    phase: "answer",
                    timeLeft: Math.max(
                        0,
                        Math.ceil((answerPhaseEnd - now) / 1000),
                    ),
                    answerEndsAt: answerPhaseEnd,
                    questionStartsAt: questionStart,
                };
            }

            const resultEndsAt =
                answerPhaseEnd + DUEL_RESULT_SECONDS * 1000;
            if (now < resultEndsAt) {
                return {
                    index: i,
                    phase: "result",
                    timeLeft: Math.max(
                        0,
                        Math.ceil((resultEndsAt - now) / 1000),
                    ),
                    answerEndsAt: answerPhaseEnd,
                    resultEndsAt,
                    questionStartsAt: questionStart,
                };
            }

            questionStart = resultEndsAt;
        }

        return { index: questionCount, phase: "finished", timeLeft: 0 };
    };

    const getAnswerFor = (userId, questionIndex) =>
        duelAnswers.find(
            (answer) =>
                answer.user_id === userId &&
                answer.question_index === questionIndex,
        );

    const submitDuelAnswer = async (answerIndex) => {
        if (!duelActiveMatch || !dbId) return;
        const progress = getDuelProgress(duelActiveMatch, duelClock);
        if (progress.phase !== "answer") return;
        const questionIndex = progress.index;
        const existing = getAnswerFor(dbId, questionIndex);
        if (existing) return;

        setDuelLocalAnswers((prev) => ({
            ...prev,
            [questionIndex]: answerIndex,
        }));

        const { error } = await supabase.from("duel_answers").insert([
            {
                match_id: duelActiveMatch.id,
                user_id: dbId,
                question_index: questionIndex,
                answer_index: answerIndex,
            },
        ]);

        if (error) {
            console.error("Chyba pri ukladani odpovedi:", error);
            setDuelLocalAnswers((prev) => {
                const next = { ...prev };
                delete next[questionIndex];
                return next;
            });
        }
    };

    const computeDuelScore = () => {
        if (!duelActiveMatch) return { myScore: 0, opponentScore: 0 };
        const opponent = getDuelOpponent(duelActiveMatch);
        if (!opponent) return { myScore: 0, opponentScore: 0 };
        let myScore = 0;
        let opponentScore = 0;

        for (let i = 0; i < duelActiveMatch.question_count; i += 1) {
            const question = duelQuestionSet[i];
            if (!question) continue;

            const myAnswer = getAnswerFor(dbId, i);
            const opponentAnswer = getAnswerFor(opponent.id, i);

            const myCorrect =
                myAnswer && myAnswer.answer_index === question.correctIndex;
            const opponentCorrect =
                opponentAnswer &&
                opponentAnswer.answer_index === question.correctIndex;

            if (myCorrect && opponentCorrect) {
                const myTime = new Date(myAnswer.answered_at).getTime();
                const opponentTime = new Date(
                    opponentAnswer.answered_at,
                ).getTime();
                if (myTime < opponentTime) myScore += 1;
                else if (opponentTime < myTime) opponentScore += 1;
                else {
                    myScore += 1;
                    opponentScore += 1;
                }
            } else if (myCorrect) {
                myScore += 1;
            } else if (opponentCorrect) {
                opponentScore += 1;
            }
        }

        return { myScore, opponentScore };
    };

    const applyDuelTrophies = async (
        myScore,
        opponentScore,
        questionCount,
        opponentId,
    ) => {
        const multiplier = Math.max(1, questionCount / 5);
        const isDraw = myScore === opponentScore;
        const myWin = myScore > opponentScore;
        const opponentWin = opponentScore > myScore;

        let myDelta = 0;
        let opponentDelta = 0;
        let myWins = 0;
        let myLosses = 0;
        let myDraws = 0;
        let opponentWins = 0;
        let opponentLosses = 0;
        let opponentDraws = 0;

        if (isDraw) {
            myDelta = 3 * multiplier;
            opponentDelta = 3 * multiplier;
            myDraws = 1;
            opponentDraws = 1;
        } else if (myWin) {
            myDelta = 5 * multiplier;
            opponentDelta = -2 * multiplier;
            myWins = 1;
            opponentLosses = 1;
        } else if (opponentWin) {
            myDelta = -2 * multiplier;
            opponentDelta = 5 * multiplier;
            myLosses = 1;
            opponentWins = 1;
        }

        const { data: stats } = await supabase
            .from("duel_stats")
            .select("*")
            .in("user_id", [dbId, opponentId]);

        const statsById = new Map(
            (stats || []).map((entry) => [entry.user_id, entry]),
        );

        const myStats = statsById.get(dbId) || {};
        const opponentStats = statsById.get(opponentId) || {};

        const payload = [
            {
                user_id: dbId,
                trophies: (myStats.trophies || 0) + myDelta,
                wins: (myStats.wins || 0) + myWins,
                losses: (myStats.losses || 0) + myLosses,
                draws: (myStats.draws || 0) + myDraws,
                updated_at: new Date().toISOString(),
            },
            {
                user_id: opponentId,
                trophies: (opponentStats.trophies || 0) + opponentDelta,
                wins: (opponentStats.wins || 0) + opponentWins,
                losses: (opponentStats.losses || 0) + opponentLosses,
                draws: (opponentStats.draws || 0) + opponentDraws,
                updated_at: new Date().toISOString(),
            },
        ];

        await supabase.from("duel_stats").upsert(payload, {
            onConflict: "user_id",
        });

        const { data: refreshed } = await supabase
            .from("duel_stats")
            .select("*")
            .eq("user_id", dbId)
            .maybeSingle();
        if (refreshed) setDuelStats(refreshed);
    };

    const finalizeDuelMatch = async () => {
        if (!duelActiveMatch || duelFinalizeRef.current) return;
        duelFinalizeRef.current = true;

        const opponent = getDuelOpponent(duelActiveMatch);
        if (!opponent) return;

        const { myScore, opponentScore } = computeDuelScore();
        const challengerScore =
            duelActiveMatch.challenger_id === dbId
                ? myScore
                : opponentScore;
        const opponentScoreValue =
            duelActiveMatch.challenger_id === dbId
                ? opponentScore
                : myScore;

        let winnerId = null;
        if (myScore > opponentScore) winnerId = dbId;
        if (opponentScore > myScore) winnerId = opponent.id;

        const { data } = await supabase
            .from("duel_matches")
            .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                challenger_score: challengerScore,
                opponent_score: opponentScoreValue,
                winner_id: winnerId,
                result_finalized: true,
            })
            .eq("id", duelActiveMatch.id)
            .eq("result_finalized", false)
            .select("id");

        if (data && data.length > 0) {
            await applyDuelTrophies(
                myScore,
                opponentScore,
                duelActiveMatch.question_count,
                opponent.id,
            );
        }
    };

    const handleReportClick = (questionNumber) => {
        setQuestionToReport(questionNumber);
        setReportModalOpen(true);
    };

    const [visualSelection, setVisualSelection] = useState(null);
    const [shuffledMapping, setShuffledMapping] = useState([]);

    useEffect(() => {
        const updateHeight = () => {
            const vh = window.innerHeight;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        };
        updateHeight();
        window.addEventListener("resize", updateHeight);
        window.addEventListener("orientationchange", updateHeight);
        return () => {
            window.removeEventListener("resize", updateHeight);
            window.removeEventListener("orientationchange", updateHeight);
        };
    }, []);

    useEffect(() => {
        window.setShuffledMappingForKeyboard = (mapping) => {
            setShuffledMapping(mapping);
            setVisualSelection(null);
        };
        return () => delete window.setShuffledMappingForKeyboard;
    }, []);

    const handleAnswer = async (idx) => {
        if (finished || mode === "review") return;
        setIsKeyboardMode(true);
        document.body.classList.add("keyboard-mode-active");

        setQuestionSet((prev) => {
            const c = [...prev];
            if (c[currentIndex])
                c[currentIndex] = { ...c[currentIndex], userAnswer: idx };
            return c;
        });
        if (idx !== questionSet[currentIndex].correctIndex) {
            triggerHaptic("error");
            addMistake(questionSet[currentIndex].number);
        } else {
            triggerHaptic("success");
            triggerFakeSync();
        }

        // --- OKAMŽITÉ ULOŽENÍ PRO SMART REŽIM (MANUÁLNÍ KLIK) ---
        if (mode === "smart" && questionSet.length <= SMART_SAVE_LIMIT) {
            const nextSet = [...questionSet];
            if (nextSet[currentIndex])
                nextSet[currentIndex] = {
                    ...nextSet[currentIndex],
                    userAnswer: idx,
                };
            persistSmartSession(nextSet, currentIndex, score);
        }
    };

    const clickFlashcardAnswer = (idx) => {
        if (finished || showResult) return;
        if (idx === null) return;
        const currentQ = questionSet[currentIndex];
        const isCorrect = idx === currentQ.correctIndex;
        const newSet = [...questionSet];
        if (newSet[currentIndex])
            newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: idx };
        setQuestionSet(newSet);
        setSelectedAnswer(idx);
        setShowResult(true);
        setSessionQuestionsCount((prev) => prev + 1);
        setVisualSelection(null);

        if (mode === "test_practice" && activeTest) {
            const currentStats = testPracticeStats[activeTest.id] || [];
            const newStats = [...currentStats, isCorrect].slice(-20);
            saveDataToCloud(undefined, undefined, 0, 0, {
                ...testPracticeStats,
                [activeTest.id]: newStats,
            });
        }

        // Vypočítáme nové skóre pro uložení
        let nextScore = { ...score };

        if (isCorrect) {
            triggerHaptic("success");
            nextScore.correct += 1;
            nextScore.total += 1;
            setScore(nextScore);
            setCombo((c) => c + 1);
            if (mode === "mistakes") removeMistake(currentQ.number);
            else triggerFakeSync();
        } else {
            triggerHaptic("error");
            nextScore.total += 1;
            setScore(nextScore);
            addMistake(currentQ.number);
            if (combo >= 3) {
                setShake(true);
                setTimeout(() => setShake(false), 500);
            }
            setCombo(0);
        }

        // --- OKAMŽITÉ ULOŽENÍ PRO SMART REŽIM (FLASHCARD) ---
        if (mode === "smart" && questionSet.length <= SMART_SAVE_LIMIT) {
            persistSmartSession(newSet, currentIndex, nextScore);
        }
    };

    // --- FUNKCE PRO PŘECHOD NA DALŠÍ OTÁZKU ---
    const nextFlashcardQuestion = () => {
        if (mode === "random" || mode === "test_practice") {
            if (currentIndex >= questionSet.length - 1) setFinished(true);
            else {
                setCurrentIndex((prev) => prev + 1);
                setSelectedAnswer(null);
                setShowResult(false);
            }
        } else if (mode === "smart" || mode === "mistakes") {
            const currentQ = questionSet[0];
            const isCorrect = selectedAnswer === currentQ.correctIndex;
            let newSet = [...questionSet];
            if (isCorrect) newSet.shift();
            else {
                let qToMove = newSet.shift();

                const optionsWithMeta = qToMove.options.map((opt, i) => ({
                    text: opt,
                    isCorrect: i === qToMove.correctIndex,
                }));

                for (let i = optionsWithMeta.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsWithMeta[i], optionsWithMeta[j]] = [
                        optionsWithMeta[j],
                        optionsWithMeta[i],
                    ];
                }

                qToMove = {
                    ...qToMove,
                    options: optionsWithMeta.map((o) => o.text),
                    correctIndex: optionsWithMeta.findIndex((o) => o.isCorrect),
                    userAnswer: undefined,
                    _instanceId: Math.random(),
                };

                newSet.splice(
                    Math.min(newSet.length, 3 + Math.floor(Math.random() * 3)),
                    0,
                    qToMove,
                );
            }

            if (newSet.length === 0) {
                setFinished(true);
                addToHistory(score);
                clearSmartSession(); // Smazat session při dokončení
            } else {
                setQuestionSet(newSet);
                setSelectedAnswer(null);
                setShowResult(false);

            }
        }
    };

    // ... (zbytek funkcí zůstává stejný)

    const confirmFlashcardAnswer = () => {
        if (!finished && !showResult)
            clickFlashcardAnswer(selectedAnswer !== null ? selectedAnswer : -1);
    };
    const selectRandomAnswer = (idx) => {
        if (!finished && !showResult) {
            triggerHaptic("light");
            setVisualSelection(idx);
            setIsKeyboardMode(true);
            document.body.classList.add("keyboard-mode-active");
        }
    };
    const clearAnswer = () => {
        setQuestionSet((prev) => {
            const c = [...prev];
            if (c[currentIndex])
                c[currentIndex] = { ...c[currentIndex], userAnswer: undefined };
            return c;
        });
        setSelectedAnswer(null);
        setShowResult(false);
    };

    const moveToQuestion = (newIdx) => {
        const b = Math.max(0, Math.min(newIdx, questionSet.length - 1));
        if (b < currentIndex) setDirection("left");
        else setDirection("right");

        // Reset content ready state synchronously
        setReadyQuestionId(null);
        setCurrentIndex(b);
        setSelectedAnswer(null);
    };

    const handleSwipe = (dir) => {
        if (
            finished ||
            showConfirmExit ||
            showConfirmSubmit ||
            exitDirection ||
            isSessionBlocked
        )
            return;

        const isFlashcard = isFlashcardStyle(mode) || mode === "test_practice";

        const performAction = () => {
            if (dir === "left") {
                if (isFlashcard) {
                    if (showResult) nextFlashcardQuestion();
                    else if (selectedAnswer !== null) confirmFlashcardAnswer();
                } else if (currentIndex < questionSet.length - 1) {
                    moveToQuestion(currentIndex + 1);
                }
            } else if (dir === "right") {
                if (!isFlashcard && currentIndex > 0) {
                    moveToQuestion(currentIndex - 1);
                }
            }
        };

        if (isFlashcard) {
            performAction();
        } else {
            setExitDirection(dir);
            setTimeout(() => {
                performAction();
                setExitDirection(null);
            }, 80);
        }
    };

    const submitTest = () => {
        const qEval = questionSet;
        const cor = qEval.filter((q) => q.userAnswer === q.correctIndex).length;
        const finalScore = { correct: cor, total: qEval.length };
        const answeredCount = qEval.filter(
            (q) => q.userAnswer !== undefined,
        ).length;
        setSessionQuestionsCount((prev) => prev + answeredCount);
        setScore(finalScore);
        setTimeLeftAtSubmit(timeLeft);
        setFinished(true);
        setShowConfirmSubmit(false);
        addToHistory(finalScore);
    };
    const addToHistory = (s) => {
        if (mode !== "mock") return;
        const newRec = {
            date: new Date().toISOString(),
            mode: mode,
            score: s,
            subject: subject,
            id: Date.now() + "-" + Math.random(),
        };
        updateHistory((prev) => [...prev, newRec]);
    };
    const tryReturnToMenu = () => {
        if (mode === "test_practice") {
            setMode("scheduled_list");
            setCombo(0);
            setShowResult(false);
            setSelectedAnswer(null);
            setVisualSelection(null);
            setShuffledMapping([]);
            setMenuSelection(1);
            setActiveTest(null);
            return;
        }

        // --- UPRAVENÁ LOGIKA PRO SMART MODE (Exit Prompt) ---
        if (
            mode === "smart" &&
            !finished &&
            questionSet.length <= SMART_SAVE_LIMIT
        ) {
            setShowSaveProgressPrompt(true);
            return;
        }

        if (mode === "mock" && !finished) {
            setShowConfirmExit(true);
        } else {
            setMode(null);
            setCombo(0);
            setShowResult(false);
            setSelectedAnswer(null);
            setVisualSelection(null);
            setShuffledMapping([]);
            setMenuSelection(0);
        }
    };

    const confirmExit = () => {
        setShowConfirmExit(false);
        const wasPractice = mode === "test_practice";
        setMode(wasPractice ? "scheduled_list" : null);
        setCombo(0);
        setShowResult(false);
        setSelectedAnswer(null);
        setVisualSelection(null);
        setShuffledMapping([]);
        setMenuSelection(wasPractice ? 1 : 0);
        if (wasPractice) setActiveTest(null);
    };

    const handleSaveAndExit = async (shouldSave) => {
        setShowSaveProgressPrompt(false);
        if (!shouldSave) {
            // Pokud nechce uložit, smažeme session
            const currentSmartSessions = profileData?.smart_session || {};
            const updatedSessions = { ...currentSmartSessions };
            delete updatedSessions[subject];
            await saveData({ smart_session: updatedSessions });
        }

        setMode(null);
        setCombo(0);
        setShowResult(false);
        setSelectedAnswer(null);
        setMenuSelection(0);
    };

    const handleFileUpload = (questions) => {
        if (!questions) return;
        const norm = questions.map((q, i) => ({
            number: q.number ?? i + 1,
            question: q.question ?? `Otázka ${i + 1}`,
            options: q.options || [],
            correctIndex: q.correctIndex ?? 0,
        }));
        setCustomQuestions(norm);
        setSubject("CUSTOM");
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSessionBlocked) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
                return;
            if (e.repeat) return;
            if (
                (e.key === "Enter" || e.key === " ") &&
                e.target.tagName === "BUTTON"
            )
                return;

            if (!isKeyboardMode) {
                setIsKeyboardMode(true);
                document.body.classList.add("keyboard-mode-active");
            }
            if (
                [
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    " ",
                    "f",
                    "F",
                ].includes(e.key)
            )
                e.preventDefault();
            if (
                showConfirmExit ||
                showConfirmSubmit ||
                showSmartSettings ||
                showClearMistakesConfirm ||
                recordToDelete ||
                reportModalOpen ||
                testToStart ||
                showResumePrompt ||
                showSaveProgressPrompt
            ) {
                if (e.key === "Escape") {
                    setShowConfirmExit(false);
                    setShowConfirmSubmit(false);
                    setShowSmartSettings(false);
                    setShowClearMistakesConfirm(false);
                    setRecordToDelete(null);
                    setReportModalOpen(false);
                    setTestToStart(null);
                    setShowResumePrompt(false);
                    setShowSaveProgressPrompt(false);
                    return;
                }
                if (e.key === "Enter") {
                    if (showConfirmExit) tryReturnToMenu();
                    if (showConfirmSubmit) submitTest();
                    if (showClearMistakesConfirm) clearMistakes();
                    if (recordToDelete) handleDeleteRecordConfirm();
                    if (testToStart) confirmStartTest();
                    if (showResumePrompt) resumeSmartSession();
                    if (showSaveProgressPrompt) handleSaveAndExit(true);
                    return;
                }
                return;
            }

            if (e.key === "f" || e.key === "F") {
                if (fullscreenImage) setFullscreenImage(null);
                return;
            }
            if (fullscreenImage) {
                if (
                    e.key === "Escape" ||
                    e.key === "f" ||
                    e.key === "F" ||
                    e.key === "Enter"
                )
                    setFullscreenImage(null);
                return;
            }
            if (finished || mode === "no_mistakes") {
                if (
                    [
                        "Backspace",
                        "Enter",
                        "ArrowLeft",
                        "a",
                        "A",
                        "Escape",
                    ].includes(e.key)
                ) {
                    setMode(null);
                    setMenuSelection(0);
                }
                return;
            }

            if (!mode) {
                const k = e.key.toLowerCase();
                if (!subject) {
                    const subjectCount = 3;
                    if (k === "w" || k === "arrowup")
                        setMenuSelection(
                            (p) => (p - 1 + subjectCount) % subjectCount,
                        );
                    else if (k === "s" || k === "arrowdown")
                        setMenuSelection((p) => (p + 1) % subjectCount);
                    else if (
                        k === "d" ||
                        k === "arrowright" ||
                        e.key === "Enter" ||
                        e.key === " "
                    ) {
                        const subjects = ["sps", "stt", "CUSTOM"];
                        handleSelectSubject(subjects[menuSelection]);
                    }
                    return;
                }
                const hasScheduled = scheduledTests.length > 0;
                const menuMapping = [];
                const modeCount = 9;
                const getNextIndex = (current, dir) => {
                    let next = current;
                    let safety = 0;
                    do {
                        next = (next + dir + modeCount) % modeCount;
                        safety++;
                        const isVisible =
                            next === 0 ||
                            (next === 1 && hasScheduled) ||
                            next === 2 ||
                            next === 3 ||
                            next === 4 ||
                            next === 5 ||
                            (next === 6 && isTeacher) ||
                            next === 7 ||
                            next === 8;
                        if (isVisible) return next;
                    } while (safety < 20);
                    return next;
                };

                if (k === "w" || k === "arrowup")
                    setMenuSelection((p) => getNextIndex(p, -1));
                else if (k === "s" || k === "arrowdown")
                    setMenuSelection((p) => getNextIndex(p, 1));
                else if (k === "a" || k === "arrowleft") {
                    if (subject) setSubject(null);
                } else if (
                    k === "d" ||
                    k === "arrowright" ||
                    e.key === "Enter"
                ) {
                    if (!subject) {
                        if (menuSelection === 0) handleSelectSubject("SPS");
                        else if (menuSelection === 1)
                            handleSelectSubject("STT");
                        else if (menuSelection === 2)
                            document
                                .querySelector("input[type='file']")
                                ?.click();
                        else if (menuSelection === 3 && user === "admin")
                            setMode("admin");
                    } else {
                        let selection = menuSelection % modeCount;
                        if (selection < 0) selection += modeCount;
                        if (selection === 0)
                            handleStartMode(startMockTest, "mock");
                        else if (selection === 1 && hasScheduled)
                            setMode("scheduled_list");
                        else if (selection === 2)
                            handleStartMode(startNewSmartSession, "smart");
                        else if (selection === 3)
                            handleStartMode(startRandomMode, "random");
                        else if (selection === 4) setMode("duel");
                        else if (selection === 5)
                            handleStartMode(startReviewMode, "review");
                        else if (selection === 6) {
                            if (isTeacher) setMode("teacher_manager");
                        } else if (selection === 7)
                            handleStartMode(startMistakesMode, "mistakes");
                        else if (selection === 8) openHistoryWithRefresh();
                    }
                } else if (
                    k === "a" ||
                    k === "arrowleft" ||
                    k === "backspace"
                ) {
                    if (subject) setSubject(null);
                }
                return;
            }
            if (mode === "duel" || mode === "duel_match") return;
            if (!mode || mode === "real_test") return;
            const opts = questionSet[currentIndex]?.options?.length || 4;
            const isFlashcardInput =
                isFlashcardStyle(mode) || mode === "test_practice";
            const k = e.key.toLowerCase();

            if (k === "w" || e.key === "ArrowUp") {
                if (isFlashcardInput && !showResult) {
                    const nextVisual =
                        visualSelection === null
                            ? opts - 1
                            : (visualSelection - 1 + opts) % opts;
                    selectRandomAnswer(nextVisual);
                } else if (!isFlashcardInput)
                    handleAnswer(
                        questionSet[currentIndex].userAnswer === undefined
                            ? opts - 1
                            : (questionSet[currentIndex].userAnswer -
                                  1 +
                                  opts) %
                                  opts,
                    );
            }
            if (k === "s" || e.key === "ArrowDown") {
                if (isFlashcardInput && !showResult) {
                    const nextVisual =
                        visualSelection === null
                            ? 0
                            : (visualSelection + 1) % opts;
                    selectRandomAnswer(nextVisual);
                } else if (!isFlashcardInput)
                    handleAnswer(
                        questionSet[currentIndex].userAnswer === undefined
                            ? 0
                            : (questionSet[currentIndex].userAnswer + 1) % opts,
                    );
            }
            if (k === "a" || e.key === "ArrowLeft") {
                if (isFlashcardInput) return;
                if (mode === "history") {
                    setMode(null);
                    return;
                }
                if (currentIndex > 0) moveToQuestion(currentIndex - 1);
            }
            if (k === "d" || e.key === "ArrowRight" || e.key === "Enter") {
                if (mode === "history") return;
                if (isFlashcardInput) {
                    if (showResult) nextFlashcardQuestion();
                    else {
                        const finalIdx =
                            visualSelection !== null
                                ? (shuffledMapping[visualSelection] ??
                                  selectedAnswer)
                                : selectedAnswer;
                        clickFlashcardAnswer(finalIdx);
                    }
                } else if (currentIndex < questionSet.length - 1) {
                    moveToQuestion(currentIndex + 1);
                }
            }
            if (e.key === " ") {
                if (mode === "history") return;
                if (isFlashcardInput && !showResult) {
                    const finalIdx =
                        visualSelection !== null
                            ? (shuffledMapping[visualSelection] ??
                              selectedAnswer)
                            : selectedAnswer;
                    clickFlashcardAnswer(finalIdx);
                } else if (!finished && mode === "mock")
                    setShowConfirmSubmit(true);
            }
            if (e.key === "Backspace") {
                if (mode === "history") {
                    setMode(null);
                    return;
                }
                clearAnswer();
            }
            if (e.key === "Escape") {
                if (mode === "history") {
                    setMode(null);
                    return;
                }
                tryReturnToMenu();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        mode,
        questionSet,
        currentIndex,
        showResult,
        selectedAnswer,
        showConfirmSubmit,
        showConfirmExit,
        finished,
        menuSelection,
        subject,
        user,
        fullscreenImage,
        reportModalOpen,
        isSessionBlocked,
        testToStart,
        visualSelection,
        shuffledMapping,
        showResumePrompt,
        showSaveProgressPrompt,
    ]);

    useEffect(() => {
        if (
            finished ||
            (mode !== "mock" && mode !== "smart" && mode !== "mistakes")
        )
            return;
        const interval = setInterval(() => {
            if (mode === "mock") setTimeLeft((p) => Math.max(0, p - 1));
            else setTrainingTime((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, finished]);
    useEffect(() => {
        if (mode === "mock" && timeLeft === 0 && !finished) submitTest();
    }, [timeLeft, mode, finished]);

    const [showCustomImport, setShowCustomImport] = useState(false);

    useEffect(() => {
        window.handleCustomImport = (questions) => {
            handleFileUpload(questions);
            setShowCustomImport(false);
        };
        return () => delete window.handleCustomImport;
    }, [activeQuestionsCache]);

    if (showCustomImport) {
        return <CustomImportGuide onBack={() => setShowCustomImport(false)} />;
    }

    if (!user)
        return (
            <>
                <div
                    style={{
                        position: "absolute",
                        top: "1rem",
                        right: "1rem",
                        zIndex: 100,
                    }}
                >
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
                <CloudLoginScreen onLogin={login} loading={loading} />
            </>
        );

    if (isSessionBlocked)
        return <SessionBlockedScreen onTakeOver={takeOverSession} />;

    if (mode === "leaderboard") {
        return (
            <div
                className="container fadeIn"
                style={{
                    minHeight: "calc(var(--vh, 1vh) * 100)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                }}
            >
                <div className="top-navbar" style={{ width: "100%" }}>
                    <div className="navbar-group">
                        <button
                            className="menuBackButton"
                            onClick={() => setMode(null)}
                        >
                            ←{" "}
                            <span className="mobile-hide-text">
                                Zpět do menu
                            </span>
                        </button>
                    </div>
                    <div className="navbar-group">
                        <UserBadgeDisplay
                            user={user}
                            syncing={syncing}
                            onLogout={handleLogout}
                        />
                        <ThemeToggle
                            currentTheme={theme}
                            toggle={toggleTheme}
                        />
                    </div>
                </div>
                <div
                    style={{
                        width: "100%",
                        maxWidth: "900px",
                        padding: "1.5rem 1rem 2rem",
                    }}
                >
                    <LeaderboardPanel
                        entries={leaderboardEntries}
                        loading={leaderboardLoading}
                        error={leaderboardError}
                        currentUser={user}
                        title={`Žebříček třídy ${leaderboardClass}`}
                        className="leaderboard-full"
                    />
                </div>
            </div>
        );
    }

    if (mode === "teacher_manager") {
        if (!isTeacher) {
            setMode(null);
            return null;
        }
        return (
            <TestManager
                onBack={() => setMode(null)}
                subject={subject}
                isTeacher={isTeacher}
                user={user}
                syncing={syncing}
                theme={theme}
                toggleTheme={toggleTheme}
            />
        );
    }

    if (mode === "scheduled_list") {
        return (
            <>
                <ScheduledTestsList
                    scheduledTests={scheduledTests}
                    onBack={() => setMode(null)}
                    subject={subject}
                    user={user}
                    syncing={syncing}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onStartGradedTest={startGradedTest}
                    onStartPractice={startTestPractice}
                    completedTestIds={completedTestIds}
                    testPracticeStats={testPracticeStats}
                    onRefresh={handleManualRefresh}
                />
                {testToStart && (
                    <ConfirmModal
                        title={`Spustit test "${testToStart.title}"?`}
                        message={
                            <div style={{ textAlign: "left" }}>
                                <p style={{ marginBottom: "1rem" }}>
                                    Chystáte se spustit ostrý test.
                                </p>
                                <ul
                                    style={{
                                        paddingLeft: "1.2rem",
                                        color: "var(--color-text-secondary)",
                                        fontSize: "0.95rem",
                                        lineHeight: "1.5",
                                    }}
                                >
                                    <li>
                                        Do testu lze vstoupit{" "}
                                        <strong>pouze jednou</strong>.
                                    </li>
                                    <li>
                                        Jakmile test spustíte, začne běžet
                                        časový limit ({testToStart.time_limit}{" "}
                                        min).
                                    </li>
                                    <li>
                                        Test nelze přerušit ani se k němu vrátit
                                        později.
                                    </li>
                                    <li>
                                        Ujistěte se, že máte stabilní připojení
                                        k internetu.
                                    </li>
                                </ul>
                            </div>
                        }
                        onCancel={() => setTestToStart(null)}
                        onConfirm={confirmStartTest}
                        confirmText="Spustit test"
                        danger={false}
                    />
                )}
            </>
        );
    }

    if (mode === "real_test") {
        return (
            <RealTestMode
                test={activeTest}
                initialQuestions={questionSet}
                user={user}
                userId={dbId}
                onExit={() => setMode(null)}
                onFinish={() => setMode(null)}
                theme={theme}
                toggleTheme={toggleTheme}
                syncing={syncing}
                onReport={handleReportClick}
                onTestCompleted={handleTestCompletion}
            />
        );
    }

    if (!mode) {
        if (!subject || isTransitioningSubject)
            return (
                <div
                    className="container fadeIn"
                    style={{
                        minHeight: "calc(var(--vh, 1vh) * 100)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        paddingBottom: "1.5rem",
                    }}
                >
                    {isLoadingQuestions || isTransitioningSubject ? (
                        <div
                            style={{
                                padding: "2rem",
                                fontSize: "1.2rem",
                                color: "#888",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                flex: 1,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "3rem",
                                    marginBottom: "1rem",
                                }}
                            >
                                ⏳
                            </div>
                            Načítám otázky a obrázky...
                        </div>
                    ) : (
                        <>
                            <div
                                className="top-navbar navbar-tiered"
                                style={{ width: "100%" }}
                            >
                                <div className="navbar-group nav-primary">
                                    {user === "admin" && (
                                        <button
                                            className="menuBackButton"
                                            onClick={() => setMode("admin")}
                                            title="Admin Panel"
                                        >
                                            🛠️ Admin
                                        </button>
                                    )}
                                </div>
                                {subject && (
                                    <div className="navbar-group nav-status">
                                        <SubjectBadge
                                            subject={subject}
                                            compact
                                            matchUserBadge
                                        />
                                    </div>
                                )}
                                <div className="navbar-group nav-actions">
                                    <UserBadgeDisplay
                                        user={user}
                                        syncing={syncing}
                                        onLogout={handleLogout}
                                        alwaysShowFullName={true}
                                    />
                                    <ThemeToggle
                                        currentTheme={theme}
                                        toggle={toggleTheme}
                                    />
                                </div>
                            </div>
                            <div
                                style={{
                                    flexGrow: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    width: "100%",
                                }}
                            >
                                <div className="subject-menu-layout">
                                    <div className="subject-menu-main">
                                        <SubjectSelector
                                            menuSelection={menuSelection}
                                            onSelectSubject={handleSelectSubject}
                                            onUploadFile={handleFileUpload}
                                            isKeyboardMode={isKeyboardMode}
                                            setIsKeyboardMode={
                                                setIsKeyboardMode
                                            }
                                        />
                                        <button
                                            className="leaderboard-mobile-button"
                                            onClick={() =>
                                                setMode("leaderboard")
                                            }
                                        >
                                            🏆 Žebříček třídy
                                        </button>
                                    </div>
                                    <div className="leaderboard-desktop">
                                        <LeaderboardPanel
                                            entries={leaderboardEntries}
                                            loading={leaderboardLoading}
                                            error={leaderboardError}
                                            title={`Žebříček třídy ${leaderboardClass}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    <div style={{ height: "1px" }}></div>
                </div>
            );

        const mistakesCount = mistakes[subject]?.length || 0;
        return (
            <>
                <ReportModal
                    isOpen={reportModalOpen}
                    onClose={() => {
                        setReportModalOpen(false);
                        setQuestionToReport(null);
                    }}
                    theme={theme}
                    {...(() => {
                        let activeReportQuestion = currentQuestion;
                        if (questionToReport) {
                            const found = questionSet.find(
                                (q) => q.number === questionToReport,
                            );
                            if (found) activeReportQuestion = found;
                        }
                        const qForModal = activeReportQuestion || {};
                        return {
                            questionText: qForModal.question,
                            questionId: qForModal.id,
                            subject: qForModal.subject,
                            questionNumber: qForModal.number,
                            options: qForModal.options,
                            correctIndex: qForModal.correctIndex,
                            userAnswer: qForModal.userAnswer,
                        };
                    })()}
                    mode={mode}
                    username={user}
                    userId={dbId}
                    isExiting={!!exitDirection}
                />

                {showSmartSettings && (
                    <SmartSettingsModal
                        onStart={startNewSmartSession}
                        onCancel={() => setShowSmartSettings(false)}
                        totalQuestions={activeQuestionsCache.length}
                    />
                )}

                {showResumePrompt && (
                    <ConfirmModal
                        title="Nalezen rozpracovaný balíček"
                        message={
                            <div>
                                <p>Máš uložený nedokončený balíček z minula.</p>
                                <p>Chceš v něm pokračovat?</p>
                            </div>
                        }
                        onCancel={() => {
                            setShowResumePrompt(false);
                            setShowSmartSettings(true);
                        }}
                        onConfirm={resumeSmartSession}
                        confirmText="Pokračovat"
                        cancelText="Nový balíček"
                        danger={false}
                    />
                )}

                {showClearMistakesConfirm && (
                    <ConfirmModal
                        title="Vynulovat opravnu?"
                        message="Smazat chyby z cloudu?"
                        onCancel={() => setShowClearMistakesConfirm(false)}
                        onConfirm={clearMistakes}
                        confirmText="Smazat"
                        danger={true}
                    />
                )}

                <div
                    ref={containerRef}
                    className="container fadeIn"
                    style={{
                        minHeight: "calc(var(--vh, 1vh) * 100)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        alignItems: "center",
                    }}
                >
                    {!isLoadingQuestions && (
                        <div
                            className="top-navbar navbar-tiered"
                            style={{ width: "100%" }}
                        >
                            <div className="navbar-group nav-primary">
                                <button
                                    className="menuBackButton"
                                    onClick={() => {
                                        flushSessionStats();
                                        clearImageCache();
                                        setSubject(null);
                                    }}
                                >
                                    ←{" "}
                                    <span className="mobile-hide-text">
                                        Změnit předmět
                                    </span>
                                </button>
                            </div>
                            {subject && (
                                <div className="navbar-group nav-status">
                                    <div className="subjectBadgeGroup">
                                        <SubjectBadge
                                            subject={subject}
                                            compact
                                            matchUserBadge
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="navbar-group nav-actions">
                                <UserBadgeDisplay
                                    user={user}
                                    syncing={syncing}
                                    onLogout={handleLogout}
                                />
                                <ThemeToggle
                                    currentTheme={theme}
                                    toggle={toggleTheme}
                                />
                            </div>
                        </div>
                    )}
                    {isLoadingQuestions || mode === "loading" ? (
                        <div
                            style={{
                                padding: "2rem",
                                fontSize: "1.2rem",
                                color: "#888",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                flex: 1,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "3rem",
                                    marginBottom: "1rem",
                                }}
                            >
                                ⏳
                            </div>
                            Načítám otázky a obrázky...
                        </div>
                    ) : (
                        <MainMenu
                            scheduledTests={scheduledTests}
                            completedTestIds={completedTestIds}
                            menuSelection={menuSelection}
                            isKeyboardMode={isKeyboardMode}
                            isTeacher={isTeacher}
                            userClass={profileData?.class}
                user={user}
                syncing={syncing}
                theme={theme}
                toggleTheme={toggleTheme}
                            mistakesCount={mistakesCount}
                            onOpenScheduled={() => setMode("scheduled_list")}
                            onStartMock={() =>
                                handleStartMode(startMockTest, "mock")
                            }
                            onStartSmart={() =>
                                handleStartMode(startNewSmartSession, "smart")
                            }
                            onStartRandom={() =>
                                handleStartMode(startRandomMode, "random")
                            }
                            onStartDuel={() => setMode("duel")}
                            onStartReview={() =>
                                handleStartMode(startReviewMode, "review")
                            }
                            onOpenTeacherManager={() =>
                                setMode("teacher_manager")
                            }
                            onStartMistakes={() =>
                                handleStartMode(startMistakesMode, "mistakes")
                            }
                            onClearMistakes={() =>
                                setShowClearMistakesConfirm(true)
                            }
                            onOpenHistory={openHistoryWithRefresh}
                        />
                    )}
                </div>
            </>
        );
    }

    if (mode === "admin") return <AdminPanel onBack={() => setMode(null)} />;
    if (mode === "no_mistakes")
        return (
            <NoMistakesScreen onBack={() => setMode(null)} subject={subject} />
        );

    if (mode === "history")
        return (
            <>
                <HistoryView
                    history={history}
                    totalTimeMap={totalTimeMap}
                    sessionTime={sessionTime}
                    totalQuestionsMap={totalQuestionsMap}
                    sessionQuestionsCount={sessionQuestionsCount}
                    onBack={() => setMode(null)}
                    currentSubject={subject}
                    onDeleteRecord={setRecordToDelete}
                    user={user}
                    syncing={syncing}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
                {recordToDelete && (
                    <ConfirmModal
                        title="Smazat záznam?"
                        message="Smazat tento záznam?"
                        onCancel={() => setRecordToDelete(null)}
                        onConfirm={() => {
                            updateHistory((prev) =>
                                prev.filter((h) => h.id !== recordToDelete),
                            );
                            setRecordToDelete(null);
                        }}
                        confirmText="Smazat"
                        danger={true}
                    />
                )}
            </>
        );

    if (mode === "review") {
        const REVIEW_COLUMNS = window.innerWidth > 768 ? 2 : 1;
        const REVIEW_ROWS = 5;
        const REVIEW_ITEMS_PER_PAGE = REVIEW_COLUMNS * REVIEW_ROWS;
        const normalizedSearch = removeAccents(searchTerm);
        const filteredQuestions = questionSet.filter(
            (q) =>
                removeAccents(q.question).includes(normalizedSearch) ||
                String(q.number).includes(normalizedSearch),
        );
        const highlightRegex = getSmartRegex(searchTerm);
        const totalReviewPages = Math.ceil(
            filteredQuestions.length / REVIEW_ITEMS_PER_PAGE,
        );
        const paginatedQuestions = filteredQuestions.slice(
            reviewPage * REVIEW_ITEMS_PER_PAGE,
            (reviewPage + 1) * REVIEW_ITEMS_PER_PAGE,
        );

        const scrollToTop = () => {
            if (containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        };

        return (
            <>
                <CustomImageModal
                    src={fullscreenImage}
                    onClose={() => setFullscreenImage(null)}
                />
                {(() => {
                    let activeReportQuestion = currentQuestion;
                    if (questionToReport) {
                        const found = activeQuestionsCache.find(
                            (q) => q.number === questionToReport,
                        );
                        if (found) activeReportQuestion = found;
                    }
                    const qForModal = activeReportQuestion || {};
                    return (
                        <ReportModal
                            isOpen={reportModalOpen}
                            onClose={() => {
                                setReportModalOpen(false);
                                setQuestionToReport(null);
                            }}
                            theme={theme}
                            questionText={qForModal.question}
                            questionId={qForModal.id}
                            subject={qForModal.subject || subject}
                            questionNumber={qForModal.number}
                            mode={mode}
                            options={qForModal.options}
                            correctIndex={qForModal.correctIndex}
                            userAnswer={qForModal.userAnswer}
                            username={user}
                            userId={dbId}
                            isExiting={!!exitDirection}
                        />
                    );
                })()}
                <div
                    className="container fadeIn"
                    style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
                >
                    <div
                        className="top-navbar navbar-tiered"
                        style={{ width: "100%" }}
                    >
                        <div className="navbar-group nav-primary">
                            <button
                                className="menuBackButton"
                                onClick={() => {
                                    flushSessionStats();
                                    tryReturnToMenu();
                                }}
                            >
                                ← <span className="mobile-hide-text">Zpět</span>
                            </button>
                        </div>
                        <div className="navbar-group nav-status">
                            <div className="subjectBadgeGroup">
                                <SubjectBadge
                                    subject={subject}
                                    compact
                                    matchUserBadge
                                />
                                <span className="subjectBadgeDivider">|</span>
                                <div className="modeBadge">
                                    <span className="modeBadgeIcon">🔎</span>
                                    <span>Prohlížení otázek</span>
                                </div>
                            </div>
                        </div>
                        <div className="navbar-group nav-actions">
                            <UserBadgeDisplay user={user} syncing={syncing} />
                            <ThemeToggle
                                currentTheme={theme}
                                toggle={toggleTheme}
                            />
                        </div>
                    </div>
                    <div className="reviewControls">
                        <input
                            type="text"
                            placeholder="Hledat..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setReviewPage(0);
                            }}
                            className="reviewSearchInput"
                        />
                        {totalReviewPages > 1 && (
                            <div className="reviewPageInfo">
                                Strana {reviewPage + 1} z {totalReviewPages} (
                                {filteredQuestions.length} otázek)
                            </div>
                        )}
                    </div>
                    <div className="reviewGrid">
                        {paginatedQuestions.length === 0 ? (
                            <p
                                style={{
                                    textAlign: "center",
                                    color: "#888",
                                    gridColumn: "1/-1",
                                }}
                            >
                                Nic nenalezeno.
                            </p>
                        ) : (
                            paginatedQuestions.map((q) => {
                                const imageUrl =
                                    q.image_base64 ||
                                    (q.id ? getCachedImage(q.id) : null) ||
                                    getImageUrl(subject, q.number) ||
                                    (q.image && q.image.length > 5
                                        ? q.image
                                        : null);
                                return (
                                    <div
                                        key={`${q.number}-${reviewPage}`}
                                        className="reviewCard"
                                    >
                                        <div
                                            className="reviewHeader"
                                            style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: "10px",
                                                position: "relative",
                                            }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <strong>#{q.number}.</strong>{" "}
                                                <HighlightedText
                                                    text={q.question}
                                                    highlightRegex={
                                                        highlightRegex
                                                    }
                                                />
                                            </div>
                                            <button
                                                className="report-btn-flash"
                                                onClick={() =>
                                                    handleReportClick(q.number)
                                                }
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    padding: "4px",
                                                    width: "32px",
                                                    height: "32px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    cursor: "pointer",
                                                    fontSize: "1.1rem",
                                                    flexShrink: 0,
                                                    opacity: 0.7,
                                                    marginTop: "-2px",
                                                }}
                                                title="Nahlásit chybu v této otázce"
                                            >
                                                🏳️
                                            </button>
                                        </div>
                                        <ReviewImage
                                            q={q}
                                            subject={subject}
                                            setFullscreenImage={
                                                setFullscreenImage
                                            }
                                        />
                                        <div
                                            style={{
                                                marginTop: "1rem",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.4rem",
                                            }}
                                        >
                                            {q.options.map((opt, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        fontSize: "0.9rem",
                                                        color:
                                                            idx ===
                                                            q.correctIndex
                                                                ? "var(--color-review-correct)"
                                                                : "var(--color-text-secondary)",
                                                        fontWeight:
                                                            idx ===
                                                            q.correctIndex
                                                                ? "bold"
                                                                : "normal",
                                                    }}
                                                >
                                                    <span>
                                                        {idx === q.correctIndex
                                                            ? "✅"
                                                            : "•"}
                                                    </span>{" "}
                                                    <span>
                                                        <HighlightedText
                                                            text={opt}
                                                            highlightRegex={
                                                                highlightRegex
                                                            }
                                                        />
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <ReviewNavigator
                        currentPage={reviewPage}
                        totalPages={totalReviewPages}
                        onPageChange={(page) => {
                            setReviewPage(page);
                        }}
                    />
                </div>
            </>
        );
    }

    let comboClass =
        combo >= 10
            ? "combo-high"
            : combo >= 5
              ? "combo-med"
              : combo >= 3
                ? "combo-low"
                : "";
    let remainingCards = 0;
    if (mode === "smart" || mode === "mistakes")
        remainingCards = questionSet.length;
    else if (mode === "random" || mode === "test_practice")
        remainingCards = questionSet.length - currentIndex;

    let stackLevelClass = "";
    if (remainingCards <= 1) stackLevelClass = "stack-level-0";
    else if (remainingCards === 2) stackLevelClass = "stack-level-1";

    const modeBadgeMap = {
        mock: { label: "Test nanečisto", icon: "✅" },
        random: { label: "Flashcards", icon: "🧠" },
        mistakes: { label: "Opravna chyb", icon: "🚑" },
        smart: { label: "Chytré učení", icon: "🎓" },
        test_practice: { label: "Procvičit otázky", icon: "📅" },
        training: { label: "Tréninkový režim", icon: "🎯" },
    };
    const modeBadge = modeBadgeMap[mode] || null;

    return (
        <>
            <CustomImageModal
                src={fullscreenImage}
                onClose={() => setFullscreenImage(null)}
            />
            {(() => {
                let activeReportQuestion = currentQuestion;
                if (questionToReport) {
                    const found = activeQuestionsCache.find(
                        (q) => q.number === questionToReport,
                    );
                    if (found) activeReportQuestion = found;
                }
                const qForModal = activeReportQuestion || {};
                return (
                    <ReportModal
                        isOpen={reportModalOpen}
                        onClose={() => {
                            setReportModalOpen(false);
                            setQuestionToReport(null);
                        }}
                        theme={theme}
                        questionText={qForModal.question}
                        questionId={qForModal.id}
                        subject={qForModal.subject || subject}
                        questionNumber={qForModal.number}
                        mode={mode}
                        options={qForModal.options}
                        correctIndex={qForModal.correctIndex}
                        userAnswer={qForModal.userAnswer}
                        username={user}
                        userId={dbId}
                        isExiting={!!exitDirection}
                    />
                );
            })()}

            <div
                className="container fadeIn"
                style={{
                    minHeight: "calc(var(--vh, 1vh) * 100)",
                    paddingBottom: "2rem",
                }}
            >
                {showConfirmSubmit && (
                    <ConfirmModal
                        title={
                            mode === "real_test"
                                ? "Odevzdat test?"
                                : "Odevzdat?"
                        }
                        message={
                            mode === "real_test"
                                ? "Po odevzdání už nepůjde odpovědi změnit."
                                : "Opravdu odevzdat?"
                        }
                        onCancel={() => setShowConfirmSubmit(false)}
                        onConfirm={mode === "real_test" ? () => {} : submitTest}
                        confirmText={mode === "real_test" ? "ODEVZDAT" : "Ano"}
                        danger={mode === "real_test"}
                    />
                )}
                {showConfirmExit && (
                    <ConfirmModal
                        title="Ukončit?"
                        message="Ztracené odpovědi nebudou uloženy."
                        onCancel={() => setShowConfirmExit(false)}
                        onConfirm={confirmExit}
                        confirmText="Ukončit"
                    />
                )}

                {/* --- SAVE PROGRESS PROMPT --- */}
                {showSaveProgressPrompt && (
                    <ConfirmModal
                        title="Uložit postup?"
                        message={
                            <div>
                                <p>
                                    Chceš si uložit aktuální postup na příště?
                                </p>
                            </div>
                        }
                        onCancel={() => handleSaveAndExit(false)} // Ne = smazat a odejít
                        onConfirm={() => handleSaveAndExit(true)} // Ano = nechat uloženo a odejít
                        confirmText="Uložit a odejít"
                        cancelText="Neukládat"
                        danger={false}
                    />
                )}

                {finished && (
                    <ResultScreen
                        mode={mode}
                        score={score}
                        trainingTime={trainingTime}
                        questionSet={questionSet}
                        maxSeenIndex={maxSeenIndex}
                        // --- OPRAVA: PŘIDÁNÍ LOGIKY ONBACK ---
                        onBack={() => {
                            if (mode === "smart") {
                                clearSmartSession();
                            }
                            setMode(null);
                            setCombo(0);
                        }}
                        // ------------------------------------

                        currentSubject={subject}
                        timeLeftAtSubmit={timeLeftAtSubmit}
                        onZoom={setFullscreenImage}
                        user={user}
                        syncing={syncing}
                        onReport={handleReportClick}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                )}

                {mode === "loading" && (
                    <div
                        className="fadeIn"
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            height: "100dvh",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "var(--color-bg-body)",
                            zIndex: 9999,
                            backdropFilter: "blur(5px)",
                        }}
                    >
                        <div
                            className="card"
                            style={{
                                padding: "2.5rem 2rem",
                                width: "90%",
                                maxWidth: "400px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "1.5rem",
                                boxShadow:
                                    "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                                border: "1px solid var(--color-border)",
                                textAlign: "center",
                            }}
                        >
                            <div
                                style={{
                                    transform: "scale(1.2)",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                <SubjectBadge subject={subject} />
                            </div>

                            <div className="custom-loader"></div>

                            <div>
                                <h2
                                    style={{
                                        margin: 0,
                                        fontSize: "1.4rem",
                                        fontWeight: "700",
                                    }}
                                >
                                    {activeTest
                                        ? "Příprava testu"
                                        : "Načítám data"}
                                </h2>
                                <p
                                    style={{
                                        margin: "0.5rem 0 0",
                                        color: "var(--color-text-secondary)",
                                        fontSize: "0.95rem",
                                    }}
                                >
                                    Kompletuji otázky a stahuji obrázky...
                                </p>
                            </div>

                            <div
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        height: "8px",
                                        background: "var(--color-bg-secondary)",
                                        borderRadius: "99px",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${loadingProgress}%`,
                                            height: "100%",
                                            background: "var(--color-primary)",
                                            transition: "width 0.3s ease-out",
                                            borderRadius: "99px",
                                        }}
                                    ></div>
                                </div>
                                <span
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "var(--color-text-secondary)",
                                        fontWeight: "bold",
                                    }}
                                >
                                    {Math.round(loadingProgress)}%
                                </span>
                            </div>

                            <style>{`
                                .custom-loader {
                                    width: 40px;
                                    height: 40px;
                                    border: 4px solid var(--color-bg-secondary);
                                    border-top: 4px solid var(--color-primary);
                                    border-radius: 50%;
                                    animation: spin 1s linear infinite;
                                }
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                            `}</style>
                        </div>
                    </div>
                )}
                {!finished && mode !== "loading" && (
                    <>
                        <div className="top-navbar navbar-tiered" style={{ width: "100%" }}>
                            <div className="navbar-group nav-primary">
                                {mode === "real_test" ? (
                                    <span
                                        style={{
                                            fontWeight: "bold",
                                            color: "var(--color-error)",
                                        }}
                                    >
                                        ⚠️ TEST: NEOPOUŠTĚJ OKNO!
                                    </span>
                                ) : (
                                    <button
                                        className="menuBackButton"
                                        onClick={tryReturnToMenu}
                                    >
                                        ←{" "}
                                        <span className="mobile-hide-text">
                                            Zpět
                                        </span>
                                    </button>
                                )}
                            </div>
                            <div className="navbar-group nav-status">
                                <div className="subjectBadgeGroup">
                                    <SubjectBadge subject={subject} compact matchUserBadge />
                                    {modeBadge && (
                                        <>
                                            <span className="subjectBadgeDivider">
                                                |
                                            </span>
                                            <div className="modeBadge">
                                                <span className="modeBadgeIcon">
                                                    {modeBadge.icon}
                                                </span>
                                                <span>{modeBadge.label}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {mode === "mock" && (
                                    <div
                                        className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}
                                    >
                                        {formatTime(timeLeft)}
                                    </div>
                                )}
                                {(mode === "training" ||
                                    mode === "smart" ||
                                    mode === "mistakes") && (
                                    <div className="timer">
                                        {formatTime(trainingTime)}
                                    </div>
                                )}
                            </div>
                            <div className="navbar-group nav-actions">
                                <UserBadgeDisplay
                                    user={user}
                                    syncing={syncing}
                                    compactOnMobile={true}
                                />
                                <ThemeToggle
                                    currentTheme={theme}
                                    toggle={toggleTheme}
                                />
                            </div>
                        </div>
                        <div className="quizContentWrapper">

                            {isFlashcardStyle(mode) ||
                            mode === "test_practice" ? (
                                <div
                                    className={`flashcardHeader ${comboClass}`}
                                >
                                    {mode !== "test_practice" && (
                                        <div className="statItem">
                                            <span className="statLabel">
                                                {mode === "random"
                                                    ? "Zodpovězeno"
                                                    : "Zbývá"}
                                            </span>
                                            <span
                                                className={`statValue ${mode === "smart" && smartCountAnim ? "statValue-anim" : ""}`}
                                                data-prev={
                                                    mode === "smart" &&
                                                    smartCountAnim &&
                                                    smartPrevCount !== null
                                                        ? smartPrevCount
                                                        : undefined
                                                }
                                            >
                                                {mode === "random"
                                                    ? currentIndex
                                                    : remainingCards}
                                            </span>
                                        </div>
                                    )}
                                    {combo >= 3 && (
                                        <div className="comboContainer">
                                            <div className="comboFlame">🔥</div>
                                            <div className="comboCount">
                                                {combo}x
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className="statItem"
                                        style={{
                                            textAlign: "right",
                                            marginLeft: "auto",
                                        }}
                                    >
                                        <span className="statLabel">
                                            Úspěšnost
                                        </span>
                                        <span className="statValue">
                                            {mode === "test_practice" &&
                                            activeTest
                                                ? (() => {
                                                      const stats =
                                                          testPracticeStats[
                                                              activeTest.id
                                                          ] || [];
                                                      if (stats.length === 0)
                                                          return "0%";
                                                      return (
                                                          Math.round(
                                                              (stats.filter(
                                                                  Boolean,
                                                              ).length /
                                                                  stats.length) *
                                                                  100,
                                                          ) + "%"
                                                      );
                                                  })()
                                                : (score.total > 0
                                                      ? Math.round(
                                                            (score.correct /
                                                                score.total) *
                                                                100,
                                                        )
                                                      : 0) + "%"}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="progressBarContainer">
                                        <div
                                            className="progressBarFill"
                                            style={{
                                                width: `${((currentIndex + 1) / questionSet.length) * 100}%`,
                                            }}
                                        ></div>
                                    </div>
                                    <div className="progressText">
                                        Otázka {currentIndex + 1} /{" "}
                                        {questionSet.length}
                                    </div>
                                </>
                            )}

                            <div
                                className={`card ${isFlashcardStyle(mode) || mode === "test_practice" ? `stacked-card ${stackLevelClass}` : ""} ${shake ? "shake" : ""}`}
                                ref={cardRef}
                                style={{
                                    minHeight: "200px",
                                    position: "relative",
                                }}
                            >
                                {questionSet.map((q, index) => {
                                    const isFlashcardMode =
                                        mode === "random" ||
                                        mode === "smart" ||
                                        mode === "mistakes" ||
                                        mode === "test_practice";

                                    if (isFlashcardMode) {
                                        if (
                                            index !== currentIndex &&
                                            index !== currentIndex + 1
                                        )
                                            return null;
                                    }

                                    const isCurrent = index === currentIndex;
                                    const loadImg = isFlashcardMode
                                        ? index === currentIndex ||
                                          index === currentIndex + 1
                                        : Math.abs(index - currentIndex) <= 2;

                                    let animClass = "";
                                    if (isCurrent && !isFlashcardMode) {
                                        if (direction === "left")
                                            animClass = "slide-in-left";
                                        else if (direction === "right")
                                            animClass = "slide-in-right";
                                    }

                                    return (
                                        <div
                                            key={
                                                q._instanceId ||
                                                q.id ||
                                                q.number ||
                                                index
                                            }
                                            style={{
                                                position: isCurrent
                                                    ? "relative"
                                                    : "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "100%",
                                                opacity: isCurrent ? 1 : 0,
                                                zIndex: isCurrent ? 2 : -1,
                                                pointerEvents: isCurrent
                                                    ? "auto"
                                                    : "none",
                                                display: "block",
                                            }}
                                            className={animClass}
                                        >
                                            <QuestionCard
                                                currentQuestion={q}
                                                mode={mode}
                                                isActive={isCurrent}
                                                shouldLoadImage={loadImg}
                                                showResult={
                                                    showResult && isCurrent
                                                }
                                                selectedAnswer={
                                                    isCurrent
                                                        ? selectedAnswer
                                                        : q.userAnswer
                                                }
                                                visualSelection={
                                                    isCurrent
                                                        ? visualSelection
                                                        : null
                                                }
                                                onSelect={(i) =>
                                                    isFlashcardStyle(mode) ||
                                                    mode === "test_practice"
                                                        ? clickFlashcardAnswer(
                                                              i,
                                                          )
                                                        : handleAnswer(i)
                                                }
                                                onSwipe={handleSwipe}
                                                onZoom={setFullscreenImage}
                                                onReport={handleReportClick}
                                                onContentReady={
                                                    isCurrent
                                                        ? setReadyQuestionId
                                                        : undefined
                                                }
                                                optionRefsForCurrent={
                                                    isCurrent
                                                        ? optionRefsForCurrent
                                                        : null
                                                }
                                                disabled={
                                                    (isFlashcardStyle(mode) ||
                                                        mode ===
                                                            "test_practice") &&
                                                    showResult
                                                }
                                                isKeyboardMode={isKeyboardMode}
                                                currentSubject={subject}
                                                score={score}
                                                isExiting={
                                                    isCurrent && !!exitDirection
                                                }
                                            />
                                        </div>
                                    );
                                })}

                                {(isFlashcardStyle(mode) ||
                                    mode === "test_practice") &&
                                    !showResult && (
                                        <div
                                            className="actionButtons right"
                                            style={{ minHeight: "50px" }}
                                        >
                                            <button
                                                className="navButton primary"
                                                onClick={confirmFlashcardAnswer}
                                            >
                                                Potvrdit
                                            </button>
                                        </div>
                                    )}

                                {(isFlashcardStyle(mode) ||
                                    mode === "test_practice") &&
                                    showResult && (
                                        <div
                                            className="actionButtons right"
                                            style={{ minHeight: "50px" }}
                                        >
                                            <button
                                                className="navButton"
                                                onClick={nextFlashcardQuestion}
                                            >
                                                Další otázka
                                            </button>
                                        </div>
                                    )}

                                {!(
                                    isFlashcardStyle(mode) ||
                                    mode === "test_practice"
                                ) && (
                                    <div style={{ marginTop: "1rem" }}>
                                        <div className="actionButtons spaced">
                                            <button
                                                className="navButton"
                                                onClick={() =>
                                                    moveToQuestion(
                                                        Math.max(
                                                            0,
                                                            currentIndex - 1,
                                                        ),
                                                    )
                                                }
                                                disabled={currentIndex === 0}
                                            >
                                                Předchozí
                                            </button>
                                            <button
                                                className="navButton"
                                                onClick={() =>
                                                    moveToQuestion(
                                                        currentIndex + 1,
                                                    )
                                                }
                                                disabled={
                                                    currentIndex >=
                                                    questionSet.length - 1
                                                }
                                            >
                                                Další
                                            </button>
                                        </div>

                                        <div className="navigatorPlaceholder">
                                            <Navigator
                                                questionSet={questionSet}
                                                currentIndex={currentIndex}
                                                setCurrentIndex={moveToQuestion}
                                                mode={mode}
                                                maxSeenIndex={
                                                    mode === "real_test"
                                                        ? questionSet.length
                                                        : maxSeenIndex
                                                }
                                            />

                                            {mode === "mock" && (
                                                <div
                                                    style={{
                                                        marginTop: "2rem",
                                                        width: "100%",
                                                        display: "flex",
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                >
                                                    <button
                                                        className="navButton primary"
                                                        style={{
                                                            padding:
                                                                "10px 30px",
                                                            fontSize: "0.95rem",
                                                            minWidth: "150px",
                                                        }}
                                                        onClick={() =>
                                                            setShowConfirmSubmit(
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        Odevzdat test
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {questionSet.length > 3 && (
                    <HiddenPreloader
                        questionSet={questionSet}
                        currentIndex={currentIndex}
                        subject={subject}
                        mode={mode}
                    />
                )}

                <div className="footer"></div>
            </div>
        </>
    );
}



