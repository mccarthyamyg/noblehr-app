/**
 * Claude API — server-side only. Used for policy generation.
 * Set ANTHROPIC_API_KEY in env. When unset, generation is no-op.
 */
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;
const TEMPERATURE = 0.2;

/** Web search tool for policy generation — researches current law and standards (Truth #154). */
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 5 };

/**
 * Generate policy text from a prompt. Streams text deltas.
 * @param {Object} opts - prompt, orgName, industry, state (optional context)
 * @param {(chunk: string) => void} onChunk - called with each text delta
 * @returns {Promise<string>} full generated text
 */
export async function streamPolicyGeneration(opts, onChunk) {
  if (!client) {
    onChunk(''); // no-op stream
    return '';
  }
  const { prompt, orgName = '', industry = '', state = '' } = opts;
  const systemPrompt = `You are an HR policy writer. Generate clear, professional policy content.
Be concise. Use cross-references instead of repeating content. Each section should contain unique information.
Do not repeat the same points in multiple sections.
Context: Organization "${orgName}", industry: ${industry || 'general'}, state: ${state || 'not specified'}.`;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt || 'Generate a professional policy document.' }],
    tools: [WEB_SEARCH_TOOL],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta?.text) {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }
  return fullText;
}

/**
 * Single non-streaming call for simpler use cases (e.g. AI suggest in editor).
 */
export async function generatePolicyText(opts) {
  let result = '';
  await streamPolicyGeneration(opts, (chunk) => { result += chunk; });
  return result;
}

export function isClaudeConfigured() {
  return !!apiKey;
}

/**
 * Fast JavaScript-native text similarity function (Dice's Coefficient with Bigrams).
 * Enforces Truth #154 (80% similarity validation) without needing an external vector DB.
 */
function getBigrams(text) {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

export function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;
  const set1 = getBigrams(text1);
  const set2 = getBigrams(text2);
  let intersection = 0;
  for (const bg of set1) {
    if (set2.has(bg)) intersection++;
  }
  return (2.0 * intersection) / (set1.size + set2.size || 1);
}

export function validatePolicySimilarity(newContent, existingContents, threshold = 0.8) {
  let highest = 0;
  for (const text of existingContents) {
    const sim = calculateSimilarity(newContent, text);
    if (sim > highest) highest = sim;
  }
  return { isDuplicate: highest >= threshold, highestSimilarity: highest };
}

/**
 * Suggest 4–6 policy titles that are commonly missing from a handbook given current titles and org context.
 * @returns {Promise<string[]>}
 */
