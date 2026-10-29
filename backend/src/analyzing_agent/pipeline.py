import os
import duckdb
from typing import TypedDict, Dict, Any, List
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from analyzing_agent.schemas import TableSchemaList, RelationshipList

class PipelineState(TypedDict):
    tenant_id: str
    s3_urls: Dict[str, str]
    raw_metadata: Dict[str, Any]
    table_schemas: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]

# Cap max_tokens safely below the 1000 OTPM limit
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model_name=os.getenv("GROQ_MODEL_NAME", "llama-3.1-8b-instant"),
    temperature=0,
    max_tokens=800 
)

def node_extract_metadata(state: PipelineState):
    raw_metadata = {}
    conn = duckdb.connect(':memory:')
    
    endpoint = os.getenv("AWS_ENDPOINT_URL_S3", "").replace("https://", "")
    
    conn.execute(f"""
        INSTALL httpfs;
        LOAD httpfs;
        SET s3_endpoint='{endpoint}';
        SET s3_access_key_id='{os.getenv("AWS_ACCESS_KEY_ID")}';
        SET s3_secret_access_key='{os.getenv("AWS_SECRET_ACCESS_KEY")}';
    """)
    
    for alias, url in state["s3_urls"].items():
        conn.execute(f"CREATE VIEW {alias} AS SELECT * FROM read_csv_auto('{url}')")
        
        columns = conn.execute(f"DESCRIBE SELECT * FROM {alias}").fetchall()
        column_names = [c[0] for c in columns]
        
        raw_rows = conn.execute(f"SELECT * FROM {alias} LIMIT 5").fetchall()
        sample_rows = [dict(zip(column_names, row)) for row in raw_rows]
        
        raw_metadata[alias] = {
            "schema": [{"column": c[0], "type": c[1]} for c in columns],
            "sample_data": sample_rows
        }
        
    return {"raw_metadata": raw_metadata}

def node_infer_tables(state: PipelineState):
    structured_llm = llm.with_structured_output(TableSchemaList)
    
    # THE FIX: A draconian system prompt that forces empty strings for column descriptions
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a Data Architect operating under a STRICT token limit.

CRITICAL INSTRUCTIONS TO PREVENT CRASHING:
1. 'table_type': Output "Fact" or "Dimension".
2. 'business_purpose': Maximum 3 words (e.g., "Customer orders").
3. 'business_description' (for EVERY column): You MUST output an empty string "". Do NOT write descriptions for columns.

If you write column descriptions, the system will run out of tokens and crash. Output JSON strictly."""),
        ("user", "Raw Metadata: {metadata}")
    ])
    chain = prompt | structured_llm
    result = chain.invoke({"metadata": state["raw_metadata"]})
    return {"table_schemas": [schema.model_dump() for schema in result.schemas]}

def node_infer_relationships(state: PipelineState):
    structured_llm = llm.with_structured_output(RelationshipList)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an elite Data Architect. Infer logical relationships between tables to build a Star Schema. 

RULES:
1. Identify Primary Key to Foreign Key relationships.
2. Evaluate composite keys or date/time mappings if standard IDs are absent.
3. Classify relationship type (1:1, 1:N, N:1, or N:M).

Output strictly as JSON matching the requested schema."""),
        ("user", "Table Schemas: {schemas}")
    ])
    chain = prompt | structured_llm
    result = chain.invoke({"schemas": state["table_schemas"]})
    return {"relationships": [rel.model_dump() for rel in result.relationships]}

workflow = StateGraph(PipelineState)
workflow.add_node("extract_metadata", node_extract_metadata)
workflow.add_node("infer_tables", node_infer_tables)
workflow.add_node("infer_relationships", node_infer_relationships)

workflow.set_entry_point("extract_metadata")
workflow.add_edge("extract_metadata", "infer_tables")
workflow.add_edge("infer_tables", "infer_relationships")
workflow.add_edge("infer_relationships", END)

ingestion_pipeline = workflow.compile()