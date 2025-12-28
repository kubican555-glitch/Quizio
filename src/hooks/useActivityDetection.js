import { useState, useEffect, useRef } from 'react';

export const useActivityDetection = (mode, isSessionBlocked) => {
    const [sessionTime, setSessionTime] = useState(0);
    const [isAfk, setIsAfk] = useState(false);
    const lastActivityRef = useRef(Date.now());

    // Resetovanie časovača neaktivity pri interakcii
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

    // Interval pre počítanie času session a kontrolu AFK
    useEffect(() => {
        // Interval beží iba v hlavnom menu (mode === null)
        // V pod-režimoch (review, history, atď.) si čas riešia komponenty samy
        if (mode || isSessionBlocked) return;

        // Zoznam režimov, kde sa časovač ignoruje (pre istotu, ak by mode nebol null ale string)
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