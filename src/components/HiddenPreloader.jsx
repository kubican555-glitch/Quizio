import React, { useEffect, useState } from 'react';
import { getImageUrl } from '../utils/images.js';
import { fetchQuestionImage } from '../utils/dataManager.js';

/**
 * Komponenta pro přednačítání obrázků.
 * Podporuje jak statické obrázky (přes getImageUrl), tak databázové (přes fetchQuestionImage).
 */
const HiddenPreloader = ({ question, subject }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!question) return;

    // 1. Pokud má otázka Base64 obrázek přímo v sobě
    if (question.image_base64) {
      setSrc(question.image_base64);
      return;
    }

    let imageFound = false;

    // 2. Zkusíme statickou URL (pro starší sady otázek)
    // getImageUrl obvykle vyžaduje objekt subject a číslo otázky
    if (subject && question.number) {
      const staticUrl = getImageUrl(subject, question.number);
      if (staticUrl) {
        setSrc(staticUrl);
        imageFound = true;
      }
    }

    // 3. Pokud nemáme statický, nebo chceme jistotu pro DB obrázky,
    // zavoláme fetchQuestionImage. I když se `src` nastaví až po fetchi,
    // hlavní je, že se data dostanou do cache prohlížeče/aplikace.
    if (!imageFound && question.id) {
      fetchQuestionImage(question.id).then((imgData) => {
        if (imgData) {
          setSrc(imgData);
        }
      }).catch(() => {
        // Chyby při preloadingu ignorujeme
      });
    }

  }, [question, subject]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="preload"
      style={{
        display: 'none',
        width: 0,
        height: 0,
        opacity: 0,
        position: 'absolute',
        pointerEvents: 'none'
      }}
      aria-hidden="true"
    />
  );
};

export default HiddenPreloader;