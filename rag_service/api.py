"""
MediAI Advanced RAG FastAPI Service
Adapted directly from Dhana180/Adv_Rag/api.py.
Exposes HTTP endpoints for the existing MediAI Express server (POST /api/ai/chat).
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

from ingest import build_vectorstore
from src.config import DATA_DIR, EMBEDDING_MODEL, RERANKER_MODEL, VECTORSTORE_DIR
from src.rag_pipeline import rag_chain
from src.retrieval import get_retriever

app = FastAPI(
    title="MediAI Advanced RAG Service",
    description="Hybrid FAISS + BM25, Multi-Query, Cross-Encoder Reranking & Contextual Compression RAG Engine (based on Dhana180/Adv_Rag)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-session conversation history store (preserved from Adv_Rag/api.py)
store: Dict[str, List[Any]] = {}


class HistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str = "default"
    question: str
    history: Optional[List[HistoryItem]] = None


@app.get("/")
def home():
    return {
        "message": "MediAI Advanced RAG Service is running",
        "embedding_model": EMBEDDING_MODEL,
        "reranker_model": RERANKER_MODEL,
    }


@app.get("/health")
def health():
    retriever = get_retriever()
    return {
        "status": "healthy",
        "chunks_indexed": len(retriever.documents),
        "embedding_model": EMBEDDING_MODEL,
        "reranker_model": RERANKER_MODEL,
        "llm_configured": bool(os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY")),
    }


@app.post("/ingest")
def reindex_documents():
    try:
        summary = build_vectorstore(DATA_DIR, VECTORSTORE_DIR)
        reload_info = get_retriever().reload()
        return {
            "status": "ok",
            **summary,
            **reload_info,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")


@app.post("/chat")
def chat(request: ChatRequest):
    try:
        session_id = request.session_id or "default"
        question = request.question.strip()

        if not question:
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        if request.history is not None:
            chat_history = [
                HumanMessage(content=item.content)
                if item.role == "user"
                else AIMessage(content=item.content)
                for item in request.history[-10:]
                if item.content and item.content.strip()
            ]
        else:
            if session_id not in store:
                store[session_id] = []
            chat_history = store[session_id][-10:]

        result = rag_chain.invoke({
            "input": question,
            "chat_history": chat_history,
        })

        answer = result["answer"]
        sources = result.get("sources", [])

        # Update server-side session store
        if session_id not in store:
            store[session_id] = []
        store[session_id].append(HumanMessage(content=question))
        store[session_id].append(AIMessage(content=answer))
        store[session_id] = store[session_id][-20:]

        return {
            "session_id": session_id,
            "question": question,
            "answer": answer,
            "sources": sources,
            "intent": result.get("intent", "DOCUMENT"),
            "standalone_question": result.get("standalone_question", question),
            "pipeline_trace": result.get("pipeline_trace", {}),
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("RAG Service Error:", str(exc))
        raise HTTPException(status_code=500, detail=f"Error processing question: {exc}")


@app.delete("/clear-history/{session_id}")
def clear_history(session_id: str):
    store.pop(session_id, None)
    return {"message": "Chat history cleared successfully"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("RAG_PORT", "8001"))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
