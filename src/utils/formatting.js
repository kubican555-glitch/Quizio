export function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);

  const dateStr = d.toLocaleDateString("cs-CZ", { 
      weekday: "long", 
      day: "numeric", 
      month: "numeric" 
  });

  const timeStr = d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return capitalizedDate + " " + timeStr;
}

export const removeAccents = (str) => {
  if (!str) return "";
  return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
};

export const getSmartRegex = (search) => {
  if (!search) return null;
  const map = {
      a: "[aá]",
      e: "[eéě]",
      i: "[ií]",
      o: "[oó]",
      u: "[uúů]",
      y: "[yý]",
      c: "[cč]",
      d: "[dď]",
      n: "[nň]",
      r: "[rř]",
      s: "[sš]",
      t: "[tť]",
      z: "[zž]",
  };
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped
      .split("")
      .map((char) => {
          const lower = char.toLowerCase();
          return map[lower] || char;
      })
      .join("");

  return new RegExp(`(${pattern})`, "gi");
};
export const isFlashcardStyle = (mode) => {
    return mode === "random" || mode === "mistakes" || mode === "smart";
};