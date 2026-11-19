"""
MediAI Advanced RAG Document Ingestion Pipeline
Adapted directly from Dhana180/Adv_Rag/ingest.py and upgraded to support:
- Multi-format document loading (.pdf via PyPDFLoader, .md/.txt via TextLoader)
- Structured section metadata extraction
- Recursive character text splitting (chunk_size=500, chunk_overlap=100)
- Hugging Face sentence-transformer embeddings (all-MiniLM-L6-v2)
- Persistent FAISS vector store + chunk corpus export for BM25 keyword retrieval
"""

import json
import os
import re
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("RAG_DATA_DIR", str(BASE_DIR / "data")))
VECTORSTORE_DIR = Path(os.getenv("RAG_VECTORSTORE_DIR", str(BASE_DIR / "vectorstore")))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


def _extract_title_and_section(text: str, filename: str) -> tuple[str, str]:
    title = filename.replace("_", " ").rsplit(".", 1)[0].strip()
    section = "General"
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            break
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## ") or stripped.startswith("### "):
            section = re.sub(r"^#+\s*", "", stripped).strip()
            break
    return title, section


def load_documents(data_dir: Path = DATA_DIR) -> List[Document]:
    """Load PDF, Markdown, and Text hospital knowledge documents from data_dir."""
    documents: List[Document] = []
    if not data_dir.exists():
        raise FileNotFoundError(f"Knowledge base directory not found: {data_dir}")

    for file_path in sorted(data_dir.rglob("*")):
        if not file_path.is_file():
            continue
        suffix = file_path.suffix.lower()
        rel_name = file_path.relative_to(data_dir).as_posix()

        if suffix == ".pdf":
            loader = PyPDFLoader(str(file_path))
            loaded = loader.load()
            for doc in loaded:
                doc.metadata["source"] = rel_name
                doc.metadata["title"] = rel_name.replace("_", " ").rsplit(".", 1)[0]
                doc.metadata["section"] = f"Page {int(doc.metadata.get('page', 0)) + 1}"
            documents.extend(loaded)
        elif suffix in {".md", ".txt"}:
            loader = TextLoader(str(file_path), encoding="utf-8")
            loaded = loader.load()
            for doc in loaded:
                title, section = _extract_title_and_section(doc.page_content, rel_name)
                doc.metadata["source"] = rel_name
                doc.metadata["title"] = title
                doc.metadata["section"] = section
            documents.extend(loaded)

    return documents


def split_documents(documents: List[Document]) -> List[Document]:
    """Split documents into overlapping chunks preserving section headers."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""],
    )
    chunks = text_splitter.split_documents(documents)

    current_section_by_source: dict[str, str] = {}
    for idx, chunk in enumerate(chunks):
        src = chunk.metadata.get("source", "unknown")
        # Update active section heading if chunk introduces a markdown heading
        for line in chunk.page_content.splitlines():
            stripped = line.strip()
            if stripped.startswith("## ") or stripped.startswith("### "):
                current_section_by_source[src] = re.sub(r"^#+\s*", "", stripped).strip()
                break
        if src in current_section_by_source:
            chunk.metadata["section"] = current_section_by_source[src]
        chunk.metadata["chunk_id"] = f"{src}#chunk-{idx + 1}"

    return chunks


def build_vectorstore(
    data_dir: Path = DATA_DIR,
    vectorstore_dir: Path = VECTORSTORE_DIR,
) -> dict:
    """Run full ingestion pipeline: load -> split -> embed -> save FAISS + BM25 chunks."""
    documents = load_documents(data_dir)
    if not documents:
        raise RuntimeError(f"No supported documents (.pdf, .md, .txt) found in {data_dir}")

    chunks = split_documents(documents)

    hf_token = os.getenv("HUGGINGFACE_API_TOKEN")
    model_kwargs = {}
    if hf_token:
        model_kwargs["token"] = hf_token

    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs=model_kwargs,
    )

    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore_dir.mkdir(parents=True, exist_ok=True)
    vectorstore.save_local(str(vectorstore_dir))

    # Persist chunk corpus for BM25 keyword retrieval
    serialized_chunks = [
        {
            "chunk_id": chunk.metadata.get("chunk_id", f"chunk-{i + 1}"),
            "content": chunk.page_content,
            "metadata": dict(chunk.metadata),
        }
        for i, chunk in enumerate(chunks)
    ]
    with open(vectorstore_dir / "chunks.json", "w", encoding="utf-8") as f:
        json.dump(serialized_chunks, f, indent=2, ensure_ascii=False)

    return {
        "documents_loaded": len(documents),
        "chunks_indexed": len(chunks),
        "vectorstore_dir": str(vectorstore_dir),
        "embedding_model": EMBEDDING_MODEL,
    }


if __name__ == "__main__":
    summary = build_vectorstore()
    print(
        f"Indexed {summary['documents_loaded']} document(s) into "
        f"{summary['chunks_indexed']} chunks at {summary['vectorstore_dir']} "
        f"using {summary['embedding_model']}."
    )
