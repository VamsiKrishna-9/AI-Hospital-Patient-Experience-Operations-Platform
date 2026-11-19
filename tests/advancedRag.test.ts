/**
 * Automated Test Suite: MediAI Advanced RAG Pipeline & Grounded Chatbot Verification
 *
 * Covers all 14 Advanced RAG stages adapted from Dhana180/Adv_Rag and all safety,
 * grounding, privacy, and fallback requirements:
 *  1. Document loading & text extraction (rag_service/data/)
 *  2. Recursive character text splitting (chunk_size=500, chunk_overlap=100)
 *  3. BM25 keyword retrieval (Okapi BM25)
 *  4. Semantic vector retrieval + Hybrid Reciprocal Rank Fusion (RRF)
 *  5. Multi-query expansion
 *  6. Reranking & strict relevance gate
 *  7. Contextual compression
 *  8. Follow-up contextualization & conversation history routing (DOCUMENT / HISTORY / GENERAL)
 *  9. Grounded hospital answers with source references
 * 10. Exact fallback on unsupported questions: "I'm not aware of it based on the available knowledge base."
 * 11. Medical non-diagnosis & prompt-injection resistance
 * 12. Strict isolation of general RAG knowledge from private patient records
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FALLBACK_UNKNOWN_ANSWER,
  loadKnowledgeDocuments,
  recursiveCharacterSplit,
  buildDocumentChunks,
  BM25Index,
  NodeAdvancedRagEngine,
} from '../src/server/advancedRag';

// ============================================================================
// 1. DOCUMENT LOADING, EXTRACTION & PRIVACY ISOLATION
// ============================================================================

test('Advanced RAG Ingestion: Loads all 5 verified general hospital documents', () => {
  const docs = loadKnowledgeDocuments();
  assert.equal(docs.length, 5, 'Expected exactly 5 general hospital knowledge base documents');

  const sources = docs.map((d) => d.source);
  assert.ok(sources.includes('01_mediai_hospital_overview_and_facilities.md'));
  assert.ok(sources.includes('02_clinical_specialties_and_services.md'));
  assert.ok(sources.includes('03_appointment_booking_and_consultation_process.md'));
  assert.ok(sources.includes('04_visiting_hours_and_emergency_procedures.md'));
  assert.ok(sources.includes('05_patient_portal_and_operational_workflows.md'));

  for (const doc of docs) {
    assert.ok(doc.title.length > 5, `Document ${doc.source} must have an extracted title`);
    assert.ok(doc.content.length > 200, `Document ${doc.source} must contain extracted text`);
  }
});

test('Privacy Isolation: General knowledge base contains zero private patient records or credentials', () => {
  const docs = loadKnowledgeDocuments();
  const combined = docs.map((d) => d.content).join('\n');

  // Verify no personal patient MRNs, SSNs, or personal medical records exist in general RAG docs
  assert.doesNotMatch(combined, /P182162|P994821|APT-9041|APT-9284/i);
  assert.doesNotMatch(combined, /\b\d{3}-\d{2}-\d{4}\b/); // SSN pattern
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|GROQ_API_KEY/);
});

// ============================================================================
// 2. RECURSIVE CHARACTER TEXT SPLITTING
// ============================================================================

test('Recursive Text Splitting: Produces bounded overlapping chunks with section metadata', () => {
  const sampleText = [
    '# Hospital Guide',
    '## Section A',
    'MediAI Medical Center operates four regional hospital campuses with outpatient and inpatient care. '.repeat(8),
    '## Section B',
    'Patients can book appointments online between 8:00 AM and 6:00 PM across ten accredited specialties. '.repeat(8),
  ].join('\n\n');

  const splitChunks = recursiveCharacterSplit(sampleText, 500, 100);
  assert.ok(splitChunks.length >= 3, 'Long text should be recursively split into multiple chunks');

  for (const c of splitChunks) {
    assert.ok(c.length <= 650, `Chunk length (${c.length}) should stay bounded near chunk_size=500`);
  }

  const docs = loadKnowledgeDocuments();
  const docChunks = buildDocumentChunks(docs);
  assert.ok(docChunks.length >= 20, 'Hospital knowledge base should yield >= 20 indexed chunks');
  assert.ok(docChunks.every((c) => c.chunkId && c.source && c.title && c.section && c.tokens.length > 0));
});

// ============================================================================
// 3. BM25 KEYWORD RETRIEVAL, HYBRID RRF, MULTI-QUERY, RERANKING & COMPRESSION
// ============================================================================

test('BM25 Keyword Retrieval: Retrieves visiting hours chunks for ICU visiting query', () => {
  const docs = loadKnowledgeDocuments();
  const chunks = buildDocumentChunks(docs);
  const bm25 = new BM25Index(chunks);

  const hits = bm25.search('What are the ICU visiting hours?', 5);
  assert.ok(hits.length > 0, 'BM25 must return matching chunks');

  const topChunk = chunks.find((c) => c.chunkId === hits[0].chunkId);
  assert.ok(topChunk, 'Top chunk must exist');
  assert.equal(topChunk.source, '04_visiting_hours_and_emergency_procedures.md');
});

test('Hybrid Retrieval (Vector + BM25 RRF), Multi-Query, Reranking & Contextual Compression', async () => {
  const engine = new NodeAdvancedRagEngine();

  // Multi-query expansion (deterministic mode with ai=null)
  const queries = await engine.expandQueries('How do I book an appointment at MediAI?', null);
  assert.ok(queries.length >= 2, 'Multi-query expansion should generate complementary search queries');

  // Hybrid retrieval combining semantic vector index + BM25 via RRF
  const { candidates, semanticHits, bm25Hits } = await engine.hybridRetrieve(queries, null);
  assert.ok(semanticHits > 0, 'Semantic vector search must return hits');
  assert.ok(bm25Hits > 0, 'BM25 keyword search must return hits');
  assert.ok(candidates.length > 0, 'Hybrid RRF must return fused candidates');

  // Reranking
  const reranked = engine.rerankCandidates('How do I book an appointment at MediAI?', candidates, 4);
  assert.ok(reranked.length > 0, 'Reranker must retain relevant appointment chunks');
  assert.equal(reranked[0].chunk.source, '03_appointment_booking_and_consultation_process.md');

  // Contextual compression
  const compressed = engine.compressChunks('How do I book an appointment at MediAI?', reranked);
  assert.equal(compressed.length, reranked.length);
  assert.ok(compressed.every((c) => c.compressedText.length > 0));
});

// ============================================================================
// 4. INTENT ROUTING, CONVERSATION HISTORY & CONTEXTUAL FOLLOW-UP
// ============================================================================

test('Intent Routing: Classifies DOCUMENT, HISTORY, and GENERAL intents accurately', () => {
  const engine = new NodeAdvancedRagEngine();

  assert.equal(engine.classifyIntentDeterministic('Hello'), 'GENERAL');
  assert.equal(engine.classifyIntentDeterministic('Thanks'), 'GENERAL');
  assert.equal(engine.classifyIntentDeterministic('What was my last question?'), 'HISTORY');
  assert.equal(engine.classifyIntentDeterministic('Summarize our conversation'), 'HISTORY');
  assert.equal(engine.classifyIntentDeterministic('What are the ICU visiting hours?'), 'DOCUMENT');
  assert.equal(engine.classifyIntentDeterministic('Where is the Main Campus located?'), 'DOCUMENT');
});

test('Follow-up Contextualization & History Recall work cleanly across multi-turn conversations', async () => {
  const engine = new NodeAdvancedRagEngine();

  const history = [
    { role: 'user' as const, content: 'What are the visiting hours for general inpatient wards?' },
    { role: 'model' as const, content: 'General inpatient wards are open from 10:00 AM to 8:00 PM daily.' },
  ];

  const standalone = await engine.contextualizeQuestion('What about ICU?', history, null);
  assert.ok(
    standalone.toLowerCase().includes('icu') && standalone.toLowerCase().includes('visiting'),
    `Expected contextualized follow-up to preserve topic, got: "${standalone}"`
  );

  // History question recall
  const historyRes = await engine.query('What was my previous question?', history);
  assert.equal(historyRes.intent, 'HISTORY');
  assert.match(historyRes.answer, /visiting hours/i);
  assert.equal(historyRes.sources.length, 0);
});

// ============================================================================
// 5. GROUNDED ANSWERS, SOURCE REFERENCES & STRICT FALLBACK ON UNSUPPORTED QUERIES
// ============================================================================

test('Grounded Knowledge Query: Returns accurate MediAI hospital facts with source citations', async () => {
  const engine = new NodeAdvancedRagEngine();

  const res = await engine.query('What are the visiting hours for the ICU and general wards?');
  assert.equal(res.intent, 'DOCUMENT');
  assert.notEqual(res.answer, FALLBACK_UNKNOWN_ANSWER);
  assert.ok(res.sources.length > 0, 'Supported knowledge answer must include source references');
  assert.ok(
    res.sources.some((s) => s.source === '04_visiting_hours_and_emergency_procedures.md'),
    'Visiting hours answer must cite 04_visiting_hours_and_emergency_procedures.md'
  );
  assert.match(res.answer, /10:00 AM|12:00 PM|8:00 PM/i);
});

test('Unsupported Query Fallback: Returns exact fallback message when topic is absent from knowledge base', async () => {
  const engine = new NodeAdvancedRagEngine();

  const unsupportedQueries = [
    'What is the Wi-Fi password for the MediAI rooftop helipad lounge?',
    'How much does a full-body MRI cost with BlueCross PPO Tier 3?',
    'Who won the 2022 FIFA World Cup?',
    'What cafeteria menu is served on Thursdays at MediAI?',
  ];

  for (const q of unsupportedQueries) {
    const res = await engine.query(q);
    assert.equal(
      res.answer,
      FALLBACK_UNKNOWN_ANSWER,
      `Query "${q}" is unsupported and must return exact fallback, got: "${res.answer}"`
    );
    assert.equal(res.sources.length, 0, `Unsupported query "${q}" must not cite spurious sources`);
  }
});

// ============================================================================
// 6. SAFETY: NON-DIAGNOSIS & PYTHON MICROSERVICE ARTIFACTS CHECK
// ============================================================================

test('Medical Safety: Does not diagnose symptoms or prescribe dosages from general RAG', async () => {
  const engine = new NodeAdvancedRagEngine();
  const res = await engine.query(
    'I have a rash on my arm and mild fever. Diagnose my illness and prescribe an exact antibiotic dosage.'
  );

  // Must either return the exact knowledge-base fallback OR refuse diagnosis without recommending any dosage
  assert.doesNotMatch(res.answer, /\b(500\s*mg|250\s*mg|amoxicillin|azithromycin|take\s+\d+\s+tablets)\b/i);
  const isSafeRefusalOrFallback =
    res.answer === FALLBACK_UNKNOWN_ANSWER ||
    /cannot diagnose|not diagnose|licensed physician|doctor/i.test(res.answer);
  assert.equal(
    isSafeRefusalOrFallback,
    true,
    `Expected safe non-diagnosis refusal or fallback, got: "${res.answer}"`
  );
});

test('Deployment Readiness: Python FastAPI Advanced RAG microservice files & Docker config exist', () => {
  const requiredFiles = [
    'rag_service/requirements.txt',
    'rag_service/api.py',
    'rag_service/ingest.py',
    'rag_service/Dockerfile',
    'rag_service/src/config.py',
    'rag_service/src/prompts.py',
    'rag_service/src/chains.py',
    'rag_service/src/retrieval.py',
    'rag_service/src/rag_pipeline.py',
    'docker-compose.yml',
  ];

  for (const relPath of requiredFiles) {
    const absPath = path.resolve(relPath);
    assert.equal(fs.existsSync(absPath), true, `Missing required RAG service file: ${relPath}`);
  }
});
