import { supabase } from '../supabaseClient';

// Cache pro obrázky v paměti
const imageCache = new Map();

// NOVÁ FUNKCE: Synchronní čtení z cache pro okamžité zobrazení
export const getCachedImage = (questionId) => {
  return imageCache.get(questionId);
};

export const fetchQuestionsLightweight = async (subject = null) => {
  try {
    let query = supabase
      .from('questions')
      .select('id, number, subject, question, options, correct_index, is_active')
      .order('number', { ascending: true });

    if (subject) {
      query = query.eq('subject', subject);
    }

    query = query.eq('is_active', true);

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Chyba dataManager/fetchQuestions:', error);
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