/**
 * Normalizes AI-generated policy content to standard 9-section structure
 * Converts any format → consistent HTML-formatted policy document
 */

const REQUIRED_SECTIONS = [
  'Policy Rules',
  'Manager Notes',
  'Where it Belongs in Handbook'
];

export function formatPolicyContent(rawContent, mode = "modernize") {
  if (!rawContent || typeof rawContent !== 'string') return '';

  // Step 1: Remove all markdown
  const cleaned = removeMarkdown(rawContent);

  // Step 2: Extract sections from cleaned content
  const extracted = extractSections(cleaned);

  // Step 3: Normalize sections (only enforce 9-section template in "generator" mode)
  const normalized = mode === "generator" 
    ? normalizeSections(extracted)
    : preserveStructureSections(extracted);

  // Step 4: Format as HTML with proper structure
  return formatAsHTML(normalized, mode);
}

function removeMarkdown(content) {
  return content
    .replace(/^#+\s+/gm, '')                    // Remove markdown headers (# ## ###)
    .replace(/\*\*(.+?)\*\*/g, '$1')            // Remove bold markers (**)
    .replace(/\*(.+?)\*/g, '$1')                // Remove italic markers (*)
    .replace(/```[\s\S]*?```/g, '')             // Remove code blocks
    .replace(/`(.+?)`/g, '$1')                  // Remove inline code
    .replace(/---+/g, '')                       // Remove horizontal rules
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Convert markdown links to plain text
    .trim();
}

function extractSections(content) {
  const sections = {};
  const lines = content.split('\n').filter(l => l.trim());

  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Try to match a section header
    const sectionMatch = matchSectionHeader(trimmed);

    if (sectionMatch) {
      // Save previous section
      if (currentSection && currentContent.length) {
        sections[currentSection] = currentContent
          .map(l => l.trim())
          .filter(l => l)
          .join('\n');
      }
      currentSection = sectionMatch;
      currentContent = [];
    } else if (currentSection && trimmed) {
      currentContent.push(trimmed);
    } else if (!currentSection && trimmed && !Object.keys(sections).length) {
      // Content before any section header → goes to Policy Overview
      if (!sections['Policy Overview']) {
        sections['Policy Overview'] = trimmed;
      }
    }
  }

  // Save last section
  if (currentSection && currentContent.length) {
    sections[currentSection] = currentContent
      .map(l => l.trim())
      .filter(l => l)
      .join('\n');
  }

  return sections;
}

function matchSectionHeader(line) {
  const normalized = line
    .replace(/:/g, '')           // Remove trailing colons
    .trim()
    .toLowerCase();

  // Fuzzy match against required sections
  for (const section of REQUIRED_SECTIONS) {
    if (normalized === section.toLowerCase() || 
        normalized.includes(section.toLowerCase())) {
      return section;
    }
  }

  return null;
}

function preserveStructureSections(extracted) {
  // In non-generator modes: preserve original structure EXACTLY
  // Do NOT rename, reorder, or add placeholders
  // User-written headings are source of truth
  return extracted;
}

function normalizeSections(extracted) {
  const normalized = {};

  // Iterate through required sections in order
  for (const section of REQUIRED_SECTIONS) {
    // Find matching section (case-insensitive)
    const matchedKey = Object.keys(extracted).find(
      key => key.toLowerCase() === section.toLowerCase()
    );

    if (matchedKey && extracted[matchedKey]) {
      normalized[section] = extracted[matchedKey];
    } else {
      // Generate default placeholder
      normalized[section] = generatePlaceholder(section);
    }
  }

  // Capture any unknown sections under "Additional Notes"
  const unknownSections = Object.keys(extracted).filter(
    key => !REQUIRED_SECTIONS.some(
      req => req.toLowerCase() === key.toLowerCase()
    )
  );

  if (unknownSections.length > 0) {
    const additionalContent = unknownSections
      .map(key => `${key}:\n${extracted[key]}`)
      .join('\n\n');
    
    if (normalized['Revision History']) {
      normalized['Revision History'] += '\n\nAdditional Notes:\n' + additionalContent;
    } else {
      normalized['Revision History'] = 'Additional Notes:\n' + additionalContent;
    }
  }

  return normalized;
}

function generatePlaceholder(section) {
  const placeholders = {
    'Policy Rules': 'Add policy rules and guidelines here.',
    'Manager Notes': 'Add manager responsibilities if applicable.',
    'Where it Belongs in Handbook': 'Add handbook category (e.g., Scheduling, Safety, Operations).'
  };

  return placeholders[section] || 'To be defined.';
}

