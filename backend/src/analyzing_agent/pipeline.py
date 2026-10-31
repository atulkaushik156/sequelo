
import os
import duckdb
from typing import TypedDict, Dict, Any, List
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from analyzing_agent.schemas import TableSchemaList, RelationshipList

class PipelineState(TypedDict):
    tenant_id: str
    s3_urls: Dict[str, str]
    raw_metadata: Dict[str, Any]
    table_schemas: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]

# Initialize Gemini
llm = ChatGoogleGenerativeAI(
    google_api_key=os.getenv("GEMINI_API_KEY"),
    model=os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash-8b"),
    temperature=0
)

def node_extract_metadata(state: PipelineState):
    raw_metadata = {}

    # Fast exit if no S3 URLs are provided
    if not state.get("s3_urls"):
        return {"raw_metadata": raw_metadata}

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
        if not url:
            continue

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
    # LLM SAFETY CHECK: Prevent empty API calls
    if not state.get("raw_metadata"):
        return {"table_schemas": []}

    structured_llm = llm.with_structured_output(TableSchemaList)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert Data Architect. Analyze the provided raw CSV metadata to build a Data Dictionary.

For each table, you must:
Classify it as a "Fact" (transactional data) or a "Dimension" (descriptive attributes).
Define the overall business purpose of the table concisely.
Describe the business meaning of every column based on its name and sample data.

Output strictly as JSON matching the schema."""),
        ("user", "Raw Metadata: {metadata}")
    ])

    chain = prompt | structured_llm
    result = chain.invoke({"metadata": state["raw_metadata"]})
    return {"table_schemas": [schema.model_dump() for schema in result.schemas]}

def node_infer_relationships(state: PipelineState):
    # LLM SAFETY CHECK: Prevent empty API calls
    if not state.get("table_schemas"):
        return {"relationships": []}

    structured_llm = llm.with_structured_output(RelationshipList)

    valid_schemas = {
        t["table_alias"]: [c["name"] for c in t["columns"]]
        for t in state["table_schemas"]
    }

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
        if url:
            conn.execute(f"CREATE VIEW {alias} AS SELECT * FROM read_csv_auto('{url}')")

    max_retries = 3
    attempt = 0
    error_feedback = ""
    final_valid_relationships = []

    while attempt < max_retries:
        attempt += 1

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an elite Data Architect inferring Foreign Key relationships based on semantics.

CRITICAL RULES:
STRICT ALLOWLIST: You MUST ONLY use the exact table and column names provided below.
'source_table': The parent/dimension table holding the Primary Key.
'source_column': The Primary Key column in the parent table.
'target_table': The child/fact table holding the Foreign Key.
'target_column': The Foreign Key column mapping back to the source.
NOT ALL TABLES ARE RELATED. If the tables do not logically connect, return an empty list [].

Output strictly as JSON."""),
            ("user", "VALID TABLES AND EXACT COLUMNS ALLOWLIST:\n{valid_schemas}\n{error_feedback}")
        ])

        chain = prompt | structured_llm
        result = chain.invoke({
            "valid_schemas": str(valid_schemas),
            "error_feedback": error_feedback
        })

        proposed_relationships = result.relationships

        if not proposed_relationships:
            return {"relationships": []}

        current_valid = []
        current_errors = []

        for rel in proposed_relationships:
            try:
                pk_query = f"""
                    SELECT
                        COUNT("{rel.source_column}") AS total_rows,
                        COUNT(DISTINCT "{rel.source_column}") AS unique_vals
                    FROM {rel.source_table}
                    WHERE "{rel.source_column}" IS NOT NULL
                """
                pk_stats = conn.execute(pk_query).fetchone()

                if pk_stats[0] == 0:
                    current_errors.append(f"Failed: {rel.source_table}.{rel.source_column} contains no data.")
                    continue

                uniqueness_ratio = pk_stats[1] / pk_stats[0]
                if uniqueness_ratio < 0.95:
                    current_errors.append(f"Failed: {rel.source_table}.{rel.source_column} is not unique enough to act as a Primary Key ({uniqueness_ratio:.1%} unique).")
                    continue

                fk_query = f"""
                    SELECT
                        COUNT("{rel.target_column}") AS total_child_keys,
                        SUM(CASE WHEN CAST("{rel.target_column}" AS VARCHAR) IN (
                            SELECT CAST("{rel.source_column}" AS VARCHAR)
                            FROM {rel.source_table}
                            WHERE "{rel.source_column}" IS NOT NULL
                        ) THEN 1 ELSE 0 END) AS matching_keys
                    FROM {rel.target_table}
                    WHERE "{rel.target_column}" IS NOT NULL
                """
                fk_stats = conn.execute(fk_query).fetchone()
                total_child = fk_stats[0]
                matched_child = fk_stats[1] or 0

                if total_child == 0:
                    current_errors.append(f"Failed: {rel.target_table}.{rel.target_column} contains only NULL values.")
                    continue

                match_rate = matched_child / total_child
                if match_rate < 0.80:
                    current_errors.append(f"Failed: Low match rate ({match_rate:.1%}) between {rel.target_table}.{rel.target_column} and {rel.source_table}.{rel.source_column}.")
                    continue

                current_valid.append(rel.model_dump())

            except Exception as e:
                current_errors.append(f"SQL Validation Error on {rel.target_table}.{rel.target_column} -> {rel.source_table}.{rel.source_column}: {str(e)}")

        final_valid_relationships = current_valid

        if not current_errors:
            break

        error_feedback = "\nPREVIOUS ATTEMPT FAILED WITH THESE ERRORS:\n" + "\n".join(current_errors) + "\nPlease remove invalid relationships, correct your mapping, or return an empty list."

    return {"relationships": final_valid_relationships}

workflow = StateGraph(PipelineState)
workflow.add_node("extract_metadata", node_extract_metadata)
workflow.add_node("infer_tables", node_infer_tables)
workflow.add_node("infer_relationships", node_infer_relationships)

workflow.set_entry_point("extract_metadata")
workflow.add_edge("extract_metadata", "infer_tables")
workflow.add_edge("infer_tables", "infer_relationships")
workflow.add_edge("infer_relationships", END)

ingestion_pipeline = workflow.compile()
