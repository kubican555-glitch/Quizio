import React, { useState, useRef, useEffect } from 'react';

export function Navigator({
    questionSet,
    currentIndex,
    setCurrentIndex,
    mode,
    maxSeenIndex,
}) {
    const listRef = useRef(null);

    // Stavy pro logiku tažení myší
    const [isDown, setIsDown] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Automatický posun na aktivní otázku (jen když se změní index a uživatel nedrží myš)
    useEffect(() => {
        if (!isDown && listRef.current && listRef.current.children[currentIndex]) {
            const container = listRef.current;
            const element = container.children[currentIndex];
            
            const containerWidth = container.offsetWidth;
            const elementOffset = element.offsetLeft;
            const elementWidth = element.offsetWidth;
            
            const scrollTo = elementOffset - (containerWidth / 2) + (elementWidth / 2);
            
            container.scrollTo({
                left: scrollTo,
                behavior: 'smooth'
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex]); 

    // --- HANDLERY ---

    const handlePointerDown = (e) => {
        // ZMĚNA: Pokud je to dotyk (mobil), ignorujeme naši logiku a necháme
        // pracovat nativní scrollování prohlížeče (které má setrvačnost/momentum).
        if (e.pointerType === 'touch') return;

        setIsDown(true);
        setIsDragging(false);
        setStartX(e.pageX - listRef.current.offsetLeft);
        setScrollLeft(listRef.current.scrollLeft);
    };

    const handlePointerMove = (e) => {
        if (!isDown) return;
        if (e.pointerType === 'touch') return; // Jistota pro mobily

        const x = e.pageX - listRef.current.offsetLeft;
        const walk = (x - startX); 

        // Detekce tažení (práh 5px)
        if (!isDragging) {
            if (Math.abs(walk) > 5) {
                setIsDragging(true);
                e.currentTarget.setPointerCapture(e.pointerId);
            }
        }

        // Posouvání
        if (isDragging || Math.abs(walk) > 5) {
            e.preventDefault();
            // ZMĚNA: Rychlost pro myš nastavena na 1 (přirozené 1:1)
            // Mobil pojede nativně, takže zde nepotřebujeme 2x.
            listRef.current.scrollLeft = scrollLeft - walk * 1; 
        }
    };

    const handlePointerUp = (e) => {
        // Pokud to byl dotyk, nic neřešíme (řeší prohlížeč)
        if (e.pointerType === 'touch') return;

        setIsDown(false);
        if (isDragging) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setIsDragging(false);
        }
    };

    const handlePointerLeave = (e) => {
        if (e.pointerType === 'touch') return;
        if (!isDragging) {
            setIsDown(false);
        }
    };

    return (
        <div className="navigatorWrapper">
            <div 
                ref={listRef} 
                className={`compactNavigator ${isDragging ? "grabbing" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onPointerMove={handlePointerMove}
            >
                {questionSet.map((_, i) => {
                    if (mode === "training" && i > maxSeenIndex) return null;
                    return (
                        <button
                            key={i}
                            className={`navNumber ${currentIndex === i ? "current" : ""} ${questionSet[i]?.userAnswer !== undefined ? "answered" : ""}`}
                            onClick={(e) => {
                                // Pro myš: Pokud jsme tahali, ignorujeme klik.
                                // Pro dotyk: Browser sám nepošle onClick, pokud se scrollovalo,
                                // takže to funguje automaticky správně.
                                if (!isDragging) {
                                    setCurrentIndex(i);
                                } else {
                                    e.preventDefault(); 
                                }
                            }}
                            // Prevence drag-and-drop chování obrázků/textu v prohlížeči
                            onDragStart={(e) => e.preventDefault()} 
                        >
                            {i + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}