/**
 * Normalizes raw AI-generated text by removing markdown artifacts
 * and excess whitespace before formatPolicyContent() processes it
 */

export function normalizePolicyText(raw) {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw;

  // Remove markdown bold (**text**)
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');

  // Remove markdown italic (*text*)
  text = text.replace(/\*(.+?)\*/g, '$1');

  // Remove markdown headers (# ## ### etc.)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove horizontal divider lines (---+)
  text = text.replace(/^\s*-{3,}\s*$/gm, '');

  // Remove backticks (inline code)
  text = text.replace(/`(.+?)`/g, '$1');

  // Normalize multiple blank lines to single blank line
  text = text.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace from each line
  text = text.split('\n').map(line => line.trim()).join('\n');

  // Remove stray numbering at line start (e.g., "1. ", "2. ")
  text = text.replace(/^\d+\.\s+/gm, '');

  // Collapse multiple spaces within lines
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}