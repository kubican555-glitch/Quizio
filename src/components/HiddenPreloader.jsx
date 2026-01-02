import React, { useEffect } from 'react';
import { fetchQuestionImage } from '../utils/dataManager';

export const HiddenPreloader = ({ questionSet, currentIndex, subject, mode }) => {

  useEffect(() => {
    if (!questionSet || questionSet.length === 0) return;

    const preloadImages = async () => {
      // ZVÝŠENO: Přednačítáme více dopředu pro plynulejší průchod
      const PRELOAD_COUNT = 7; 

      for (let i = 1; i <= PRELOAD_COUNT; i++) {
        const nextIndex = currentIndex + i;

        if (nextIndex < questionSet.length) {
          const nextQuestion = questionSet[nextIndex];

          if (nextQuestion && nextQuestion.id) {
            // Paralelní stahování bez blokování
            fetchQuestionImage(nextQuestion.id).catch(() => {});
          }
        }
      }
    };

    // ZKRÁCENO: Téměř okamžitý start přednačítání
    const timer = setTimeout(() => {
      preloadImages();
    }, 100);

    return () => clearTimeout(timer);

  }, [currentIndex, questionSet]);

  return null;
};