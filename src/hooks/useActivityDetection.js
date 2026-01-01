import { useState, useEffect, useRef } from 'react';

export const useActivityDetection = (mode, isSessionBlocked) => {
    const [sessionTime, setSessionTime] = useState(0);
    const [isAfk, setIsAfk] = useState(false);
    const lastActivityRef = useRef(Date.now());

    useEffect(() => {
        const resetInactivity = () => {
            lastActivityRef.current = Date.now();
            if (isAfk) setIsAfk(false);
        };

        window.addEventListener("mousemove", resetInactivity);
        window.addEventListener("keydown", resetInactivity);
        window.addEventListener("click", resetInactivity);
        window.addEventListener("touchstart", resetInactivity);

        return () => {
            window.removeEventListener("mousemove", resetInactivity);
            window.removeEventListener("keydown", resetInactivity);
            window.removeEventListener("click", resetInactivity);
            window.removeEventListener("touchstart", resetInactivity);
        };
    }, [isAfk]);

    useEffect(() => {
        if (isSessionBlocked) return;

        const ignoredModes = ['review', 'history', 'admin', 'teacher_manager', 'scheduled_list', 'no_mistakes', 'real_test'];
        if (ignoredModes.includes(mode)) return;

        const interval = setInterval(() => {
            if (Date.now() - lastActivityRef.current > 60000) {
                if (!isAfk) setIsAfk(true);
            } else {
                setSessionTime(prev => prev + 1);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [mode, isAfk, isSessionBlocked]);

    return { sessionTime, setSessionTime, isAfk };
};