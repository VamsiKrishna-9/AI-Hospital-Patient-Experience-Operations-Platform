"""
MediAI Advanced RAG Configuration
Adapted from Dhana180/Adv_Rag/src/config.py.
Loads Hugging Face embeddings, FAISS vector store, BM25 chunk corpus,
Cross-Encoder reranker, and LLM (Groq primary per Adv_Rag, Gemini fallback).
"""

import json
import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("RAG_DATA_DIR", str(BASE_DIR / "data")))
VECTORSTORE_DIR = Path(os.getenv("RAG_VECTORSTORE_DIR", str(BASE_DIR / "vectorstore")))

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

FALLBACK_UNKNOWN_ANSWER = "I'm not aware of it based on the available knowledge base."


def get_embeddings() -> HuggingFaceEmbeddings:
    hf_token = os.getenv("HUGGINGFACE_API_TOKEN")
    model_kwargs = {"token": hf_token} if hf_token else {}
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs=model_kwargs,
    )


def get_llm():
    """
    Initialize LLM matching Dhana180/Adv_Rag (ChatGroq via GROQ_API_KEY).
    Falls back to ChatGoogleGenerativeAI if GEMINI_API_KEY is configured and GROQ_API_KEY is absent.
    """
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_api_key:
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=GROQ_MODEL,
            temperature=0,
            api_key=groq_api_key,
        )

    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_api_key:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            temperature=0,
            google_api_key=gemini_api_key,
        )

    raise RuntimeError(
        "No LLM API key configured for rag_service. Set GROQ_API_KEY or GEMINI_API_KEY."
    )


def load_vectorstore_and_chunks() -> tuple[FAISS, List[Document]]:
    """Load persisted FAISS index and chunk documents; auto-ingest if missing."""
    index_file = VECTORSTORE_DIR / "index.faiss"
    chunks_file = VECTORSTORE_DIR / "chunks.json"

    if not index_file.exists() or not chunks_file.exists():
        from ingest import build_vectorstore

        build_vectorstore(DATA_DIR, VECTORSTORE_DIR)

    embeddings = get_embeddings()
    vectorstore = FAISS.load_local(
        str(VECTORSTORE_DIR),
        embeddings,
        allow_dangerous_deserialization=True,
    )

    with open(chunks_file, "r", encoding="utf-8") as f:
        raw_chunks = json.load(f)

    documents = [
        Document(page_content=item["content"], metadata=item.get("metadata", {}))
        for item in raw_chunks
    ]
    return vectorstore, documents


_cross_encoder_cache: Optional[object] = None


def get_cross_encoder():
    """Lazily load sentence-transformers CrossEncoder for neural reranking."""
    global _cross_encoder_cache
    if _cross_encoder_cache is None:
        try:
            from sentence_transformers import CrossEncoder

            _cross_encoder_cache = CrossEncoder(RERANKER_MODEL)
        except Exception as exc:
            print(f"[RAG] CrossEncoder unavailable ({exc}); will use hybrid score reranker.")
            _cross_encoder_cache = False
    return _cross_encoder_cache if _cross_encoder_cache is not False else None
