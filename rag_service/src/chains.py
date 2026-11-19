"""
MediAI Advanced RAG Chains
Adapted directly from Dhana180/Adv_Rag/src/chains.py and extended with
multi-query expansion and contextual compression chains.
"""

from langchain_core.output_parsers import StrOutputParser

from src.config import get_llm
from src.prompts import (
    answer_prompt,
    compression_prompt,
    contextualize_prompt,
    general_prompt,
    history_prompt,
    intent_prompt,
    multi_query_prompt,
)

_chains_cache = None


def get_chains() -> dict:
    """Lazily initialize LCEL chains so service health can report before LLM invocation."""
    global _chains_cache
    if _chains_cache is None:
        llm = get_llm()
        parser = StrOutputParser()
        _chains_cache = {
            "intent_chain": intent_prompt | llm | parser,
            "contextualize_chain": contextualize_prompt | llm | parser,
            "multi_query_chain": multi_query_prompt | llm | parser,
            "compression_chain": compression_prompt | llm | parser,
            "document_answer_chain": answer_prompt | llm | parser,
            "history_answer_chain": history_prompt | llm | parser,
            "general_chain": general_prompt | llm | parser,
        }
    return _chains_cache
