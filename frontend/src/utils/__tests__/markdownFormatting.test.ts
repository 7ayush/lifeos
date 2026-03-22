import { describe, it, expect } from 'vitest';
import {
  applyBold,
  applyItalic,
  applyHeading,
  applyUnorderedList,
  applyOrderedList,
  applyCodeBlock,
  applyLink,
} from '../markdownFormatting';

describe('markdownFormatting', () => {
  describe('applyBold', () => {
    it('wraps selected text with ** markers', () => {
      const result = applyBold('hello world', 6, 11);
      expect(result.text).toBe('hello **world**');
      expect(result.selectionStart).toBe(8);
      expect(result.selectionEnd).toBe(13);
    });

    it('inserts **** with cursor between when no selection', () => {
      const result = applyBold('hello', 5, 5);
      expect(result.text).toBe('hello****');
      expect(result.selectionStart).toBe(7);
      expect(result.selectionEnd).toBe(7);
    });
  });

  describe('applyItalic', () => {
    it('wraps selected text with * markers', () => {
      const result = applyItalic('hello world', 6, 11);
      expect(result.text).toBe('hello *world*');
      expect(result.selectionStart).toBe(7);
      expect(result.selectionEnd).toBe(12);
    });

    it('inserts ** with cursor between when no selection', () => {
      const result = applyItalic('hello', 5, 5);
      expect(result.text).toBe('hello**');
      expect(result.selectionStart).toBe(6);
      expect(result.selectionEnd).toBe(6);
    });
  });

  describe('applyHeading', () => {
    it('inserts ## at the beginning of the current line', () => {
      const result = applyHeading('hello', 3, 3);
      expect(result.text).toBe('## hello');
      expect(result.selectionStart).toBe(6);
    });

    it('inserts ## at the correct line in multiline text', () => {
      const result = applyHeading('line1\nline2\nline3', 8, 8);
      expect(result.text).toBe('line1\n## line2\nline3');
    });
  });

  describe('applyUnorderedList', () => {
    it('inserts - at the beginning of the current line', () => {
      const result = applyUnorderedList('hello', 3, 3);
      expect(result.text).toBe('- hello');
      expect(result.selectionStart).toBe(5);
    });
  });

  describe('applyOrderedList', () => {
    it('inserts 1. at the beginning of the current line', () => {
      const result = applyOrderedList('hello', 3, 3);
      expect(result.text).toBe('1. hello');
      expect(result.selectionStart).toBe(6);
    });
  });

  describe('applyCodeBlock', () => {
    it('wraps selected text with triple backtick fences', () => {
      const result = applyCodeBlock('hello world', 6, 11);
      expect(result.text).toBe('hello ```\nworld\n```');
      expect(result.selectionStart).toBe(10);
      expect(result.selectionEnd).toBe(15);
    });

    it('inserts empty fenced block when no selection', () => {
      const result = applyCodeBlock('hello', 5, 5);
      expect(result.text).toBe('hello```\n\n```');
      expect(result.selectionStart).toBe(9);
      expect(result.selectionEnd).toBe(9);
    });
  });

  describe('applyLink', () => {
    it('wraps selected text as link text', () => {
      const result = applyLink('hello world', 6, 11);
      expect(result.text).toBe('hello [world](url)');
      expect(result.selectionStart).toBe(7);
      expect(result.selectionEnd).toBe(12);
    });

    it('inserts [text](url) template when no selection', () => {
      const result = applyLink('hello', 5, 5);
      expect(result.text).toBe('hello[text](url)');
      expect(result.selectionStart).toBe(6);
      expect(result.selectionEnd).toBe(10);
    });
  });
});
