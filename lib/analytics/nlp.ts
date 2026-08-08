import { generateText, type LanguageModel } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Module #7.7: NLP (Natural Language Processing) Text Analysis.
 * 
 * Provides advanced text analysis capabilities including:
 * - Sentiment analysis
 * - Entity recognition (people, organizations, locations, dates, etc.)
 * - Text classification
 * - Keyword extraction
 * - Text summarization
 * - Intent detection
 * - Toxicity detection
 * - Language detection
 */

// Text analysis types
export type TextAnalysisType = 
  | "sentiment"
  | "entities"
  | "classification"
  | "keywords"
  | "summary"
  | "intent"
  | "toxicity"
  | "language"
  | "comprehensive"

// Entity types
export type EntityType = 
  | "PERSON"
  | "ORGANIZATION"
  | "LOCATION"
  | "DATE"
  | "TIME"
  | "MONEY"
  | "PERCENT"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "ADDRESS"

// Sentiment types
export type SentimentType = "positive" | "negative" | "neutral" | "mixed"

// Text classification categories
export type ClassificationCategory =
  | "business"
  | "technology"
  | "health"
  | "sports"
  | "entertainment"
  | "politics"
  | "finance"
  | "legal"
  | "education"
  | "travel"
  | "food"
  | "lifestyle"
  | "science"
  | "complaint"
  | "deviation"
  | "other"

// Intent types
export type IntentType = 
  | "question"
  | "command"
  | "statement"
  | "request"
  | "complaint"
  | "compliment"
  | "information_seeking"
  | "action_required"
  | "feedback"
  | "other"

// Analysis options
export interface NLPAnalysisOptions {
  /** Type of analysis to perform */
  analysisType: TextAnalysisType
  /** Specific entities to extract */
  entities?: EntityType[]
  /** Custom classification categories */
  classificationCategories?: string[]
  /** Keywords to look for */
  keywords?: string[]
  /** Length of summary (for summary type) */
  summaryLength?: "short" | "medium" | "long"
  /** Model to use */
  model?: LanguageModel
  /** Temperature (0-1) */
  temperature?: number
  /** Maximum tokens */
  maxOutputTokens?: number
}

// Sentiment analysis result
export interface SentimentResult {
  type: "sentiment"
  overall: SentimentType
  score: number // -1 (negative) to +1 (positive)
  confidence: number // 0-100
  sentences: Array<{
    text: string
    sentiment: SentimentType
    score: number
    start: number
    end: number
  }>
}

// Entity recognition result
export interface EntityResult {
  type: "entities"
  entities: Array<{
    text: string
    type: EntityType | string
    confidence: number
    start: number
    end: number
  }>
  counts: Record<EntityType | string, number>
}

// Text classification result
export interface ClassificationResult {
  type: "classification"
  primary: ClassificationCategory | string
  secondary: (ClassificationCategory | string)[]
  confidence: number
  categories: Array<{
    category: ClassificationCategory | string
    confidence: number
  }>
}

// Keyword extraction result
export interface KeywordResult {
  type: "keywords"
  keywords: Array<{
    keyword: string
    relevance: number
    frequency: number
  }>
  themes: string[]
}

// Text summarization result
export interface SummaryResult {
  type: "summary"
  summary: string
  keyPoints: string[]
  wordCount: number
  originalLength: number
  compressionRatio: number
}

// Intent detection result
export interface IntentResult {
  type: "intent"
  primary: IntentType | string
  confidence: number
  secondaryIntents: Array<{
    intent: IntentType | string
    confidence: number
  }>
}

// Toxicity detection result
export interface ToxicityResult {
  type: "toxicity"
  toxic: boolean
  score: number // 0-1
  categories: {
    toxic: { score: number; label: string }
    severe_toxic: { score: number; label: string }
    obscene: { score: number; label: string }
    threat: { score: number; label: string }
    insult: { score: number; label: string }
    identity_hate: { score: number; label: string }
  }
  flagged: string[]
}

// Language detection result
export interface LanguageResult {
  type: "language"
  language: string
  code: string
  confidence: number
  detectedText: string
}

// Comprehensive analysis result
export interface ComprehensiveResult {
  type: "comprehensive"
  sentiment: SentimentResult
  entities: EntityResult
  classification: ClassificationResult
  keywords: KeywordResult
  summary: SummaryResult
  intent: IntentResult
  toxicity: ToxicityResult
  language: LanguageResult
}

// Unified analysis result
export type NLPAnalysisResult = 
  | SentimentResult
  | EntityResult
  | ClassificationResult
  | KeywordResult
  | SummaryResult
  | IntentResult
  | ToxicityResult
  | LanguageResult
  | ComprehensiveResult

