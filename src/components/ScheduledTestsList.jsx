import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { SubjectBadge } from "./SubjectBadge";
import { UserBadgeDisplay } from "./UserBadgeDisplay";
import { ThemeToggle } from "./ThemeToggle";

// --- POMOCNÁ KOMPONENTA PRO ODPOČET ---
function CountdownTimer({ targetDate, onTimerEnd }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const difference = new Date(targetDate) - now;

            if (difference <= 0) {
                clearInterval(interval);
                setTimeLeft("teď");
                if (onTimerEnd) onTimerEnd();
            } else {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);

                if (days > 0) {
                    setTimeLeft(`za ${days}d ${hours}h`);
                } else {
                    const pad = (n) => n.toString().padStart(2, "0");
                    // UPRAVENÁ LOGIKA FORMÁTOVÁNÍ
                    if (hours > 0) {
                        setTimeLeft(
                            `za ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
                        );
                    } else {
                        // Pokud je 0 hodin, ukážeme jen MM:SS
                        setTimeLeft(
                            `za ${pad(minutes)}:${pad(seconds)}`,
                        );
                    }
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate, onTimerEnd]);

    return <span>{timeLeft}</span>;
}

// --- HLAVNÍ KOMPONENTA ---
export function ScheduledTestsList({
    scheduledTests,
    onBack,
    subject,
    user,
    userId,
    syncing,
    theme,
    toggleTheme,
    onStartGradedTest,
    onStartPractice,
    completedTestIds = [],
    testPracticeStats = {},
    onRefresh,
}) {
    const [userResults, setUserResults] = useState([]);

    // --- 1. NAČTENÍ STAVŮ TESTŮ ---
    useEffect(() => {
        if (!userId) return;

        const fetchUserResults = async () => {
            console.log(
                "🔍 [ScheduledTestsList] Hledám výsledky pro UserID:",
                userId,
            );

            const { data, error } = await supabase
                .from("test_results")
                .select(
                    "test_id, status, score_correct, score_total, created_at",
                )
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (data) {
                console.log("📦 [ScheduledTestsList] Stažená data z DB:", data);
                setUserResults(data);
            }
            if (error) console.error("❌ Chyba DB:", error);
        };

        fetchUserResults();

        // Realtime
        const sub = supabase
            .channel("my_test_status_fix")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "test_results",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    console.log("⚡ Změna v DB, aktualizuji...", payload);
                    fetchUserResults();
                },
            )
            .subscribe();

        return () => supabase.removeChannel(sub);
    }, [userId]);

    // --- SEŘAZENÍ: Nehotové nahoře, hotové dole ---
    const sortedTests = [...scheduledTests].sort((a, b) => {
        const getTestStatus = (testId) => {
            const currentTestIdStr = String(testId);
            const myAllResults = userResults.filter((r) => String(r.test_id) === currentTestIdStr);
            const runningAttempt = myAllResults.find((r) => r.status === "running");
            const completedAttempt = myAllResults.find((r) => r.status === "completed");

            const isRunning = !!runningAttempt;
            let isCompleted = false;
            if (!isRunning) {
                isCompleted = !!completedAttempt || completedTestIds.includes(testId);
            }
            return isCompleted;
        };

        const isACompleted = getTestStatus(a.id);
        const isBCompleted = getTestStatus(b.id);

        if (isACompleted === isBCompleted) return 0;
        return isACompleted ? 1 : -1;
    });


    const formatDate = (dateString) => {
        if (!dateString) return "---";
        const date = new Date(dateString);
        return date.toLocaleDateString("cs-CZ", {
            day: "numeric",
            month: "long",
        });
    };

    const formatTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleTimeString("cs-CZ", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };
    const showSubjectBadge = Boolean(subject);
    const modeBadge = { label: "Naplánované testy", icon: "📅" };

    return (
        <div
            className="container fadeIn"
            style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}
        >
            <div className="top-navbar navbar-tiered">
                <div className="navbar-group nav-primary">
                    <button className="menuBackButton" onClick={onBack}>
                        <span
                            style={{
                                fontSize: "1.2rem",
                                marginRight: "0.2rem",
                            }}
                        >
                            ←
                        </span>
                        <span className="mobile-hide-text">Zpět</span>
                    </button>
                </div>
                <div className="navbar-group nav-status">
                    <div className="subjectBadgeGroup">
                        {showSubjectBadge && (
                            <SubjectBadge subject={subject} compact matchUserBadge />
                        )}
                        {modeBadge && (
                            <>
                                {showSubjectBadge && (
                                    <span className="subjectBadgeDivider">
                                        |
                                    </span>
                                )}
                                <div className="modeBadge">
                                    <span className="modeBadgeIcon">
                                        {modeBadge.icon}
                                    </span>
                                    <span>{modeBadge.label}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="navbar-group nav-actions">
                    <button
                        className="menuBackButton"
                        onClick={onRefresh}
                        title="Obnovit"
                        style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            cursor: "pointer",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "40px",
                            height: "36px",
                            borderRadius: "10px",
                            transition: "all 0.2s",
                        }}
                    >
                        🔄
                    </button>
                    <UserBadgeDisplay
                        user={user}
                        compactOnMobile={true}
                    />
                    <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                </div>
            </div>

            <div className="quizContentWrapper">
                {sortedTests.length === 0 ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4rem 2rem",
                            color: "var(--color-text-secondary)",
                            background: "var(--color-card-bg)",
                            borderRadius: "24px",
                            border: "1px solid var(--color-card-border)",
                            marginTop: "1rem",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "4rem",
                                marginBottom: "1rem",
                                opacity: 0.8,
                            }}
                        >
                            📭
                        </div>
                        <div
                            style={{
                                fontSize: "1.4rem",
                                fontWeight: "700",
                                marginBottom: "0.5rem",
                                color: "var(--color-text-main)",
                            }}
                        >
                            Zatím žádné testy
                        </div>
                    </div>
                ) : (
                    <div
                        className="tests-grid"
                        style={{
                            display: "grid",
                            gap: "1.5rem",
                            width: "100%",
                        }}
                    >
                        {sortedTests.map((test) => {
                            const now = new Date();
                            const hasDates = test.open_at && test.close_at;
                            const isOpen =
                                hasDates &&
                                now >= new Date(test.open_at) &&
                                now <= new Date(test.close_at);
                            const isUpcoming =
                                hasDates && now < new Date(test.open_at);
                            const isClosed =
                                hasDates && now > new Date(test.close_at);

                            // =========================================================
                            // 🛑 DEBUG LOGIKA STAVU
                            // =========================================================
                            const currentTestIdStr = String(test.id);
                            const myAllResults = userResults.filter(
                                (r) => String(r.test_id) === currentTestIdStr,
                            );
                            const runningAttempt = myAllResults.find(
                                (r) => r.status === "running",
                            );
                            const completedAttempt = myAllResults.find(
                                (r) => r.status === "completed",
                            );

                            const isRunning = !!runningAttempt;
                            let isCompleted = false;
                            if (!isRunning) {
                                isCompleted =
                                    !!completedAttempt ||
                                    completedTestIds.includes(test.id);
                            }

                            // Statistiky procvičování
                            const stats = testPracticeStats[test.id] || [];
                            let successRate = null;
                            if (stats.length > 0) {
                                const correctCount =
                                    stats.filter(Boolean).length;
                                successRate = Math.round(
                                    (correctCount / stats.length) * 100,
                                );
                            }

                            let badgeScoreText = "";
                            if (
                                isCompleted &&
                                completedAttempt &&
                                completedAttempt.score_total > 0
                            ) {
                                const pct = Math.round(
                                    (completedAttempt.score_correct /
                                        completedAttempt.score_total) *
                                        100,
                                );
                                badgeScoreText = ` (${pct}%)`;
                            }

                            // --- VZHLED ---
                            let statusConfig = {
                                color: "#94a3b8",
                                bg: "rgba(148, 163, 184, 0.15)",
                                border: "rgba(148, 163, 184, 0.3)",
                                icon: "🔒",
                                text: "Uzavřeno",
                            };

                            if (isRunning) {
                                // PRIORITA 1
                                statusConfig = {
                                    color: "#3b82f6",
                                    bg: "rgba(59, 130, 246, 0.15)",
                                    border: "rgba(59, 130, 246, 0.3)",
                                    icon: "✍️",
                                    text: "Rozpracováno",
                                };
                            } else if (isCompleted) {
                                // PRIORITA 2
                                statusConfig = {
                                    color: "#22c55e",
                                    bg: "rgba(34, 197, 94, 0.15)",
                                    border: "rgba(34, 197, 94, 0.3)",
                                    icon: "✅",
                                    text: `Dokončeno${badgeScoreText}`,
                                };
                            } else if (isOpen) {
                                // PRIORITA 3 - TEST JE OTEVŘENÝ
                                statusConfig = {
                                    color: "#3b82f6",
                                    bg: "rgba(59, 130, 246, 0.15)",
                                    border: "rgba(59, 130, 246, 0.3)",
                                    icon: "🚀",
                                    text: (
                                        <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                            <span>Končí</span>
                                            <CountdownTimer
                                                targetDate={test.close_at}
                                                onTimerEnd={onRefresh}
                                            />
                                        </span>
                                    ),
                                };
                            } else if (isUpcoming) {
                                // PRIORITA 4 - TEST SE TEPRVE OTEVŘE
                                statusConfig = {
                                    color: "#f59e0b",
                                    bg: "rgba(245, 158, 11, 0.15)",
                                    border: "rgba(245, 158, 11, 0.3)",
                                    icon: "⏳",
                                    text: (
                                        <CountdownTimer
                                            targetDate={test.open_at}
                                            onTimerEnd={onRefresh}
                                        />
                                    ),
                                };
                            } else if (!hasDates) {
                                statusConfig = null;
                            }

                            return (
                                <div
                                    key={test.id}
                                    className="reviewCard"
                                    style={{
                                        padding: "0",
                                        borderRadius: "20px",
                                        overflow: "hidden",
                                        border: `1px solid var(--color-card-border)`,
                                        background: "var(--color-card-bg)",
                                        boxShadow:
                                            "0 8px 30px rgba(0,0,0,0.15)",
                                        display: "flex",
                                        flexDirection: "column",
                                        transition:
                                            "transform 0.2s ease, box-shadow 0.2s ease",
                                        position: "relative",
                                        opacity: isCompleted ? 0.75 : 1, 
                                        transform: isCompleted ? "scale(0.98)" : "none" 
                                    }}
                                >
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: "6px",
                                            background: statusConfig
                                                ? statusConfig.color
                                                : "transparent",
                                        }}
                                    ></div>

                                    <div
                                        style={{
                                            padding: "1.5rem",
                                            borderBottom:
                                                "1px solid var(--color-card-border)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            gap: "1rem",
                                            paddingLeft: "1.8rem",
                                        }}
                                    >
                                        <div>
                                            <h3
                                                style={{
                                                    margin: 0,
                                                    fontSize: "1.4rem",
                                                    fontWeight: "800",
                                                    color: "var(--color-text-main)",
                                                    letterSpacing: "-0.5px",
                                                }}
                                            >
                                                {test.title}
                                            </h3>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "1rem",
                                                    marginTop: "0.6rem",
                                                    color: "var(--color-text-secondary)",
                                                    fontSize: "0.9rem",
                                                    fontWeight: "500",
                                                }}
                                            >
                                                <span title="Počet otázek">
                                                    ❓ {test.question_count}
                                                    &nbsp;otázek
                                                </span>
                                                <span style={{ opacity: 0.3 }}>
                                                    |
                                                </span>
                                                <span title="Časový limit">
                                                    ⏱️ {test.time_limit}
                                                    &nbsp;min
                                                </span>
                                            </div>
                                        </div>

                                        {statusConfig && (
                                            <div
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.4rem",
                                                    padding: "6px 14px",
                                                    borderRadius: "20px",
                                                    background: statusConfig.bg,
                                                    color: statusConfig.color,
                                                    border: `1px solid ${statusConfig.border}`,
                                                    fontSize: "0.85rem",
                                                    fontWeight: "700",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <span>{statusConfig.icon}</span>
                                                {statusConfig.text}
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            padding: "1.5rem",
                                            paddingLeft: "1.8rem",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "1.5rem",
                                        }}
                                    >
                                        {hasDates ? (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(auto-fit, minmax(180px, 1fr))",
                                                    gap: "1rem",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background:
                                                            "rgba(0,0,0,0.03)",
                                                        padding: "0.8rem",
                                                        borderRadius: "12px",
                                                        border: "1px solid var(--color-card-border)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            textTransform:
                                                                "uppercase",
                                                            color: "var(--color-text-neutral)",
                                                            fontWeight: "700",
                                                            marginBottom:
                                                                "0.3rem",
                                                        }}
                                                    >
                                                        Otevření
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: "1rem",
                                                            fontWeight: "600",
                                                            color: "var(--color-text-main)",
                                                        }}
                                                    >
                                                        {formatDate(
                                                            test.open_at,
                                                        )}{" "}
                                                        <span
                                                            style={{
                                                                color: "var(--color-text-secondary)",
                                                                fontWeight:
                                                                    "400",
                                                            }}
                                                        >
                                                            v{" "}
                                                            {formatTime(
                                                                test.open_at,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        background:
                                                            "rgba(0,0,0,0.03)",
                                                        padding: "0.8rem",
                                                        borderRadius: "12px",
                                                        border: "1px solid var(--color-card-border)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: "0.75rem",
                                                            textTransform:
                                                                "uppercase",
                                                            color: "var(--color-text-neutral)",
                                                            fontWeight: "700",
                                                            marginBottom:
                                                                "0.3rem",
                                                        }}
                                                    >
                                                        Uzavření
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: "1rem",
                                                            fontWeight: "600",
                                                            color: "var(--color-text-main)",
                                                        }}
                                                    >
                                                        {formatDate(
                                                            test.close_at,
                                                        )}{" "}
                                                        <span
                                                            style={{
                                                                color: "var(--color-text-secondary)",
                                                                fontWeight:
                                                                    "400",
                                                            }}
                                                        >
                                                            v{" "}
                                                            {formatTime(
                                                                test.close_at,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    background:
                                                        "rgba(0,0,0,0.03)",
                                                    padding: "1rem",
                                                    borderRadius: "12px",
                                                    border: "1px solid var(--color-card-border)",
                                                    textAlign: "center",
                                                    fontStyle: "italic",
                                                    color: "var(--color-text-secondary)",
                                                }}
                                            >
                                                Termín testu bude upřesněn
                                                učitelem.
                                            </div>
                                        )}

                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                background: `linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)`,
                                                padding: "0.8rem 1.2rem",
                                                borderRadius: "12px",
                                                border: "1px solid var(--color-card-border)",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: "0.95rem",
                                                    fontWeight: "600",
                                                    color: "var(--color-text-secondary)",
                                                }}
                                            >
                                                🎯 Tvoje úspěšnost v
                                                procvičování:
                                            </span>
                                            {successRate !== null ? (
                                                <span
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        fontWeight: "900",
                                                        color:
                                                            successRate >= 80
                                                                ? "var(--color-success)"
                                                                : successRate <
                                                                  50
                                                                ? "var(--color-error)"
                                                                : "var(--color-warning)",
                                                    }}
                                                >
                                                    {successRate}%
                                                </span>
                                            ) : (
                                                <span
                                                    style={{
                                                        fontSize: "0.9rem",
                                                        color: "var(--color-text-neutral)",
                                                        fontStyle: "italic",
                                                    }}
                                                >
                                                    Zatím neprocvičováno
                                                </span>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "1rem",
                                                marginTop: "0.5rem",
                                                width: "100%",
                                            }}
                                        >
                                            {/* --- TLAČÍTKA --- */}
                                            {isRunning ||
                                            (isOpen && !isCompleted) ? (
                                                <button
                                                    onClick={() =>
                                                        onStartGradedTest(test)
                                                    }
                                                    style={{
                                                        flex: "1 1 200px",
                                                        padding: "1rem",
                                                        borderRadius: "12px",
                                                        border: "none",
                                                        fontSize: "1rem",
                                                        fontWeight: "800",
                                                        cursor: "pointer",
                                                        background: isRunning
                                                            ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                                            : "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                                                        color: "#ffffff",
                                                        boxShadow: isRunning
                                                            ? "0 8px 25px rgba(245, 158, 11, 0.4)"
                                                            : "0 8px 25px rgba(59, 130, 246, 0.5)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        gap: "0.5rem",
                                                        transition: "all 0.2s",
                                                        transform:
                                                            "scale(1.02)",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "1px",
                                                        minWidth: "0",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1.05)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform =
                                                            "scale(1.02)";
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            whiteSpace:
                                                                "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow:
                                                                "ellipsis",
                                                        }}
                                                    >
                                                        {isRunning
                                                            ? "▶️ Pokračovat v testu"
                                                            : "🚀 Spustit test"}
                                                    </span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() =>
                                                        onStartPractice(test)
                                                    }
                                                    style={{
                                                        flex: "1 1 200px",
                                                        padding: "1rem",
                                                        borderRadius: "12px",
                                                        border: "2px solid var(--color-primary)",
                                                        background:
                                                            "transparent",
                                                        color: "var(--color-primary)",
                                                        fontSize: "1rem",
                                                        fontWeight: "700",
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        gap: "0.5rem",
                                                        transition: "all 0.2s",
                                                        minWidth: "0",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background =
                                                            "var(--color-primary)";
                                                        e.currentTarget.style.color =
                                                            "#ffffff";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background =
                                                            "transparent";
                                                        e.currentTarget.style.color =
                                                            "var(--color-primary)";
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        🧠 Procvičit otázky
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
