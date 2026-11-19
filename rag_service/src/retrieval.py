"""
MediAI Advanced Retrieval Engine
Implements:
1. Semantic Vector Retrieval (FAISS)
2. BM25 Keyword Retrieval (rank_bm25)
3. Hybrid Retrieval (Reciprocal Rank Fusion)
4. Multi-Query Expansion & Fusion
5. Cross-Encoder Reranking (with relevance cutoff)
6. Contextual Compression
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from rank_bm25 import BM25Okapi

from src.config import get_cross_encoder, load_vectorstore_and_chunks

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for",
    "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
    "the", "their", "there", "these", "this", "to", "what", "when", "where",
    "which", "who", "why", "with", "you", "your", "can", "about", "tell",
    "please", "explain", "hospital", "mediai",
}


def tokenize(text: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in tokens if len(t) > 1]


def content_tokens(text: str) -> List[str]:
    return [t for t in tokenize(text) if t not in STOPWORDS]


@dataclass
class RetrievedChunk:
    document: Document
    chunk_id: str
    vector_score: float = 0.0
    bm25_score: float = 0.0
    rrf_score: float = 0.0
    rerank_score: float = 0.0
    compressed_text: str = ""


class AdvancedHybridRetriever:
    """Manages FAISS semantic index, BM25 keyword index, RRF fusion, reranking, and compression."""

    def __init__(self) -> None:
        self.vectorstore: Optional[FAISS] = None
        self.documents: List[Document] = []
        self.doc_by_id: Dict[str, Document] = {}
        self.bm25: Optional[BM25Okapi] = None
        self.reload()

    def reload(self) -> dict:
        self.vectorstore, self.documents = load_vectorstore_and_chunks()
        self.doc_by_id = {}
        tokenized_corpus: List[List[str]] = []

        for idx, doc in enumerate(self.documents):
            cid = doc.metadata.get("chunk_id") or f"chunk-{idx + 1}"
            doc.metadata["chunk_id"] = cid
            self.doc_by_id[cid] = doc
            tokenized_corpus.append(tokenize(doc.page_content))

        self.bm25 = BM25Okapi(tokenized_corpus) if tokenized_corpus else None
        return {
            "chunks_loaded": len(self.documents),
            "sources": sorted({d.metadata.get("source", "unknown") for d in self.documents}),
        }

    def semantic_search(self, query: str, k: int = 6) -> List[Tuple[str, float]]:
        if not self.vectorstore:
            return []
        results = self.vectorstore.similarity_search_with_relevance_scores(query, k=k)
        ranked: List[Tuple[str, float]] = []
        for doc, score in results:
            cid = doc.metadata.get("chunk_id")
            if cid and cid in self.doc_by_id:
                ranked.append((cid, float(score)))
        return ranked

    def bm25_search(self, query: str, k: int = 6) -> List[Tuple[str, float]]:
        if not self.bm25 or not self.documents:
            return []
        q_tokens = tokenize(query)
        if not q_tokens:
            return []
        scores = self.bm25.get_scores(q_tokens)
        scored_pairs = [
            (self.documents[i].metadata["chunk_id"], float(scores[i]))
            for i in range(len(self.documents))
            if scores[i] > 0.0
        ]
        scored_pairs.sort(key=lambda pair: pair[1], reverse=True)
        return scored_pairs[:k]

    def hybrid_retrieve(
        self,
        queries: List[str],
        per_query_k: int = 6,
        top_n: int = 8,
        rrf_k: int = 60,
    ) -> List[RetrievedChunk]:
        """Execute semantic + BM25 hybrid retrieval across all expanded queries using RRF."""
        fused: Dict[str, RetrievedChunk] = {}

        for q_idx, q in enumerate(queries):
            query_weight = 1.0 if q_idx == 0 else 0.7

            vec_results = self.semantic_search(q, k=per_query_k)
            for rank, (cid, score) in enumerate(vec_results, start=1):
                entry = fused.setdefault(cid, RetrievedChunk(document=self.doc_by_id[cid], chunk_id=cid))
                entry.vector_score = max(entry.vector_score, score)
                entry.rrf_score += query_weight * (0.6 / (rrf_k + rank))

            bm25_results = self.bm25_search(q, k=per_query_k)
            for rank, (cid, score) in enumerate(bm25_results, start=1):
                entry = fused.setdefault(cid, RetrievedChunk(document=self.doc_by_id[cid], chunk_id=cid))
                entry.bm25_score = max(entry.bm25_score, score)
                entry.rrf_score += query_weight * (0.4 / (rrf_k + rank))

        ranked = sorted(fused.values(), key=lambda c: c.rrf_score, reverse=True)
        return ranked[:top_n]

    def rerank(
        self,
        query: str,
        candidates: List[RetrievedChunk],
        top_k: int = 4,
    ) -> List[RetrievedChunk]:
        """Rerank hybrid candidates using CrossEncoder (or lexical/semantic score fusion fallback)."""
        if not candidates:
            return []

        cross_encoder = get_cross_encoder()
        if cross_encoder is not None:
            pairs = [(query, c.document.page_content) for c in candidates]
            raw_scores = cross_encoder.predict(pairs)
            for cand, score in zip(candidates, raw_scores):
                cand.rerank_score = float(score)
            candidates.sort(key=lambda c: c.rerank_score, reverse=True)
            # Filter out clearly irrelevant passages (ms-marco logits below -2.5 indicate no match)
            relevant = [c for c in candidates if c.rerank_score >= -2.5]
            return relevant[:top_k]

        # Deterministic fallback reranker combining semantic score, BM25, and query term coverage
        q_terms = set(content_tokens(query))
        max_bm25 = max((c.bm25_score for c in candidates), default=1.0) or 1.0
        for cand in candidates:
            doc_terms = set(content_tokens(cand.document.page_content))
            overlap = (len(q_terms & doc_terms) / max(len(q_terms), 1)) if q_terms else 0.0
            norm_bm25 = cand.bm25_score / max_bm25
            cand.rerank_score = (0.5 * cand.vector_score) + (0.25 * norm_bm25) + (0.25 * overlap)

        candidates.sort(key=lambda c: c.rerank_score, reverse=True)
        relevant = [c for c in candidates if c.rerank_score >= 0.25]
        return relevant[:top_k]

    def compress_chunks(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        compression_chain=None,
    ) -> List[RetrievedChunk]:
        """
        Contextual compression: keep only query-relevant sentences/bullets from each reranked chunk.
        Uses LLM compression_chain if provided and fast extractive fallback otherwise.
        """
        q_terms = set(content_tokens(query))
        compressed: List[RetrievedChunk] = []

        for cand in chunks:
            raw_text = cand.document.page_content.strip()
            extracted = ""

            if compression_chain is not None:
                try:
                    llm_out = compression_chain.invoke({
                        "question": query,
                        "passage": raw_text,
                    }).strip()
                    if llm_out.upper() != "NONE" and llm_out:
                        extracted = llm_out
                except Exception:
                    extracted = ""

            if not extracted:
                lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
                kept = []
                for ln in lines:
                    if ln.startswith("#"):
                        kept.append(ln)
                        continue
                    ln_terms = set(content_tokens(ln))
                    if not q_terms or (q_terms & ln_terms):
                        kept.append(ln)
                extracted = "\n".join(kept) if kept else raw_text

            cand.compressed_text = extracted
            compressed.append(cand)

        return compressed


_retriever_instance: Optional[AdvancedHybridRetriever] = None


def get_retriever() -> AdvancedHybridRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = AdvancedHybridRetriever()
    return _retriever_instance
