const decodeSegment = segment => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const routeFromPath = pathname => {
  const parts = pathname.split('/').filter(Boolean).map(decodeSegment);
  if (!parts.length || parts[0] === 'solo') return { solo: true, room: 'solo', name: 'Solo player' };
  return { solo: false, room: parts[0], name: parts[1] || 'player' };
};