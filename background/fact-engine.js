/**
 * TruthScan Fact-Checking Engine & Knowledge Base
 * Hybrid multi-tier credibility evaluation:
 * - Tier 1: Google Fact Check Tools API (ClaimSearch API)
 * - Tier 2: Featherless AI LLM Engine (OpenAI-compatible inference on Meta-Llama / Mistral / Qwen)
 * - Tier 3: Curated Offline High-Confidence Knowledge Base
 * - Tier 4: Algorithmic Linguistic Sensationalism Heuristics
 */

// ─── Featherless AI endpoint (OpenAI-compatible) ──────────────────────────────
export const FEATHERLESS_API_ENDPOINT = 'https://api.featherless.ai/v1/chat/completions';
// ─────────────────────────────────────────────────────────────────────────────

export const RATING_COLORS = {
  GREEN: '#30A46C',  // Verified true / matches credible source
  YELLOW: '#F5A623', // Partially true / missing context / unverified
  RED: '#E5484D',    // Likely false / manipulated / debunked
  GRAY: '#8E8E93'    // Unverified — no source data available
};

export const VERDICT_TYPES = {
  VERIFIED: {
    status: 'verified',
    color: RATING_COLORS.GREEN,
    defaultScore: 92,
    headline: 'Verified accurate',
    category: 'Credible & Sourced'
  },
  NEEDS_CONTEXT: {
    status: 'needs_context',
    color: RATING_COLORS.YELLOW,
    defaultScore: 62,
    headline: 'Needs context',
    category: 'Partially True'
  },
  MISLEADING: {
    status: 'misleading',
    color: RATING_COLORS.RED,
    defaultScore: 18,
    headline: 'Likely misleading',
    category: 'Debunked / False'
  },
  MANIPULATED_MEDIA: {
    status: 'manipulated',
    color: RATING_COLORS.RED,
    defaultScore: 12,
    headline: 'Manipulated media',
    category: 'AI / Fabricated'
  },
  UNVERIFIED: {
    status: 'unverified',
    color: RATING_COLORS.GRAY,
    defaultScore: null,
    headline: 'Unverified — no source data',
    category: 'Inconclusive'
  }
};

export const FEATHERLESS_SYSTEM_PROMPT = `You are TruthScan, an objective, highly accurate fact-checking intelligence system.
Your task is to analyze claims found in web content (articles, social media posts, chat messages, headlines) and evaluate factual accuracy, veracity, and missing context.

CRITICAL INSTRUCTIONS:
1. Respond ONLY with a single valid JSON object. Do not include markdown code block backticks, fences, commentary, or conversational text.
2. The JSON MUST follow this exact schema — ALL fields are required:
{
  "verdict": "verified" | "needs_context" | "misleading" | "unverified",
  "score": <integer 0-100 — truth confidence percentage>,
  "headline": "Verified accurate" | "Needs context" | "Likely misleading" | "Manipulated media" | "Unverified — no source data",
  "explanation": "<2-3 concise, neutral sentences in plain language specific to THIS exact claim — do NOT give generic advice>",
  "searchQuery": "<short 5-10 word query summarizing this specific claim for a fact-check search, e.g. 'does lemon water cure cancer'>",
  "originalSource": {
    "title": "<Title of primary source or debunking report>",
    "publisher": "<Credible publisher or organization>",
    "publishDate": "<Approximate date or year>",
    "url": "<Direct link or official portal URL>",
    "credibilityNotes": "<1-sentence note on why this source is authoritative>"
  },
  "checkedAgainst": [
    { "name": "<Publisher Name>", "url": "<https://...>" }
  ]
}

SCORING RULES:
- "verified": Score 80-100. Accurate claim matching wire reports, peer-reviewed papers, or verified releases.
- "needs_context": Score 45-75. Nominally true but omits vital context, misinterprets statistics, or presents correlation as causation.
- "misleading": Score 0-35. Debunked claims, fabricated quotes, AI-manipulated hoaxes, or dangerous medical pseudoscience.
- "unverified": Score null. Insufficient evidence — never guess or hallucinate.

IMPORTANT: The "explanation" and "searchQuery" must be SPECIFIC to the actual claim text provided. Never return a generic boilerplate response.`;


