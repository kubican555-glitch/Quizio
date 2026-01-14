import React from "react";
import { formatDuration } from "../utils/formatting";

const medalIcons = ["🥇", "🥈", "🥉"];

const getValue = (map, key) => (map && map[key] ? map[key] : 0);

export const LeaderboardPanel = ({
    entries,
    loading,
    error,
    className = "",
    title = "Žebříček třídy",
}) => {
    return (
        <div className={`leaderboard-panel ${className}`.trim()}>
            <div className="leaderboard-header">
                <h3>{title}</h3>
            </div>
            {loading && <div className="leaderboard-state">Načítám data...</div>}
            {!loading && error && (
                <div className="leaderboard-state error">
                    Nepodařilo se načíst data žebříčku.
                </div>
            )}
            {!loading && !error && entries.length === 0 && (
                <div className="leaderboard-state">
                    Žádná data k dispozici.
                </div>
            )}
            {!loading && !error && entries.length > 0 && (
                <div className="leaderboard-list">
                    {entries.map((entry, index) => {
                        const spsTime = getValue(entry.subjectTimes, "sps");
                        const sttTime = getValue(entry.subjectTimes, "stt");
                        const spsQuestions = getValue(entry.questionCounts, "sps");
                        const sttQuestions = getValue(entry.questionCounts, "stt");

                        return (
                            <div className="leaderboard-row" key={entry.id || entry.username}>
                                <div className="leaderboard-rank">
                                    {index < 3 ? (
                                        <span className="leaderboard-medal">{medalIcons[index]}</span>
                                    ) : (
                                        <span className="leaderboard-rank-number">
                                            {index + 1}.
                                        </span>
                                    )}
                                </div>
                                <div className="leaderboard-info">
                                    <div className="leaderboard-topline">
                                        <span className="leaderboard-name">
                                            {entry.username}
                                        </span>
                                        <span className="leaderboard-total">
                                            {formatDuration(entry.totalTime)}
                                        </span>
                                    </div>
                                    <div className="leaderboard-details">
                                        <div className="leaderboard-detail-group">
                                            <span className="leaderboard-detail-label">Čas:</span>
                                            <span>SPS {formatDuration(spsTime)}</span>
                                            <span>STT {formatDuration(sttTime)}</span>
                                        </div>
                                        <div className="leaderboard-detail-group">
                                            <span className="leaderboard-detail-label">Otázky:</span>
                                            <span>Celkem {entry.totalQuestions}</span>
                                            <span>SPS {spsQuestions}</span>
                                            <span>STT {sttQuestions}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
