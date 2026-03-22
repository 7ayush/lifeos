/**
 * Strips markdown syntax from text to produce readable plain text for previews.
 * Uses regex-based replacements — intentionally simple for line-clamp displays.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  let result = text;

  // Remove code fences (triple backticks with optional language identifier)
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    // Extract content between fences
    const inner = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
    return inner.trim();
  });

  // Remove inline code backticks
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove image syntax ![alt](url) → alt
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove link syntax [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove heading markers (# through ######)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove bold markers **text** → text
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Remove italic markers *text* → text
  result = result.replace(/\*([^*]+)\*/g, '$1');

  // Remove unordered list prefixes (- item)
  result = result.replace(/^[-*+]\s+/gm, '');

  // Remove ordered list prefixes (1. item)
  result = result.replace(/^\d+\.\s+/gm, '');

  return result;
}