/**
 * Guard function: Prevents content deletion in non-generator modes
 * Returns true if content can be modified, false if it must be preserved
 */
export function canModifyContent(existingContent, mode) {
  // Generator mode can create/modify freely
  if (mode === "generator") return true;
  
  // Non-generator modes can only enhance, never delete
  // If there's existing content, preserve block positions
  return !(existingContent && existingContent.trim().length > 0);
}

function formatAsHTML(sections, mode = "modernize") {
  const html = [];
  
  // SIMPLE POLICY FORMAT: Policy Title (intro) + Policy Rules + Manager Notes + Handbook Category
  // In generator mode: ensure all sections present
  // In other modes: only include non-empty sections
  
  const sectionKeys = mode === "generator" ? REQUIRED_SECTIONS : Object.keys(sections);

  for (const section of sectionKeys) {
    const content = sections[section] || '';
    
    // CRITICAL: In non-generator modes, skip empty sections (never add placeholders)
    if (mode !== "generator" && !content.trim()) {
      continue;
    }

    // Open section wrapper
    html.push(`<div class="policy-section">`);

    // Section header as h2
    html.push(`<h2>${section}</h2>`);

    // Normalize content paragraphs
    const blockParagraphs = content
      .split('\n\n')
      .map(p => normalizeParagraph(p))
      .filter(p => p.trim());

    if (blockParagraphs.length > 0) {
      blockParagraphs.forEach(block => {
        // Detect if block is a list (contains dash or bullet markers)
        const hasListMarkers = /^\s*[-•]\s/.test(block) || block.includes('\n-') || block.includes('\n•');
        
        if (hasListMarkers) {
          // Convert to proper <ul><li> list
          const listItems = block
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[-•]\s*/, '').trim())
            .filter(item => item.length > 0);
          
          if (listItems.length > 0) {
            html.push(`<ul>`);
            listItems.forEach(item => {
              html.push(`<li>${item}</li>`);
            });
            html.push(`</ul>`);
          }
        } else {
          // Split block into sentence-based paragraphs
          const sentences = splitIntoSentences(block);
          let sentenceGroup = [];
          
          sentences.forEach(sentence => {
            sentenceGroup.push(sentence);
            
            if (sentenceGroup.length >= 3) {
              html.push(`<p>${sentenceGroup.join(' ')}</p>`);
              sentenceGroup = [];
            }
          });
          
          if (sentenceGroup.length > 0) {
            html.push(`<p>${sentenceGroup.join(' ')}</p>`);
          }
        }
      });
    } else if (mode === "generator") {
      // ONLY in generator mode: add placeholder for empty section
      html.push(`<p>${generatePlaceholder(section)}</p>`);
    }

    // Close section wrapper
    html.push(`</div>`);
  }

  return html.join('\n');
}

function normalizeParagraph(text) {
  if (!text) return '';

  // Remove leading list numbering (1. 1.1 1) etc.)
  let normalized = text
    .replace(/^\s*\d+[\.\)]\s+/gm, '')      // Remove numbered list markers
    .replace(/^\s*\d+\.\d+[\.\)]\s+/gm, '')  // Remove sub-numbered markers
    .replace(/\n/g, ' ')                      // Replace newlines with spaces
    .replace(/\s{2,}/g, ' ')                  // Collapse multiple spaces into one
    .trim();

  return normalized;
}

function splitIntoSentences(text) {
  if (!text) return [];

  const sentences = [];
  let current = '';

  // Common abbreviations to avoid splitting on
  const abbreviations = ['e.g.', 'i.e.', 'u.s.', 'etc.', 'vs.', 'inc.', 'ltd.', 'co.', 'dr.', 'mr.', 'ms.', 'mrs.'];

  for (let i = 0; i < text.length; i++) {
    current += text[i];

    // Check if we hit a period
    if (text[i] === '.') {
      const lookAhead = text.substring(Math.max(0, i - 3), i).toLowerCase();
      const isAbbreviation = abbreviations.some(abbr => lookAhead.endsWith(abbr.slice(0, -1)));

      // Split on period + space + capital letter, BUT not if it's an abbreviation
      if (
        !isAbbreviation &&
        text[i + 1] === ' ' &&
        text[i + 2] &&
        /[A-Z]/.test(text[i + 2])
      ) {
        sentences.push(current.trim());
        current = '';
        i += 1; // Skip the space
      }
    }
  }

  // Push remaining text as final sentence
  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences.length > 0 ? sentences : [text];
}