import { useState, useEffect } from 'react';

export const useGlobalKeyboard = () => {
    const [isKeyboardMode, setIsKeyboardMode] = useState(false);

    useEffect(() => {
        let lastClientX = -1;
        let lastClientY = -1;

        const handleMouseMove = (e) => {
            // Ignorujeme malé pohyby (jitter)
            if (e.clientX === lastClientX && e.clientY === lastClientY) return;
            lastClientX = e.clientX;
            lastClientY = e.clientY;

            if (document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(false);
                document.body.classList.remove("keyboard-mode-active");
            }
        };

        const handleKeyDownInteraction = (e) => {
            // Ignorujeme modifikačné klávesy
            if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

            if (!document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(true);
                document.body.classList.add("keyboard-mode-active");
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("keydown", handleKeyDownInteraction);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("keydown", handleKeyDownInteraction);
            document.body.classList.remove("keyboard-mode-active");
        };
    }, []);

    return { isKeyboardMode, setIsKeyboardMode };
};