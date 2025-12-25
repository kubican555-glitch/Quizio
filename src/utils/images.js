// Načítání obrázků přes Vite glob import
const images_sps = import.meta.glob("../images/images_sps/*.png", {
    eager: true,
    as: "url",
});
const images_stt = import.meta.glob("../images/images_stt/*.png", {
    eager: true,
    as: "url",
});
const images_custom = import.meta.glob("../images/*.png", {
    eager: true,
    as: "url",
});

const allImagesMap = {
    SPS: images_sps,
    STT: images_stt,
    CUSTOM: images_custom,
    DEFAULT: images_custom,
};

export const getImageUrl = (subject, questionNumber) => {
    const effectiveSubject =
        subject && allImagesMap[subject] ? subject : "DEFAULT";
    const numStr = String(questionNumber);

    const map = allImagesMap[effectiveSubject] || {};
    // Hledáme klíč, který obsahuje '/číslo.png'
    const imageKey = Object.keys(map).find(
        (key) => key.includes(`/${numStr}.png`) || key.includes(`/${numStr}.PNG`)
    );
    return imageKey ? map[imageKey] : null;
};