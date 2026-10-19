export function formatTime(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatLastSeen(user) {
  if (user.online) return 'en ligne';
  return `vu à ${formatTime(user.lastSeen)}`;
}

export function initials(name) {
  return name.slice(0, 2).toUpperCase();
}