export async function scanHandbookMissing(opts) {
  if (!client) return [];
  const { currentTitles = [], state = '', industry = '' } = opts;
  const list = Array.isArray(currentTitles) ? currentTitles.join(', ') : String(currentTitles);
  const prompt = `Given an employee handbook that already includes these policies: ${list || '(none)'}.
Organization: state=${state || 'not specified'}, industry=${industry || 'general'}.
Return ONLY a JSON array of 4 to 6 suggested policy titles that are commonly missing (e.g. "Harassment Prevention", "Leave of Absence").
Output nothing else—no markdown, no explanation—just a single JSON array of strings.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed.slice(0, 6).filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Extract discrete policies from handbook text. Returns array of { title, content }.
 */
export async function extractPoliciesFromHandbook(handbookText) {
  if (!client || !handbookText?.trim()) return [];
  const prompt = `Extract each distinct policy from the following employee handbook text. For each policy, provide a short title and the full policy content.
Return ONLY a JSON array of objects with keys "title" and "content". Example: [{"title":"Anti-Harassment","content":"..."}].
Handbook text:\n\n${handbookText.slice(0, 80000)}`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed.filter(p => p && (p.title || p.content)).map(p => ({
      title: String(p.title || 'Untitled').slice(0, 200),
      content: String(p.content || '').slice(0, 50000),
    })) : [];
  } catch {
    return [];
  }
}

/**
 * Recommend policy titles for a new handbook (name, industry, state).
 */
export async function handbookRecommend(opts) {
  if (!client) return [];
  const { name = '', industry = '', state = '' } = opts;
  const prompt = `Recommend 10–15 policy titles for an employee handbook. Organization name: ${name}. Industry: ${industry}. State: ${state || 'not specified'}.
Return ONLY a JSON array of policy title strings. No other text.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Generate suggested policy content from user instruction and current draft (for editor AI assist).
 */
export async function policySuggest(opts) {
  if (!client) return '';
  const { currentDraftContent = '', userInstruction = '' } = opts;
  const systemPrompt = 'You are an HR policy editor. Apply the user\'s instruction to the current draft. Return ONLY the revised policy content—no explanation, no before/after labels.';
  const userContent = `Current draft:\n\n${currentDraftContent}\n\nUser instruction: ${userInstruction}`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  return text || '';
}

/**
 * Generate state-specific compliance checklist using web search (Truth #162).
 * Researches current state employer requirements; authoritative sources only.
 * @param {{ state: string, employeeCount?: number, industry?: string }} opts
 * @returns {Promise<Array<{ requirement_key: string, requirement_text: string, suggested_answer?: string, source_citation: string, source_url: string, required_or_recommended: string, employee_threshold?: number, category: string }>>}
 */
export async function generateComplianceChecklist(opts) {
  if (!client) return [];
  const state = (opts.state || '').trim();
  if (!state) return [];
  const employeeCount = opts.employeeCount != null ? Number(opts.employeeCount) : null;
  const industry = (opts.industry || '').trim() || 'general';
  const prompt = `Research current employment law compliance requirements for employers in the state of ${state}.
Employee count: ${employeeCount != null ? employeeCount : 'not specified'}. Industry: ${industry}.
Use web search to find authoritative sources only: .gov domains, state labor department sites, official statutes.
For each requirement return: requirement_key (snake_case, unique), requirement_text (plain language), suggested_answer (brief), source_citation (e.g. "M.G.L. c. 149, § 148C"), source_url (official link), required_or_recommended ("required" or "recommended"), employee_threshold (minimum employees for this to apply, or null if applies to all), category (one of: wage_and_hour, leave, safety, discrimination, posting, benefits, other).
Return ONLY a JSON array of objects with those keys. No markdown, no explanation. Include all state-specific requirements that apply; do not include federal baseline (EEO, ADA, FLSA, OSHA, I-9, anti-harassment, at-will) as those are already covered.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    const parsed = JSON.parse(text.trim().replace(/^```json?\s*|\s*```$/g, ''));
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    return parsed.filter(Boolean).map((p, i) => ({
      requirement_key: String(p.requirement_key || `state_${i}`).replace(/\s+/g, '_').slice(0, 80),
      requirement_text: String(p.requirement_text || '').slice(0, 2000),
      suggested_answer: p.suggested_answer != null ? String(p.suggested_answer).slice(0, 2000) : '',
      source_citation: String(p.source_citation || '').slice(0, 500),
      source_url: String(p.source_url || '').slice(0, 1000),
      required_or_recommended: ['required', 'recommended'].includes(p.required_or_recommended) ? p.required_or_recommended : 'required',
      employee_threshold: p.employee_threshold != null ? Math.max(0, parseInt(p.employee_threshold, 10)) : null,
      category: String(p.category || 'other').slice(0, 50),
      researched_at: now,
    }));
  } catch {
    return [];
  }
}

/**
 * Re-verify compliance checklist items against current sources (web search).
 * @param {{ items: Array<{ id: string, requirement_text: string, source_citation: string, source_url?: string }> }} opts
 * @returns {Promise<Array<{ id: string, verification_status: 'current'|'needs_review'|'changed'|'outdated', verified_at: string }>>}
 */
export async function verifyComplianceChecklist(opts) {
  if (!client) return [];
  const items = opts.items || [];
  if (items.length === 0) return [];
  const list = items.map(i => ({
    id: i.id,
    requirement_text: i.requirement_text,
    source_citation: i.source_citation,
    source_url: i.source_url || '',
  }));
  const prompt = `For each of the following compliance requirements, use web search to check whether the source citation is still current and whether the requirement has changed.
Return ONLY a JSON array of objects with keys: id, verification_status, verified_at (ISO datetime string).
verification_status must be one of: "current" (source confirms unchanged), "needs_review" (source updated, admin should review), "changed" (requirement materially changed), "outdated" (source link dead or statute repealed).
Items to verify:\n${JSON.stringify(list, null, 0)}`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  const now = new Date().toISOString();
  try {
    const parsed = JSON.parse(text.trim().replace(/^```json?\s*|\s*```$/g, ''));
    if (!Array.isArray(parsed)) return items.map(i => ({ id: i.id, verification_status: 'needs_review', verified_at: now }));
    const statuses = new Set(['current', 'needs_review', 'changed', 'outdated']);
    return parsed.filter(Boolean).map(p => ({
      id: p.id,
      verification_status: statuses.has(p.verification_status) ? p.verification_status : 'needs_review',
      verified_at: p.verified_at || now,
    }));
  } catch {
    return items.map(i => ({ id: i.id, verification_status: 'needs_review', verified_at: now }));
  }
}

/**
 * HR write-up assist: returns JSON-shaped suggestions for admin UI.
 */
export async function assistWriteUp(opts) {
  if (!client) return null;
  const { title = '', description = '', employeeRole = '', policyTitles = [] } = opts;
  const policyList = Array.isArray(policyTitles) ? policyTitles.filter(Boolean).join(', ') : String(policyTitles || '');
  const prompt = `You are an HR documentation assistant. Review this disciplinary/write-up draft and respond with professional suggestions only.

Title: ${title}
Description: ${description}
Employee role: ${employeeRole || 'Not specified'}
Active policy titles at this workplace: ${policyList || '(none listed)'}

Return ONLY a single JSON object (no markdown fences) with exactly these keys:
- wording_suggestion (string): improved neutral professional wording for the description if needed, or empty string if fine
- related_policies (array of strings): policy titles from the list above that may apply, or []
- discipline_level_suggestion (string): one of coaching_verbal, written_warning, final_warning, termination_review
- rationale (string): brief calm business-focused rationale

Keep tone factual and non-inflammatory.`;
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: TEMPERATURE,
    messages: [{ role: 'user', content: prompt }],
    tools: [WEB_SEARCH_TOOL],
  });
  const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    const parsed = JSON.parse(text.trim().replace(/^```json?\s*|\s*```$/g, ''));
    return {
      wording_suggestion: String(parsed.wording_suggestion ?? ''),
      related_policies: Array.isArray(parsed.related_policies) ? parsed.related_policies.map(String) : [],
      discipline_level_suggestion: String(parsed.discipline_level_suggestion ?? ''),
      rationale: String(parsed.rationale ?? ''),
    };
  } catch {
    return {
      wording_suggestion: '',
      related_policies: [],
      discipline_level_suggestion: '',
      rationale: 'Could not parse AI response. Try again or edit manually.',
    };
  }
}
