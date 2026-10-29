from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any

# -- LLM Output Models --
class ColumnSchema(BaseModel):
    name: str
    inferred_type: str
    business_description: str = Field(description="Plain English description of what this column represents.")

class TableSchema(BaseModel):
    table_alias: str
    business_purpose: str = Field(description="What business entity or process this table represents.")
    table_type: Literal["Fact", "Dimension"] = Field(description="Fact (transactional/events) or Dimension (lookup/descriptive) table.")
    columns: List[ColumnSchema]

class TableSchemaList(BaseModel):
    schemas: List[TableSchema]

class Relationship(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    relationship_type: Literal["1:1", "1:N", "N:1", "N:M"]

class RelationshipList(BaseModel):
    relationships: List[Relationship]

# -- API Request Models --
class AnalyzeRequest(BaseModel):
    tenant_id: str
    s3_urls: Dict[str, str]

class FinalizeSchemaRequest(BaseModel):
    tenant_id: str
    table_schemas: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    custom_metrics: List[Dict[str, str]]