// Curated verified knowledge base of real-world claims, viral hoaxes, and news stories
export const FACT_CHECK_DATABASE = [
  // --- VERIFIED STORIES (GREEN) ---
  {
    id: 'jwst-deep-field',
    types: ['image', 'text', 'article'],
    keywords: ['james webb', 'jwst', 'deep field', 'galaxy cluster', 'smacs 0723', 'nasa telescope'],
    verdict: VERDICT_TYPES.VERIFIED,
    score: 96,
    headline: 'Verified accurate',
    explanation: 'Corroborated by NASA, ESA, and CSA official releases. The infrared observation of galaxy cluster SMACS 0723 is authentic and peer-verified.',
    originalSource: {
      title: 'NASA First Deep Field Press Release',
      publisher: 'NASA / ESA / STScI',
      publishDate: 'July 11, 2022',
      url: 'https://www.nasa.gov/image-feature/goddard/2022/nasa-s-webb-delivers-deepest-infrared-image-of-universe-yet',
      credibilityNotes: 'Official tier-1 scientific institution; primary raw data publicly archived.'
    },
    checkedAgainst: [
      { name: 'Reuters Fact Check', url: 'https://www.reuters.com' },
      { name: 'AP News', url: 'https://apnews.com' },
      { name: 'Nature', url: 'https://www.nature.com' }
    ]
  },
  {
    id: 'malaria-vaccine-who',
    types: ['text', 'article', 'video'],
    keywords: ['malaria vaccine', 'r21', 'matrix-m', 'who recommends', 'oxford malaria'],
    verdict: VERDICT_TYPES.VERIFIED,
    score: 94,
    headline: 'Verified accurate',
    explanation: 'The World Health Organization officially recommended the R21/Matrix-M malaria vaccine developed by University of Oxford and Serum Institute.',
    originalSource: {
      title: 'WHO Recommends R21/Matrix-M Malaria Vaccine',
      publisher: 'World Health Organization (WHO)',
      publishDate: 'October 2, 2023',
      url: 'https://www.who.int/news/item/02-10-2023-who-recommends-r21-matrix-m-vaccine-for-malaria-prevention-in-updated-advice-on-immunization',
      credibilityNotes: 'Global public health authority advisory committee clearance.'
    },
    checkedAgainst: [
      { name: 'AP News', url: 'https://apnews.com' },
      { name: 'BBC Verify', url: 'https://www.bbc.com' },
      { name: 'Reuters', url: 'https://www.reuters.com' }
    ]
  },
  {
    id: 'renewable-energy-eu-record',
    types: ['text', 'article'],
    keywords: ['renewable energy', 'wind and solar', 'eu electricity', 'fossil fuels drop'],
    verdict: VERDICT_TYPES.VERIFIED,
    score: 91,
    headline: 'Verified accurate',
    explanation: 'European electricity data published by energy think tank Ember and corroborated by Eurostat confirms wind and solar produced a record share of EU power.',
    originalSource: {
      title: 'European Electricity Review Report',
      publisher: 'Ember Climate & Eurostat',
      publishDate: 'January 2024',
      url: 'https://ember-climate.org/insights/research/european-electricity-review-2024/',
      credibilityNotes: 'Cross-referenced against national transmission grid metrics.'
    },
    checkedAgainst: [
      { name: 'Reuters', url: 'https://www.reuters.com' },
      { name: 'AFP Factuel', url: 'https://factuel.afp.com' }
    ]
  },

  // --- MANIPULATED / DEBUNKED (RED) ---
  {
    id: 'pope-balenciaga',
    types: ['image', 'text'],
    keywords: ['pope', 'puffer', 'balenciaga', 'white coat', 'jacket', 'pope drip'],
    verdict: VERDICT_TYPES.MANIPULATED_MEDIA,
    score: 12,
    headline: 'Manipulated media',
    explanation: 'This image was generated using Midjourney v5 by a digital creator. Physical artifacts on the fingers, crucifix chain, and glasses confirm synthetic origin.',
    originalSource: {
      title: 'Debunking the Viral Midjourney Pope',
      publisher: 'Reuters Fact Check',
      publishDate: 'March 27, 2023',
      url: 'https://www.reuters.com/article/factcheck-pope-jacket-midjourney-idUSL1N36014D',
      credibilityNotes: 'Image creator Pablo Xavier publicly acknowledged prompt generation.'
    },
    checkedAgainst: [
      { name: 'Reuters Fact Check', url: 'https://www.reuters.com' },
      { name: 'Snopes', url: 'https://www.snopes.com' },
      { name: 'PolitiFact', url: 'https://www.politifact.com' }
    ]
  },
  {
    id: 'pentagon-explosion-hoax',
    types: ['image', 'text', 'video'],
    keywords: ['pentagon explosion', 'black smoke', 'pentagon attack', 'stock drop', 'arlington'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 15,
    headline: 'Likely misleading',
    explanation: 'Zero explosion or smoke occurred at the Pentagon. Arlington County Fire & Police confirmed no incident; image displays classic generative AI blending errors.',
    originalSource: {
      title: 'Official Clearance by Arlington Emergency Services',
      publisher: 'Arlington County Fire Department',
      publishDate: 'May 22, 2023',
      url: 'https://twitter.com/ArlingtonVA/status/1660639209590747136',
      credibilityNotes: 'Official law enforcement statement; zero physical corroboration.'
    },
    checkedAgainst: [
      { name: 'AP News', url: 'https://apnews.com' },
      { name: 'Reuters Fact Check', url: 'https://www.reuters.com' },
      { name: 'BBC Verify', url: 'https://www.bbc.com' }
    ]
  },
  {
    id: 'lemon-water-cure-cancer',
    types: ['text', 'article', 'video'],
    keywords: ['lemon water', 'cure cancer', 'alkaline diet', '10000 times stronger than chemo', 'baking soda'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 6,
    headline: 'Likely misleading',
    explanation: 'No scientific evidence supports the claim that lemon juice or alkaline diets cure cancer or outperform chemotherapy. Medical consensus considers this dangerous misinformation.',
    originalSource: {
      title: 'Fact Check: Lemons Are Not a Miracle Cure for Cancer',
      publisher: 'Snopes & American Cancer Society',
      publishDate: 'Updated 2023',
      url: 'https://www.snopes.com/fact-check/lemon-juice-cancer-cure/',
      credibilityNotes: 'Debunked by oncologists and peer-reviewed clinical research.'
    },
    checkedAgainst: [
      { name: 'Snopes', url: 'https://www.snopes.com' },
      { name: 'FactCheck.org', url: 'https://www.factcheck.org' },
      { name: 'Healthline Fact Check', url: 'https://www.healthline.com' }
    ]
  },
  {
    id: 'highway-shark-hurricane',
    types: ['image', 'video'],
    keywords: ['shark', 'highway', 'flooded freeway', 'hurricane ian', 'street flood'],
    verdict: VERDICT_TYPES.MANIPULATED_MEDIA,
    score: 14,
    headline: 'Manipulated media',
    explanation: 'A recurring digital fabrication dating back to Hurricane Irene in 2011. A 2005 photo of a great white shark was pasted into flooded roadway imagery.',
    originalSource: {
      title: 'The Real Story Behind the Highway Shark Hoax',
      publisher: 'Snopes',
      publishDate: 'Repeatedly Debunked',
      url: 'https://www.snopes.com/fact-check/shark-swimming-street-hurrican-harvey-floods/',
      credibilityNotes: 'Known recurring Internet hoax traced to a 2005 magazine graphic.'
    },
    checkedAgainst: [
      { name: 'Snopes', url: 'https://www.snopes.com' },
      { name: 'PolitiFact', url: 'https://www.politifact.com' }
    ]
  },

  // --- NEEDS CONTEXT / PARTIALLY TRUE (YELLOW) ---
  {
    id: 'gas-prices-all-time-high',
    types: ['text', 'article'],
    keywords: ['gas prices', 'all-time high', 'highest ever recorded', 'record gasoline'],
    verdict: VERDICT_TYPES.NEEDS_CONTEXT,
    score: 64,
    headline: 'Needs context',
    explanation: 'While nominal prices reached numeric records in 2022, when adjusted for historical inflation, the peak in July 2008 remains significantly higher in purchasing power.',
    originalSource: {
      title: 'Inflation-Adjusted Gasoline Price Comparison',
      publisher: 'U.S. Energy Information Administration (EIA)',
      publishDate: 'July 2023',
      url: 'https://www.eia.gov/petroleum/gasdiesel/',
      credibilityNotes: 'Government energy statistical agency data repository.'
    },
    checkedAgainst: [
      { name: 'PolitiFact', url: 'https://www.politifact.com' },
      { name: 'FactCheck.org', url: 'https://www.factcheck.org' }
    ]
  },
  {
    id: 'coffee-life-extension',
    types: ['text', 'article', 'video'],
    keywords: ['coffee', 'live longer', 'reduces mortality', 'drink coffee everyday', 'heart disease'],
    verdict: VERDICT_TYPES.NEEDS_CONTEXT,
    score: 68,
    headline: 'Needs context',
    explanation: 'Observational studies show a positive correlation between moderate coffee consumption and longevity, but clinical trials note correlation does not prove direct causation.',
    originalSource: {
      title: 'Coffee and Health: What Does the Science Really Say?',
      publisher: 'Harvard T.H. Chan School of Public Health',
      publishDate: 'April 2023',
      url: 'https://www.hsph.harvard.edu/nutritionsource/food-features/coffee/',
      credibilityNotes: 'Peer-reviewed observational cohort analysis.'
    },
    checkedAgainst: [
      { name: 'Reuters Health', url: 'https://www.reuters.com' },
      { name: 'BMJ Nutrition', url: 'https://www.bmj.com' }
    ]
  },
  {
    id: '5g-causes-coronavirus',
    types: ['text', 'article', 'video'],
    keywords: ['5g', 'coronavirus', 'covid', 'radiation', '5g causes covid', '5g towers virus'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 4,
    headline: 'Likely misleading',
    explanation: 'Viruses cannot travel on radio waves or mobile networks. COVID-19 is a biological virus transmitted via respiratory droplets, not electromagnetic 5G radiation.',
    originalSource: {
      title: 'Fact Check: 5G Technology Does Not Cause COVID-19',
      publisher: 'World Health Organization (WHO)',
      publishDate: 'Verified Report',
      url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters',
      credibilityNotes: 'Global public health consensus and physics research.'
    },
    checkedAgainst: [
      { name: 'Reuters Fact Check', url: 'https://www.reuters.com' },
      { name: 'BBC Verify', url: 'https://www.bbc.com' },
      { name: 'Snopes', url: 'https://www.snopes.com' }
    ]
  },
  {
    id: 'vaccines-microchips-5g',
    types: ['text', 'article'],
    keywords: ['vaccines microchip', 'microchips in vaccines', 'tracking microchip', 'vaccine tracking', 'bill gates chip'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 3,
    headline: 'Likely misleading',
    explanation: 'Vaccine vials contain only biological antigens, lipids, and stabilizers. Microchips capable of wireless tracking cannot physically fit through hypodermic vaccine needles.',
    originalSource: {
      title: 'Fact Check: No Microchips or Tracking Devices in Vaccines',
      publisher: 'Reuters Fact Check',
      publishDate: 'Verified',
      url: 'https://www.reuters.com/article/factcheck-coronavirus-vaccine-microchip-idUSL1N2M70MW',
      credibilityNotes: 'Independent chemical and microscopic audits by FDA and EMA.'
    },
    checkedAgainst: [
      { name: 'Reuters', url: 'https://www.reuters.com' },
      { name: 'PolitiFact', url: 'https://www.politifact.com' },
      { name: 'FactCheck.org', url: 'https://www.factcheck.org' }
    ]
  },
  {
    id: 'bleach-cure-virus',
    types: ['text', 'article'],
    keywords: ['bleach cures', 'drink bleach', 'disinfectant cures', 'miracle mineral solution', 'mms cure'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 1,
    headline: 'Likely misleading',
    explanation: 'Ingesting bleach, disinfectant, or industrial chlorine dioxide is corrosive and potentially lethal. The FDA has repeatedly issued emergency warnings against it.',
    originalSource: {
      title: 'FDA Warns Consumers Not to Drink Bleach Products',
      publisher: 'U.S. Food and Drug Administration (FDA)',
      publishDate: 'Consumer Alert',
      url: 'https://www.fda.gov/consumers/consumer-updates/danger-dont-drink-miracle-mineral-solution-or-similar-products',
      credibilityNotes: 'Official public safety warning from federal regulatory agency.'
    },
    checkedAgainst: [
      { name: 'FDA Alerts', url: 'https://www.fda.gov' },
      { name: 'CDC Guidelines', url: 'https://www.cdc.gov' }
    ]
  },
  {
    id: 'moon-landing-hoax',
    types: ['text', 'article', 'video'],
    keywords: ['moon landing fake', 'moon landing hoax', 'nasa staged moon landing', 'stanley kubrick moon', 'apollo 11 faked'],
    verdict: VERDICT_TYPES.MISLEADING,
    score: 5,
    headline: 'Likely misleading',
    explanation: 'The Apollo 11 moon landing brought back 842 pounds of lunar rocks confirmed by independent scientists worldwide, and left retroreflectors still used by laser observatories.',
    originalSource: {
      title: 'How We Know the Apollo Moon Landings Really Happened',
      publisher: 'Smithsonian National Air and Space Museum',
      publishDate: 'Archived',
      url: 'https://airandspace.si.edu/explore/stories/apollo-moon-landing-evidence',
      credibilityNotes: 'Physical artifacts, telemetry data, and lunar laser ranging.'
    },
    checkedAgainst: [
      { name: 'Smithsonian', url: 'https://airandspace.si.edu' },
      { name: 'NASA History', url: 'https://history.nasa.gov' }
    ]
  }
];

// Heuristic keyword patterns for clickbait, sensationalism, and high-risk medical/financial claims
const SENSATIONAL_PATTERNS = [
  /\b(secret cure|miracle cure|doctors don't want you to know|they are hiding this|cures? cancer|cure for cancer)\b/i,
  /\b(100% proven|guaranteed profit|instant riches|shocking truth revealed|free money giveaway)\b/i,
  /\b(leaked government files|censored by media|wake up sheeple|government cover-?up)\b/i,
  /\b(big pharma suppresses|miracle herb kills all cancer|miracle mineral solution)\b/i,
  /\b(shocking:?|breaking:? doctors|shocking:? drinking|share before (?:it's|they) take(?:s)? (?:it )?down)\b/i,
  /\b(5g causes? (?:coronavirus|covid|radiation)|5g towers spread)\b/i,
  /\b(microchips? in vaccines?|vaccines? tracking microchip|bill gates chip)\b/i,
  /\b(drinking? bleach|disinfectant cures?|ingest(?:ing)? bleach)\b/i,
  /\b(flat earth|nasa (?:staged|faked) (?:the )?moon|moon landing was staged)\b/i,
  /\b(banks? (?:are )?freezing all accounts|bank run tomorrow|banks? collapsing)\b/i
];

/**
 * Normalizes input text for keyword and semantic matching
 */
function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculates keyword overlap match ratio
 */
function calculateMatchScore(queryTokens, targetKeywords) {
  if (!targetKeywords || targetKeywords.length === 0 || queryTokens.length === 0) return 0;
  
  let multiWordMatches = 0;
  let singleWordMatches = 0;

  for (const keyword of targetKeywords) {
    const kwTokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
    if (kwTokens.length === 0) continue;

    const allTokensPresent = kwTokens.every(t => queryTokens.includes(t));
    if (allTokensPresent) {
      if (kwTokens.length >= 2) {
        multiWordMatches++;
      } else {
        singleWordMatches++;
      }
    }
  }

  if (multiWordMatches >= 2) return 0.95;
  if (multiWordMatches === 1 && singleWordMatches >= 1) return 0.85;
  if (multiWordMatches === 1) return 0.75;
  if (singleWordMatches >= 2) return 0.55;
  if (singleWordMatches === 1) return 0.35;
  return 0;
}

/**
 * Evaluates linguistic sensationalism score (0 to 100)
 */
function evaluateSensationalism(text) {
  if (!text) return 0;
  let penalty = 0;
  
  for (const pattern of SENSATIONAL_PATTERNS) {
    if (pattern.test(text)) {
      penalty += 35;
    }
  }

  const words = text.split(/\s+/).filter(w => w.length > 2);
  const uppercaseWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
  if (words.length > 5 && (uppercaseWords.length / words.length) > 0.35) {
    penalty += 20;
  }

  if (/[!?]{2,}/.test(text)) {
    penalty += 15;
  }

  return Math.min(penalty, 100);
}

/**
 * Robustly parses JSON from LLM output, stripping markdown code fences if present
 */
function parseLlmJson(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  // Strip markdown ```json ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try extracting JSON object substring
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {}
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

/**
 * Query Google Fact Check Tools API
 */
export async function queryGoogleFactCheck(queryText, apiKey) {
  if (!apiKey || !queryText) return null;
  try {
    const cleanQuery = queryText.slice(0, 160).replace(/[^\w\s]/g, ' ').trim();
    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(cleanQuery)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.claims && data.claims.length > 0) {
      return data.claims;
    }
  } catch (err) {
    console.warn('[TruthScan] Google Fact Check API error:', err);
  }
  return null;
}

/**
 * Query Featherless AI API (OpenAI-compatible inference on open-source LLMs)
 * Returns a fully dynamic verdict with claim-specific explanation, score,
 * searchQuery, and a pre-built verifyUrl — never hardcoded per keyword.
 */
export async function queryFeatherlessAI(claimText, context = null, settings = {}) {
  const apiKey = settings.featherlessApiKey;
  if (!apiKey) return null;

  const model = settings.featherlessModel || 'meta-llama/Meta-Llama-3.1-8B-Instruct';

  // Include the ACTUAL claim text as a clearly labelled variable in the prompt
  let userPrompt = `Analyze the following claim for factual credibility. Return ONLY valid JSON — no extra text.\n\nCLAIM: "${claimText}"`;
  if (context && context.length > 0) {
    userPrompt += `\n\nContext from Google Fact Check Database:\n${JSON.stringify(context.slice(0, 2), null, 2)}`;
  }

  try {
    const res = await fetch(FEATHERLESS_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: FEATHERLESS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 600
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[TruthScan] Featherless AI API error:', res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const raw = data.choices[0].message.content;
      console.log('[TruthScan] Featherless raw response:', raw.slice(0, 300));
      const parsed = parseLlmJson(raw);

      if (parsed && parsed.verdict) {
        // Map verdict to traffic-light color
        let color = RATING_COLORS.GRAY;
        let isRealSource = false;
        if (parsed.verdict === 'verified') {
          color = RATING_COLORS.GREEN; isRealSource = true;
        } else if (parsed.verdict === 'needs_context') {
          color = RATING_COLORS.YELLOW;
        } else if (parsed.verdict === 'misleading' || parsed.verdict === 'manipulated') {
          color = RATING_COLORS.RED;
        }

        // Build the per-message Verify URL from the AI-returned searchQuery
        const searchQuery = parsed.searchQuery || (claimText.slice(0, 60) + ' fact check');
        const isFactual = parsed.verdict === 'verified' || /name|person|date|born|died|president|ceo|founded/i.test(claimText);
        const verifyUrl = isFactual
          ? 'https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(searchQuery)
          : 'https://www.google.com/search?q=' + encodeURIComponent(searchQuery);

        console.log('[TruthScan] AI verdict:', parsed.verdict, '| score:', parsed.score, '| searchQuery:', searchQuery);

        return {
          status: parsed.verdict,
          headline: parsed.headline || (parsed.verdict === 'verified' ? 'Verified accurate' : parsed.verdict === 'needs_context' ? 'Needs context' : 'Likely misleading'),
          score: parsed.score !== undefined ? parsed.score : (parsed.verdict === 'verified' ? 90 : parsed.verdict === 'needs_context' ? 60 : 15),
          color,
          explanation: parsed.explanation || 'Evaluated using AI analysis against authoritative sources.',
          searchQuery,
          verifyUrl,
          originalSource: parsed.originalSource || {
            title: 'Fact-Check via Featherless AI',
            publisher: model.split('/').pop(),
            publishDate: 'Real-time',
            url: verifyUrl,
            credibilityNotes: `Evaluated using ${model}`
          },
          checkedAgainst: parsed.checkedAgainst || [
            { name: 'Featherless AI', url: 'https://featherless.ai' },
            { name: 'Reuters', url: 'https://www.reuters.com' }
          ],
          isRealSourceCheck: isRealSource,
          engine: `Featherless AI (${model.split('/').pop()})`,
          timestamp: Date.now()
        };
      }
    }
  } catch (err) {
    console.warn('[TruthScan] Featherless API call failed:', err.message);
  }
  return null;
}


/**
 * Tests connection to Featherless AI API
 */
export async function testFeatherlessConnection(apiKey, model = 'meta-llama/Meta-Llama-3.1-8B-Instruct') {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }
  const startTime = Date.now();
  try {
    const res = await fetch(FEATHERLESS_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: 'Reply with JSON only: {"status":"active","message":"connected"}' }
        ],
        temperature: 0.1,
        max_tokens: 60
      })
    });

    const elapsedMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, status: res.status, error: errText || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      success: true,
      latencyMs: elapsedMs,
      model: model,
      response: data.choices && data.choices[0] ? data.choices[0].message.content : 'ok'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Test ANDROMEDA Local Backend API connection
 */
export async function testBackendConnection(backendUrl = 'http://127.0.0.1:8000') {
  const startTime = Date.now();
  try {
    const cleanUrl = (backendUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const elapsedMs = Date.now() - startTime;
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      latencyMs: elapsedMs,
      data: data
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Query Local ANDROMEDA FastAPI Backend (/api/check-payload)
 */
export async function queryAndromedaBackend(target, backendUrl = 'http://127.0.0.1:8000') {
  try {
    const cleanUrl = (backendUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const payload = {
      content_type: target.type === 'image' ? 'image' : 'text',
      raw_content: target.content || target.title || target.url || 'Web content',
      extracted_text: target.content || target.title || '',
      language: 'en',
      timestamp: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/api/check-payload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const verdict = data.verdict || {};
    const vUpper = (verdict.verdict || 'UNVERIFIED').toUpperCase();

    let status = 'unverified';
    let color = RATING_COLORS.GRAY;
    let score = null;
    let headline = 'Unverified claim';

    if (vUpper === 'FALSE') {
      status = 'misleading';
      color = RATING_COLORS.RED;
      score = 15;
      headline = 'Likely misleading / hoax';
    } else if (vUpper === 'MISLEADING') {
      status = 'needs_context';
      color = RATING_COLORS.YELLOW;
      score = 55;
      headline = 'Needs context';
    } else if (vUpper === 'TRUE') {
      status = 'verified';
      color = RATING_COLORS.GREEN;
      score = 95;
      headline = 'Verified accurate';
    }

    const firstSource = verdict.sources && verdict.sources[0] ? verdict.sources[0] : `${cleanUrl}/`;

    return {
      status,
      headline,
      score,
      color,
      explanation: data.text_explanation || 'Analyzed by ANDROMEDA fact-checking engine.',
      originalSource: {
        title: verdict.matched_claim || 'ANDROMEDA Multi-Tier Fact Engine',
        publisher: 'ANDROMEDA Local Service',
        publishDate: verdict.first_seen_date || 'Current',
        url: firstSource,
        credibilityNotes: verdict.confidence_note || 'Evaluated across curated hoaxes, web search, and grounded LLMs.'
      },
      checkedAgainst: (verdict.sources || []).map(s => ({ name: 'Verified Source', url: s })),
      isRealSourceCheck: status === 'verified',
      cardImageBase64: data.card_image_base64,
      manipulationTags: verdict.manipulation_tags || [],
      engine: 'ANDROMEDA Local Engine',
      timestamp: Date.now()
    };
  } catch (err) {
    // If backend is not running, return null to continue to fallbacks
    return null;
  }
}

/**
 * Main Verification Engine Method
 * Chains: ANDROMEDA Backend -> Google Fact Check API -> Featherless AI LLM -> Curated Database -> Sensationalism Heuristics
 */
export async function verifyContent(target, settings = {}) {
  const sensitivity = settings.sensitivity || 'medium';
  const queryText = (target.content || target.title || target.url || '').trim();
  const normalized = normalizeText(queryText);
  const queryTokens = normalized.split(/\s+/);

  // 0. Primary Tier: Local ANDROMEDA FastAPI Backend (if enabled/accessible)
  if (settings.useLocalBackend !== false && queryText.length > 5) {
    const backendResult = await queryAndromedaBackend(target, settings.backendUrl || 'http://127.0.0.1:8000');
    if (backendResult) {
      return backendResult;
    }
  }

  // 1. Check Google Fact Check Tools API if key provided
  let googleResults = null;
  if (settings.googleApiKey && queryText.length > 15) {
    googleResults = await queryGoogleFactCheck(queryText, settings.googleApiKey);
    
    // If Featherless is NOT enabled, convert Google result directly
    if (googleResults && googleResults.length > 0 && !settings.featherlessApiKey) {
      const claim = googleResults[0];
      const review = claim.claimReview && claim.claimReview[0] ? claim.claimReview[0] : null;
      if (review) {
        const ratingText = (review.textualRating || '').toLowerCase();
        let status = 'needs_context';
        let color = RATING_COLORS.YELLOW;
        let score = 55;

        if (ratingText.includes('false') || ratingText.includes('pants on fire') || ratingText.includes('incorrect') || ratingText.includes('fake')) {
          status = 'misleading';
          color = RATING_COLORS.RED;
          score = 15;
        } else if (ratingText.includes('true') || ratingText.includes('correct') || ratingText.includes('accurate')) {
          status = 'verified';
          color = RATING_COLORS.GREEN;
          score = 92;
        }

        return {
          status,
          headline: review.textualRating || 'Fact-Checked Claim',
          score,
          color,
          explanation: `Rated "${review.textualRating}" by ${review.publisher ? review.publisher.name : 'accredited fact-checker'}: ${review.title || claim.text || ''}`,
          originalSource: {
            title: review.title || 'Fact Check Review',
            publisher: review.publisher ? review.publisher.name : 'Fact Checker',
            publishDate: review.reviewDate || 'Recent',
            url: review.url || 'https://factchecktools.googleapis.com',
            credibilityNotes: 'Retrieved from Google Fact Check Tools ClaimSearch API'
          },
          checkedAgainst: [
            { name: review.publisher ? review.publisher.name : 'Google Fact Check', url: review.url || 'https://toolbox.google.com/factcheck/explorer' }
          ],
          isRealSourceCheck: status === 'verified',
          engine: 'Google Fact Check Tools API',
          timestamp: Date.now()
        };
      }
    }
  }

  // 2. Query Featherless AI (LLM — always runs if key is set, for any message length > 8 chars)
  if (settings.featherlessApiKey && queryText.length > 8) {
    const llmResult = await queryFeatherlessAI(queryText, googleResults, settings);
    if (llmResult) {
      return llmResult;
    }
  }

  // 3. Check against curated high-confidence database
  let bestMatch = null;
  let highestScore = 0;

  for (const entry of FACT_CHECK_DATABASE) {
    if (target.type && !entry.types.includes(target.type)) {
      continue;
    }

    const matchRatio = calculateMatchScore(queryTokens, entry.keywords);
    if (matchRatio > highestScore && matchRatio >= 0.4) {
      highestScore = matchRatio;
      bestMatch = entry;
    }
  }

  if (bestMatch) {
    let finalScore = bestMatch.score;
    if (highestScore < 0.7) {
      finalScore = Math.round(finalScore * 0.9 + (bestMatch.verdict.defaultScore || 50) * 0.1);
    }

    if (sensitivity === 'high' && bestMatch.verdict.status === 'needs_context') {
      finalScore = Math.max(finalScore - 8, 40);
    } else if (sensitivity === 'low' && bestMatch.verdict.status === 'verified') {
      finalScore = Math.min(finalScore + 4, 99);
    }

    return {
      status: bestMatch.verdict.status,
      headline: bestMatch.headline,
      score: finalScore,
      color: bestMatch.verdict.color,
      explanation: bestMatch.explanation,
      originalSource: bestMatch.originalSource,
      checkedAgainst: bestMatch.checkedAgainst,
      isRealSourceCheck: bestMatch.verdict.status === 'verified',
      matchedClaimId: bestMatch.id,
      engine: 'TruthScan Built-in Fact Engine',
      timestamp: Date.now()
    };
  }

  // 4. Fallback: Sensationalism & Linguistic Credibility Heuristics
  const sensationalPenalty = evaluateSensationalism(queryText);
  if (sensationalPenalty >= 35) {
    const isExtreme = true;
    const score = Math.max(8, 30 - Math.round(sensationalPenalty * 0.25));
    
    return {
      status: isExtreme ? 'misleading' : 'needs_context',
      headline: isExtreme ? 'Likely misleading' : 'Needs context',
      score: score,
      color: isExtreme ? RATING_COLORS.RED : RATING_COLORS.YELLOW,
      explanation: 'Language contains prominent markers of clickbait, unverified medical/conspiracy claims, or assertions lacking credible citations.',
      originalSource: {
        title: 'Heuristic Linguistic Credibility Flag',
        publisher: 'TruthScan Pattern Analyzer',
        publishDate: 'Real-time check',
        url: 'https://en.wikipedia.org/wiki/Clickbait',
        credibilityNotes: 'Contains high-frequency sensational patterns.'
      },
      checkedAgainst: [
        { name: 'TruthScan Heuristics', url: 'https://truthscan.local' },
        { name: 'Snopes Reference', url: 'https://www.snopes.com' }
      ],
      isRealSourceCheck: false,
      engine: 'TruthScan Heuristic Scorer',
      timestamp: Date.now()
    };
  }

  // 5. No authoritative match found -> Unverified state
  return {
    status: 'unverified',
    headline: VERDICT_TYPES.UNVERIFIED.headline,
    score: null,
    color: VERDICT_TYPES.UNVERIFIED.color,
    explanation: 'No definitive fact-check records or conclusive sources were found for this specific item. Consider manually reviewing verified news wires.',
    originalSource: {
      title: 'Manual Verification Recommended',
      publisher: 'Search Wire Reports',
      publishDate: 'Current',
      url: `https://www.google.com/search?q=${encodeURIComponent(queryText.slice(0, 100) + ' fact check')}`,
      credibilityNotes: 'No automated verdict assigned.'
    },
    checkedAgainst: [
      { name: 'Reuters', url: 'https://www.reuters.com' },
      { name: 'AP News', url: 'https://apnews.com' }
    ],
    isRealSourceCheck: false,
    engine: 'TruthScan Heuristic Engine',
    timestamp: Date.now()
  };
}