// Text document to analyze
export interface TextDocument {
  id?: string
  text: string
  title?: string
  source?: string
  language?: string
  metadata?: Record<string, unknown>
}

const DEFAULT_OPTIONS: Required<Omit<NLPAnalysisOptions, "analysisType">> = {
  entities: ["PERSON", "ORGANIZATION", "LOCATION", "DATE", "MONEY", "EMAIL", "PHONE", "URL"],
  classificationCategories: ["business", "technology", "health", "sports", "entertainment", "politics", "finance", "legal", "education", "travel", "food", "lifestyle", "science", "complaint", "deviation"],
  keywords: [],
  summaryLength: "medium",
  model: FAST_MODEL,
  temperature: 0.2,
  maxOutputTokens: 2000,
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<SentimentResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert sentiment analyst. Analyze the following text and determine the sentiment.

Return ONLY a JSON object with this structure:
{
  "overall": "positive" | "negative" | "neutral" | "mixed",
  "score": number (-1 to +1),
  "confidence": number (0-100),
  "sentences": [
    {
      "text": "string",
      "sentiment": "positive" | "negative" | "neutral",
      "score": number,
      "start": number,
      "end": number
    }
  ]
}

Analyze both the overall sentiment and the sentiment of individual sentences.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nProvide sentiment analysis:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "sentiment",
        overall: parsed.overall as SentimentType || "neutral",
        score: parsed.score || 0,
        confidence: parsed.confidence || 70,
        sentences: parsed.sentences || [],
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing sentiment result:", error)
  }

  // Fallback: basic analysis
  return {
    type: "sentiment",
    overall: "neutral",
    score: 0,
    confidence: 50,
    sentences: [],
  }
}

/**
 * Extract entities from text
 */
export async function extractEntities(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<EntityResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const entityTypes = opts.entities || DEFAULT_OPTIONS.entities
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert entity recognition system. Extract all entities of the specified types from the following text.

Entity types to extract: ${entityTypes.join(', ')}

Return ONLY a JSON object with this structure:
{
  "entities": [
    {
      "text": "string",
      "type": "string",
      "confidence": number (0-100),
      "start": number,
      "end": number
    }
  ],
  "counts": {
    "type1": number,
    "type2": number
  }
}

Be thorough and accurate. Include character positions (start and end) for each entity.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nExtract entities:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "entities",
        entities: parsed.entities || [],
        counts: parsed.counts || {},
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing entities result:", error)
  }

  return {
    type: "entities",
    entities: [],
    counts: {},
  }
}

/**
 * Classify text into categories
 */
export async function classifyText(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<ClassificationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const categories = opts.classificationCategories || DEFAULT_OPTIONS.classificationCategories
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert text classifier. Classify the following text into the most appropriate category.

Available categories: ${categories.join(', ')}
- Use "complaint" for customer/vendor/employee grievances, dissatisfaction reports, or escalations about a product, service, or experience.
- Use "deviation" for quality/process non-conformance reports -- documents describing a deviation from a specification, procedure, or standard (e.g. manufacturing deviations, inspection failures, out-of-spec results).

Return ONLY a JSON object with this structure:
{
  "primary": "category_string",
  "secondary": ["category_string"],
  "confidence": number (0-100),
  "categories": [
    {
      "category": "string",
      "confidence": number (0-100)
    }
  ]
}

Provide confidence scores for each category. The primary category should have the highest confidence.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to classify:\n\n"""\n${text}\n"""\n\nClassify this text:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "classification",
        primary: parsed.primary as ClassificationCategory || "other",
        secondary: parsed.secondary || [],
        confidence: parsed.confidence || 70,
        categories: parsed.categories || [],
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing classification result:", error)
  }

  return {
    type: "classification",
    primary: "other",
    secondary: [],
    confidence: 50,
    categories: [],
  }
}

/**
 * Extract keywords from text
 */
export async function extractKeywords(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<KeywordResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert keyword extraction system. Extract the most important keywords and themes from the following text.

Return ONLY a JSON object with this structure:
{
  "keywords": [
    {
      "keyword": "string",
      "relevance": number (0-100),
      "frequency": number
    }
  ],
  "themes": ["string"]
}

Extract 5-10 keywords that best represent the main topics. Keywords should be 1-3 words each.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nExtract keywords:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "keywords",
        keywords: parsed.keywords || [],
        themes: parsed.themes || [],
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing keywords result:", error)
  }

  return {
    type: "keywords",
    keywords: [],
    themes: [],
  }
}

