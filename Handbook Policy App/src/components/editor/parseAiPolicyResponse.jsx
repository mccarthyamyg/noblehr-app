/**
 * Parses AI policy responses to extract metadata and content
 * Handles both JSON and plain text responses from LLM
 */

export function parseAiPolicyResponse(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return {
      suggested_title: null,
      suggested_description: null,
      policy_content: ''
    };
  }

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(rawResponse);
    if (parsed.policy_content) {
      return {
        suggested_title: parsed.suggested_title || null,
        suggested_description: parsed.suggested_description || null,
        policy_content: parsed.policy_content
      };
    }
  } catch (e) {
    // Not JSON, continue with text parsing
  }

  // If not JSON, treat as plain text and attempt to extract metadata
  return extractMetadataFromText(rawResponse);
}

function extractMetadataFromText(text) {
  const lines = text.split('\n').filter(l => l.trim());
  
  let suggestedTitle = null;
  let suggestedDescription = null;

  // First non-empty line could be title
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // If it looks like a title (short, no punctuation at end)
    if (firstLine.length < 100 && !firstLine.endsWith(':')) {
      suggestedTitle = cleanTitleText(firstLine);
    }
  }

  // Second line could be description
  if (lines.length > 1) {
    const secondLine = lines[1].trim();
    if (secondLine.length > 20 && secondLine.length < 200) {
      suggestedDescription = cleanDescriptionText(secondLine);
    }
  }

  // If no title found, generate generic one
  if (!suggestedTitle) {
    suggestedTitle = inferTitleFromContent(text);
  }

  return {
    suggested_title: suggestedTitle,
    suggested_description: suggestedDescription,
    policy_content: text
  };
}

function cleanTitleText(text) {
  return text
    .replace(/^#+\s*/, '')           // Remove markdown
    .replace(/\*\*/g, '')            // Remove bold
    .replace(/[_`]/g, '')            // Remove other markdown
    .trim();
}

function cleanDescriptionText(text) {
  return text
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/[_`]/g, '')
    .replace(/\n/g, ' ')             // Remove newlines
    .trim();
}

function inferTitleFromContent(text) {
  // Look for common policy section headers
  const patterns = [
    /policy title:\s*(.+)/i,
    /^# (.+)/m,
    /^(.+) Policy/m
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return cleanTitleText(match[1]);
    }
  }

  // Fallback to generic
  return 'Company Policy';
}