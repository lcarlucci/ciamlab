const AVATAR_COLORS = [
  "#86bc25",
  "#6a961d",
  "#2f6f4e",
  "#3c4c40",
  "#0f1d12",
  "#1d6f8e",
  "#9f6a1d",
  "#8e1d4f",
];

export const getInitial = (name, email) => {
  const source = (name || email || "").trim();
  if (!source) return "U";
  return source[0].toUpperCase();
};

export const getAvatarColor = (seed) => {
  const value = String(seed || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};
