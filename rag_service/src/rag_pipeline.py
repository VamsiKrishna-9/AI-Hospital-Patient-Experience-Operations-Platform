"""
MediAI Advanced RAG Pipeline
Adapted directly from Dhana180/Adv_Rag/src/rag_pipeline.py and upgraded with:
- Intent routing (DOCUMENT, HISTORY, GENERAL)
- Conversational follow-up contextualization
- Multi-query expansion
- FAISS + BM25 Hybrid Retrieval (RRF)
- Cross-Encoder Reranking
- Contextual Compression
- Grounded Answer Generation + Source References
"""

from typing import Any, Dict, List

from langchain_core.runnables import RunnableLambda

from src.chains import get_chains
from src.config import FALLBACK_UNKNOWN_ANSWER
from src.retrieval import RetrievedChunk, get_retriever


def _format_sources(chunks: List[RetrievedChunk]) -> List[Dict[str, Any]]:
    sources: List[Dict[str, Any]] = []
    seen = set()
    for ch in chunks:
        meta = ch.document.metadata or {}
        key = (meta.get("source", "unknown"), meta.get("section", "General"))
        if key in seen:
            continue
        seen.add(key)
        snippet_src = ch.compressed_text or ch.document.page_content
        snippet = " ".join(snippet_src.split())[:220]
        sources.append({
            "source": meta.get("source", "unknown"),
            "title": meta.get("title", meta.get("source", "MediAI Knowledge Document")),
            "section": meta.get("section", "General"),
            "page": meta.get("page"),
            "chunkId": ch.chunk_id,
            "snippet": snippet,
            "score": round(float(ch.rerank_score), 4),
        })
    return sources


def retrieve_documents(inputs: Dict[str, Any]) -> Dict[str, Any]:
    chains = get_chains()
    retriever = get_retriever()

    question = inputs["input"]
    chat_history = inputs.get("chat_history", [])

    # 1. Contextualize follow-up question into a standalone question
    if chat_history:
        standalone_question = chains["contextualize_chain"].invoke({
            "input": question,
            "chat_history": chat_history,
        }).strip() or question
    else:
        standalone_question = question

    # 2. Multi-query expansion
    expanded_queries = [standalone_question]
    try:
        raw_variations = chains["multi_query_chain"].invoke({"input": standalone_question})
        for line in raw_variations.splitlines():
            cleaned = line.strip().lstrip("-*0123456789.) ").strip()
            if cleaned and cleaned.lower() not in {q.lower() for q in expanded_queries}:
                expanded_queries.append(cleaned)
        expanded_queries = expanded_queries[:4]
    except Exception:
        pass

    # 3. Hybrid retrieval (FAISS semantic + BM25 keyword via Reciprocal Rank Fusion)
    hybrid_candidates = retriever.hybrid_retrieve(expanded_queries, per_query_k=6, top_n=8)

    # 4. Reranking (Cross-Encoder with relevance cutoff)
    reranked_chunks = retriever.rerank(standalone_question, hybrid_candidates, top_k=4)

    if not reranked_chunks:
        return {
            "answer": FALLBACK_UNKNOWN_ANSWER,
            "sources": [],
            "intent": "DOCUMENT",
            "standalone_question": standalone_question,
            "pipeline_trace": {
                "expanded_queries": expanded_queries,
                "hybrid_candidates": len(hybrid_candidates),
                "reranked_count": 0,
            },
        }

    # 5. Contextual compression
    compressed_chunks = retriever.compress_chunks(
        standalone_question,
        reranked_chunks,
        compression_chain=chains["compression_chain"],
    )

    context_blocks = []
    for idx, ch in enumerate(compressed_chunks, start=1):
        meta = ch.document.metadata or {}
        header = f"[Source {idx}: {meta.get('title', meta.get('source', 'Document'))} — {meta.get('section', 'General')}]"
        context_blocks.append(f"{header}\n{ch.compressed_text}")

    context = "\n\n".join(context_blocks)
    if not context.strip():
        return {
            "answer": FALLBACK_UNKNOWN_ANSWER,
            "sources": [],
            "intent": "DOCUMENT",
            "standalone_question": standalone_question,
            "pipeline_trace": {
                "expanded_queries": expanded_queries,
                "hybrid_candidates": len(hybrid_candidates),
                "reranked_count": len(reranked_chunks),
            },
        }

    # 6. Grounded Answer Generation
    answer = chains["document_answer_chain"].invoke({
        "input": standalone_question,
        "context": context,
    }).strip()

    is_unknown = FALLBACK_UNKNOWN_ANSWER.lower() in answer.lower() or "don't know based on" in answer.lower()
    if is_unknown:
        return {
            "answer": FALLBACK_UNKNOWN_ANSWER,
            "sources": [],
            "intent": "DOCUMENT",
            "standalone_question": standalone_question,
            "pipeline_trace": {
                "expanded_queries": expanded_queries,
                "hybrid_candidates": len(hybrid_candidates),
                "reranked_count": len(reranked_chunks),
            },
        }

    return {
        "answer": answer,
        "sources": _format_sources(compressed_chunks),
        "intent": "DOCUMENT",
        "standalone_question": standalone_question,
        "pipeline_trace": {
            "expanded_queries": expanded_queries,
            "hybrid_candidates": len(hybrid_candidates),
            "reranked_count": len(reranked_chunks),
        },
    }


def route_request(inputs: Dict[str, Any]) -> Dict[str, Any]:
    chains = get_chains()
    question = inputs["input"]
    history = inputs.get("chat_history", [])

    # 1. Detect Intent (DOCUMENT, HISTORY, GENERAL)
    intent = chains["intent_chain"].invoke({
        "input": question,
        "chat_history": history,
    }).strip().upper()

    if "DOCUMENT" in intent:
        return retrieve_documents(inputs)
    if "HISTORY" in intent:
        answer = chains["history_answer_chain"].invoke({
            "input": question,
            "chat_history": history,
        }).strip()
        return {
            "answer": answer,
            "sources": [],
            "intent": "HISTORY",
            "standalone_question": question,
            "pipeline_trace": {},
        }

    answer = chains["general_chain"].invoke({
        "input": question,
        "chat_history": history,
    }).strip()
    return {
        "answer": answer,
        "sources": [],
        "intent": "GENERAL",
        "standalone_question": question,
        "pipeline_trace": {},
    }


rag_chain = RunnableLambda(route_request)