/**
 * Generate summary of text
 */
export async function generateSummary(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<SummaryResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const lengthMap = { short: 100, medium: 300, long: 800 }
  const targetLength = lengthMap[opts.summaryLength || "medium"] || 300
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert text summarization system. Generate a concise summary of the following text.

Summary length: ${opts.summaryLength || "medium"} (target: ~${targetLength} words)

Return ONLY a JSON object with this structure:
{
  "summary": "string",
  "keyPoints": ["string"],
  "wordCount": number,
  "originalLength": number,
  "compressionRatio": number
}

Create a summary that captures the main points and essence of the text.`

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: `Text to summarize:\n\n"""\n${text}\n"""\n\nGenerate summary:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "summary",
        summary: parsed.summary || text.substring(0, 200) + "...",
        keyPoints: parsed.keyPoints || [],
        wordCount: parsed.wordCount || Math.floor(text.split(/\s+/).length * 0.3),
        originalLength: parsed.originalLength || text.split(/\s+/).length,
        compressionRatio: parsed.compressionRatio || 0.7,
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing summary result:", error)
  }

  return {
    type: "summary",
    summary: text.substring(0, 200) + "...",
    keyPoints: [],
    wordCount: text.split(/\s+/).length,
    originalLength: text.split(/\s+/).length,
    compressionRatio: 1.0,
  }
}

/**
 * Detect intent of text
 */
export async function detectIntent(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<IntentResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert intent detection system. Analyze the following text and determine the user's intent.

Return ONLY a JSON object with this structure:
{
  "primary": "string",
  "confidence": number (0-100),
  "secondaryIntents": [
    {
      "intent": "string",
      "confidence": number (0-100)
    }
  ]
}

Consider intents like: question, command, statement, request, complaint, compliment, information_seeking, action_required, feedback, other.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nDetect intent:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "intent",
        primary: parsed.primary as IntentType || "other",
        confidence: parsed.confidence || 70,
        secondaryIntents: parsed.secondaryIntents || [],
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing intent result:", error)
  }

  return {
    type: "intent",
    primary: "other",
    confidence: 50,
    secondaryIntents: [],
  }
}

/**
 * Detect toxicity in text
 */
export async function detectToxicity(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<ToxicityResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert toxicity detection system. Analyze the following text for toxic, harmful, or inappropriate content.

Return ONLY a JSON object with this structure:
{
  "toxic": boolean,
  "score": number (0-1),
  "categories": {
    "toxic": {"score": number, "label": "string"},
    "severe_toxic": {"score": number, "label": "string"},
    "obscene": {"score": number, "label": "string"},
    "threat": {"score": number, "label": "string"},
    "insult": {"score": number, "label": "string"},
    "identity_hate": {"score": number, "label": "string"}
  },
  "flagged": ["string"]
}

Provide scores from 0 (not toxic) to 1 (very toxic) for each category. 
Only flag categories with scores > 0.5.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nDetect toxicity:`,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "toxicity",
        toxic: parsed.toxic || false,
        score: parsed.score || 0,
        categories: parsed.categories || {
          toxic: { score: 0, label: "non-toxic" },
          severe_toxic: { score: 0, label: "non-toxic" },
          obscene: { score: 0, label: "non-toxic" },
          threat: { score: 0, label: "non-toxic" },
          insult: { score: 0, label: "non-toxic" },
          identity_hate: { score: 0, label: "non-toxic" },
        },
        flagged: parsed.flagged || [],
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing toxicity result:", error)
  }

  return {
    type: "toxicity",
    toxic: false,
    score: 0,
    categories: {
      toxic: { score: 0, label: "non-toxic" },
      severe_toxic: { score: 0, label: "non-toxic" },
      obscene: { score: 0, label: "non-toxic" },
      threat: { score: 0, label: "non-toxic" },
      insult: { score: 0, label: "non-toxic" },
      identity_hate: { score: 0, label: "non-toxic" },
    },
    flagged: [],
  }
}

/**
 * Detect language of text
 */
export async function detectLanguage(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<LanguageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert language detection system. Identify the language of the following text.

Return ONLY a JSON object with this structure:
{
  "language": "string",
  "code": "string (ISO 639-1)",
  "confidence": number (0-100),
  "detectedText": "string"
}

If you cannot determine the language with high confidence, use "unknown" as both language and code.`

  const result = await generateText({
    model: opts.model,
    system: systemPrompt,
    prompt: `Text to analyze:\n\n"""\n${text}\n"""\n\nDetect language:`,
    temperature: opts.temperature,
    maxOutputTokens: 500,
  })

  try {
    const responseText = result.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: "language",
        language: parsed.language || "unknown",
        code: parsed.code || "un",
        confidence: parsed.confidence || 70,
        detectedText: parsed.detectedText || text.substring(0, 100),
      }
    }
  } catch (error) {
    console.error("[NLP] Error parsing language result:", error)
  }

  return {
    type: "language",
    language: "unknown",
    code: "un",
    confidence: 50,
    detectedText: text.substring(0, 100),
  }
}

