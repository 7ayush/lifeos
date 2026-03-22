/**
 * Pure formatting functions for the markdown editor toolbar.
 * Each function takes the current text and selection range, and returns
 * the modified text with updated selection positions.
 */

interface FormatResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wraps the selected text with `**` bold markers.
 * If no text is selected, inserts `****` with the cursor positioned between.
 */
export function applyBold(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  if (selected.length === 0) {
    return {
      text: before + '****' + after,
      selectionStart: selectionStart + 2,
      selectionEnd: selectionStart + 2,
    };
  }

  return {
    text: before + '**' + selected + '**' + after,
    selectionStart: selectionStart + 2,
    selectionEnd: selectionEnd + 2,
  };
}

/**
 * Wraps the selected text with `*` italic markers.
 * If no text is selected, inserts `**` with the cursor positioned between.
 */
export function applyItalic(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  if (selected.length === 0) {
    return {
      text: before + '**' + after,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    };
  }

  return {
    text: before + '*' + selected + '*' + after,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionEnd + 1,
  };
}

/**
 * Finds the start index of the line containing the given cursor position.
 */
function findLineStart(text: string, cursorPos: number): number {
  const lastNewline = text.lastIndexOf('\n', cursorPos - 1);
  return lastNewline + 1;
}

/**
 * Inserts `## ` at the beginning of the current line.
 */
export function applyHeading(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const lineStart = findLineStart(text, selectionStart);
  const prefix = '## ';
  const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);

  return {
    text: newText,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

/**
 * Inserts `- ` at the beginning of the current line.
 */
export function applyUnorderedList(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const lineStart = findLineStart(text, selectionStart);
  const prefix = '- ';
  const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);

  return {
    text: newText,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

/**
 * Inserts `1. ` at the beginning of the current line.
 */
export function applyOrderedList(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const lineStart = findLineStart(text, selectionStart);
  const prefix = '1. ';
  const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);

  return {
    text: newText,
    selectionStart: selectionStart + prefix.length,
    selectionEnd: selectionEnd + prefix.length,
  };
}

/**
 * Wraps the selected text with triple backtick fences.
 * If no text is selected, inserts an empty fenced code block with the cursor inside.
 */
export function applyCodeBlock(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  if (selected.length === 0) {
    const block = '```\n\n```';
    return {
      text: before + block + after,
      selectionStart: selectionStart + 4, // after "```\n"
      selectionEnd: selectionStart + 4,
    };
  }

  const wrapped = '```\n' + selected + '\n```';
  return {
    text: before + wrapped + after,
    selectionStart: selectionStart + 4, // after opening "```\n"
    selectionEnd: selectionStart + 4 + selected.length, // before "\n```"
  };
}

/**
 * Inserts a link template at the cursor position.
 * If text is selected, wraps it as `[selection](url)`.
 * If no text is selected, inserts `[text](url)`.
 */
export function applyLink(
  text: string,
  selectionStart: number,
  selectionEnd: number
): FormatResult {
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  if (selected.length === 0) {
    const link = '[text](url)';
    return {
      text: before + link + after,
      selectionStart: selectionStart + 1, // after "["
      selectionEnd: selectionStart + 5, // select "text"
    };
  }

  const link = '[' + selected + '](url)';
  return {
    text: before + link + after,
    selectionStart: selectionStart + 1, // after "["
    selectionEnd: selectionStart + 1 + selected.length, // end of selected text
  };
}
