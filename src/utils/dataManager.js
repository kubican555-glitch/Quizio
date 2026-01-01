import { supabase } from '../supabaseClient';

// Cache pro obrázky v paměti (zůstává stejné)
const imageCache = new Map();

// Klíč pro localStorage
const getStorageKey = (subject) => `quizio_questions_${subject || 'ALL'}`;

// --- HELPERS PRO LOCAL STORAGE ---
const loadLocalQuestions = (subject) => {
  try {
    const data = localStorage.getItem(getStorageKey(subject));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Chyba čtení z localStorage:", e);
    return [];
  }
};

const saveLocalQuestions = (subject, questions) => {
  try {
    localStorage.setItem(getStorageKey(subject), JSON.stringify(questions));
  } catch (e) {
    console.error("Chyba zápisu do localStorage (pravděpodobně plná paměť):", e);
    // Zde by šlo implementovat promazání starých dat, pokud dojde místo
  }
};

// --- HLAVNÍ FUNKCE ---

export const getCachedImage = (questionId) => {
  return imageCache.get(questionId);
};

export const fetchQuestionsLightweight = async (subject = null) => {
  try {
    // 1. Načíst lokální data
    let localQuestions = loadLocalQuestions(subject);

    // 2. Zjistit čas poslední aktualizace (nejnovější updated_at v lokálních datech)
    let lastSyncTime = null;
    if (localQuestions.length > 0) {
      // Najdeme nejnovější datum. Předpokládáme ISO stringy.
      const dates = localQuestions
        .map(q => q.updated_at)
        .filter(d => d) // vyfiltrovat null/undefined
        .sort(); 

      if (dates.length > 0) {
        lastSyncTime = dates[dates.length - 1];
      }
    }

    // 3. Sestavení dotazu na Supabase
    // POZOR: Musíme přidat 'updated_at' do selectu, abychom ho příště mohli použít
    let query = supabase
      .from('questions')
      .select('id, number, subject, question, options, correct_index, is_active, updated_at')
      .order('number', { ascending: true });

    if (subject) {
      query = query.eq('subject', subject);
    }

    // Pokud máme lokální data, ptáme se jen na novější změny
    if (lastSyncTime) {
      // Přičteme 1ms, abychom nestahovali tu samou znovu, ale raději stáhnout o jednu víc než o jednu míň
      query = query.gt('updated_at', lastSyncTime);
    }

    // Poznámka: Stahujeme i is_active=false, abychom věděli, co máme z lokální DB vymazat/deaktivovat

    console.log(`Synchronizuji otázky pro ${subject}... Poslední sync: ${lastSyncTime || 'Nikdy'}`);
    const { data: newOrUpdatedQuestions, error } = await query;

    if (error) throw error;

    // 4. Sloučení dat (Merging)
    if (newOrUpdatedQuestions && newOrUpdatedQuestions.length > 0) {
      console.log(`Staženo ${newOrUpdatedQuestions.length} nových/změněných otázek.`);

      // Vytvoříme Mapu z lokálních otázek pro rychlý přístup podle ID
      const questionMap = new Map(localQuestions.map(q => [q.id, q]));

      // Projdeme stažené změny
      newOrUpdatedQuestions.forEach(updatedQ => {
        // Přepíšeme nebo přidáme do mapy
        questionMap.set(updatedQ.id, updatedQ);
      });

      // Převedeme zpět na pole
      // Filtrujeme pouze aktivní otázky pro zobrazení v aplikaci
      // (Pokud chceš v App.jsx zobrazovat i neaktivní, odstraň .filter)
      const mergedQuestions = Array.from(questionMap.values());

      // Seřadíme podle čísla otázky (pro jistotu)
      mergedQuestions.sort((a, b) => a.number - b.number);

      // Uložíme aktualizovaný set do LocalStorage
      saveLocalQuestions(subject, mergedQuestions);

      // Vrátíme pouze aktivní otázky pro UI
      return { 
        data: mergedQuestions.filter(q => q.is_active === true), 
        error: null 
      };

    } else {
      console.log("Žádné nové aktualizace, používám cache.");
      // Nic nového, vrátíme to, co máme v cache (pouze aktivní)
      return { 
        data: localQuestions.filter(q => q.is_active === true), 
        error: null 
      };
    }

  } catch (error) {
    console.error('Chyba dataManager/fetchQuestions:', error);
    // Fallback: Pokud selže síť, vrátíme aspoň to, co máme v cache
    const cached = loadLocalQuestions(subject);
    if (cached.length > 0) {
        console.warn("Vracím offline data z cache.");
        return { data: cached.filter(q => q.is_active === true), error: null }; // Vracíme null error, aby aplikace nespadla
    }
    return { data: null, error };
  }
};

export const fetchQuestionImage = async (questionId) => {
  if (!questionId) return null;

  if (imageCache.has(questionId)) {
    return imageCache.get(questionId);
  }

  try {
    const { data, error } = await supabase
      .from('questions')
      .select('image_base64')
      .eq('id', questionId)
      .single();

    if (error) {
        if (error.code !== 'PGRST116') {
            console.warn(`Chyba stahování obrázku ${questionId}:`, error.message);
        }
        return null;
    }

    const image = data?.image_base64 || null;
    imageCache.set(questionId, image);

    return image;
  } catch (error) {
    console.error(`Kritická chyba fetchQuestionImage ${questionId}:`, error);
    return null;
  }
};

export const clearImageCache = () => {
  imageCache.clear();
};

// Funkce pro kompletní smazání dat otázek (např. při odhlášení nebo v nastavení)
export const clearLocalQuestionData = () => {
    // Projde všechny klíče v localStorage a smaže ty začínající na 'quizio_questions_'
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('quizio_questions_')) {
            localStorage.removeItem(key);
        }
    });
    console.log("Lokální data otázek vymazána.");
};