/**
 * Perform comprehensive NLP analysis
 */
export async function analyzeTextComprehensively(
  text: string,
  options: Partial<NLPAnalysisOptions> = {}
): Promise<ComprehensiveResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Run all analyses in parallel
  const [
    sentiment,
    entities,
    classification,
    keywords,
    summary,
    intent,
    toxicity,
    language,
  ] = await Promise.all([
    analyzeSentiment(text, opts),
    extractEntities(text, opts),
    classifyText(text, opts),
    extractKeywords(text, opts),
    generateSummary(text, opts),
    detectIntent(text, opts),
    detectToxicity(text, opts),
    detectLanguage(text, opts),
  ])
  
  return {
    type: "comprehensive",
    sentiment,
    entities,
    classification,
    keywords,
    summary,
    intent,
    toxicity,
    language,
  }
}

/**
 * Analyze text with specified analysis type
 */
export async function analyzeText(
  text: string,
  options: NLPAnalysisOptions
): Promise<NLPAnalysisResult> {
  switch (options.analysisType) {
    case "sentiment":
      return analyzeSentiment(text, options)
    
    case "entities":
      return extractEntities(text, options)
    
    case "classification":
      return classifyText(text, options)
    
    case "keywords":
      return extractKeywords(text, options)
    
    case "summary":
      return generateSummary(text, options)
    
    case "intent":
      return detectIntent(text, options)
    
    case "toxicity":
      return detectToxicity(text, options)
    
    case "language":
      return detectLanguage(text, options)
    
    case "comprehensive":
      return analyzeTextComprehensively(text, options)
    
    default:
      return generateSummary(text, options)
  }
}

/**
 * Analyze multiple documents
 */
export async function analyzeDocuments(
  documents: TextDocument[],
  options: NLPAnalysisOptions
): Promise<{
  documents: Array<{
    id: string
    result: NLPAnalysisResult
  }>
  aggregate: {
    sentimentDistribution: Record<SentimentType, number>
    primaryIntents: Record<string, number>
    primaryCategories: Record<string, number>
    detectedLanguages: Record<string, number>
    toxicityRate: number
  }
}> {
  const results = await Promise.all(
    documents.map(async (doc) => ({
      id: doc.id || String(Math.random()),
      result: await analyzeText(doc.text, options),
    }))
  )
  
  // Aggregate statistics
  const sentimentDistribution: Record<SentimentType, number> = {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  }
  
  const primaryIntents: Record<string, number> = {}
  const primaryCategories: Record<string, number> = {}
  const detectedLanguages: Record<string, number> = {}
  let toxicCount = 0
  
  for (const { result } of results) {
    if (result.type === "sentiment") {
      sentimentDistribution[result.overall] = (sentimentDistribution[result.overall] || 0) + 1
    }
    
    if (result.type === "comprehensive") {
      sentimentDistribution[result.sentiment.overall] = (sentimentDistribution[result.sentiment.overall] || 0) + 1
      primaryIntents[result.intent.primary] = (primaryIntents[result.intent.primary] || 0) + 1
      primaryCategories[result.classification.primary] = (primaryCategories[result.classification.primary] || 0) + 1
      detectedLanguages[result.language.language] = (detectedLanguages[result.language.language] || 0) + 1
      
      if (result.toxicity.toxic) {
        toxicCount++
      }
    } else if (result.type === "intent") {
      primaryIntents[result.primary] = (primaryIntents[result.primary] || 0) + 1
    } else if (result.type === "classification") {
      primaryCategories[result.primary] = (primaryCategories[result.primary] || 0) + 1
    } else if (result.type === "language") {
      detectedLanguages[result.language] = (detectedLanguages[result.language] || 0) + 1
    } else if (result.type === "toxicity") {
      if (result.toxic) {
        toxicCount++
      }
    }
  }
  
  const toxicityRate = documents.length > 0 ? toxicCount / documents.length : 0
  
  return {
    documents: results,
    aggregate: {
      sentimentDistribution,
      primaryIntents,
      primaryCategories,
      detectedLanguages,
      toxicityRate,
    },
  }
}

export {
  DEFAULT_OPTIONS,
}
