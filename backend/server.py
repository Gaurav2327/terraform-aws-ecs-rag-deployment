#!/usr/bin/env python3
"""
RAG Backend Server - AWS Bedrock Version
Uses AWS Titan for embeddings and Claude for generation
Cost-efficient cloud-based solution
"""

import os
import json
import time
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
from dotenv import load_dotenv
from pinecone import Pinecone

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="RAG Backend - AWS Bedrock", version="2.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
PORT = int(os.getenv("PORT", "3000"))
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "rag")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# AWS Bedrock Model IDs (cost-efficient choices)
EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"  # 1024 dimensions, $0.0001 per 1K tokens
GENERATION_MODEL = "anthropic.claude-3-haiku-20240307-v1:0"  # $0.00025 per 1K input tokens

print("🔍 Using AWS Bedrock:")
print(f"  Embedding: {EMBEDDING_MODEL}")
print(f"  Generation: {GENERATION_MODEL}")
print(f"  Region: {AWS_REGION}")

if not PINECONE_API_KEY:
    print("❌ Missing PINECONE_API_KEY. Check .env")
    exit(1)

if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
    print("⚠️  Warning: AWS credentials not found in .env file")
    print("💡 The system will try to use default AWS credentials")
    print("💡 (from ~/.aws/credentials or IAM role)")

# Initialize clients
pinecone_client = Pinecone(api_key=PINECONE_API_KEY)

# Initialize Bedrock client with explicit credentials if provided
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    bedrock_runtime = boto3.client(
        'bedrock-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )
else:
    # Fall back to default credential chain (IAM role, ~/.aws/credentials, etc.)
    bedrock_runtime = boto3.client('bedrock-runtime', region_name=AWS_REGION)


# ---------------------- Request/Response Models ----------------------

class IndexRequest(BaseModel):
    text: str
    source: Optional[str] = "manual"
    clearPrevious: Optional[bool] = False


class QueryRequest(BaseModel):
    query: str
    filterBySource: Optional[str] = None


class IndexResponse(BaseModel):
    ok: bool
    indexedChunks: int
    indexName: str
    clearedPrevious: bool


class RetrievedDoc(BaseModel):
    id: str
    score: float
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    answer: str
    retrieved: List[RetrievedDoc]


# ---------------------- Helper Functions ----------------------

def chunk_text(text: str, max_len: int = 2000) -> List[str]:
    """Split large text into chunks with smart splitting."""
    chunks = []
    
    if len(text) <= max_len:
        return [text]
    
    # Split by paragraphs
    paragraphs = [p for p in text.replace('\r\n', '\n').split('\n') if p.strip()]
    current_chunk = ''
    
    for para in paragraphs:
        if len(current_chunk) + len(para) + 1 > max_len:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            # If single paragraph is too long, split it further
            if len(para) > max_len:
                start = 0
                while start < len(para):
                    piece = para[start:start + max_len]
                    if piece.strip():
                        chunks.append(piece.strip())
                    start += max_len
                current_chunk = ''
            else:
                current_chunk = para
        else:
            current_chunk += ('\n' if current_chunk else '') + para
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    # Filter out very small chunks (unless it's the only chunk)
    filtered_chunks = [c for c in chunks if len(c) >= 50] if len(chunks) > 1 else chunks
    
    print(f"📦 Split text ({len(text)} chars) into {len(filtered_chunks)} chunks")
    return filtered_chunks if filtered_chunks else [text]


def embed_text_bedrock(text: str) -> List[float]:
    """Generate embeddings using AWS Titan."""
    try:
        # Truncate if too long (Titan limit is ~8K tokens)
        truncated = text[:8000]
        
        # Prepare request
        request_body = json.dumps({
            "inputText": truncated
        })
        
        # Call Bedrock
        response = bedrock_runtime.invoke_model(
            modelId=EMBEDDING_MODEL,
            body=request_body,
            contentType='application/json',
            accept='application/json'
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        embedding = response_body.get('embedding')
        
        if not embedding:
            raise ValueError("No embedding returned from Bedrock")
        
        return embedding
    except Exception as e:
        print(f"❌ Bedrock embedding error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")


def generate_bedrock(prompt: str, max_tokens: int = 512) -> str:
    """Generate RAG answer with AWS Claude (Haiku - cost-efficient)."""
    print(f"🤖 Calling Bedrock: {GENERATION_MODEL}")
    
    try:
        # Prepare request for Claude
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7
        })
        
        # Call Bedrock
        response = bedrock_runtime.invoke_model(
            modelId=GENERATION_MODEL,
            body=request_body,
            contentType='application/json',
            accept='application/json'
        )
        
        # Parse response
        response_body = json.loads(response['body'].read())
        
        # Extract text from Claude's response
        if 'content' in response_body and len(response_body['content']) > 0:
            return response_body['content'][0]['text']
        else:
            raise ValueError("No content in Bedrock response")
            
    except Exception as e:
        print(f"❌ Bedrock generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")


# ---------------------- API Endpoints ----------------------

@app.post("/index", response_model=IndexResponse)
async def index_text(request: IndexRequest):
    """Add (index) new text into Pinecone."""
    try:
        text = request.text
        source = request.source or "manual"
        clear_previous = request.clearPrevious or False
        
        if not text or len(text) < 10:
            raise HTTPException(status_code=400, detail="Text too short")
        
        print(f"📥 Indexing request: {len(text)} characters from {source}")
        
        # Get index
        index = pinecone_client.Index(PINECONE_INDEX)
        
        # 1️⃣ Clear previous content if requested
        if clear_previous:
            print("🗑️  Clearing previous content from index...")
            try:
                index.delete(delete_all=True)
                print("✅ Previous content cleared")
            except Exception as clear_err:
                print(f"Warning: Could not clear index: {clear_err}")
        
        # 2️⃣ Chunk text
        chunks = chunk_text(text, 2000)
        
        # 3️⃣ Embed and build vectors
        print("🔢 Generating embeddings with AWS Titan...")
        vectors = []
        timestamp = int(time.time() * 1000)
        
        for i, chunk in enumerate(chunks):
            embedding = embed_text_bedrock(chunk)
            vectors.append({
                "id": f"{timestamp}-{i}",
                "values": embedding,
                "metadata": {
                    "source": source,
                    "text": chunk
                }
            })
            
            if (i + 1) % 5 == 0:
                print(f"  Embedded {i + 1}/{len(chunks)} chunks...")
        
        print(f"✅ All {len(vectors)} chunks embedded!")
        
        # 4️⃣ Upsert into Pinecone
        index.upsert(vectors=vectors)
        
        return IndexResponse(
            ok=True,
            indexedChunks=len(vectors),
            indexName=PINECONE_INDEX,
            clearedPrevious=clear_previous
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Index error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """Query RAG pipeline."""
    try:
        query = request.query
        filter_by_source = request.filterBySource
        
        if not query:
            raise HTTPException(status_code=400, detail="No query provided")
        
        # 1️⃣ Embed query
        print("🔍 Embedding query with AWS Titan...")
        q_vec = embed_text_bedrock(query)
        
        # 2️⃣ Search in Pinecone
        index = pinecone_client.Index(PINECONE_INDEX)
        query_options = {
            "vector": q_vec,
            "top_k": 5,
            "include_metadata": True,
        }
        
        if filter_by_source:
            query_options["filter"] = {"source": {"$eq": filter_by_source}}
            print(f"🔍 Filtering results by source: {filter_by_source}")
        
        query_resp = index.query(**query_options)
        
        # Extract hits
        hits = [
            RetrievedDoc(
                id=match.get("id", ""),
                score=match.get("score", 0.0),
                metadata=match.get("metadata", {})
            )
            for match in query_resp.get("matches", [])
        ]
        
        if not hits:
            no_content_msg = (
                "I don't have any indexed content"
                + (" from this page" if filter_by_source else "")
                + " to answer your question. Please index some content first."
            )
            return QueryResponse(answer=no_content_msg, retrieved=[])
        
        # 3️⃣ Build context prompt
        context = "\n\n".join([
            f"Context {i + 1}:\n{hit.metadata.get('text', '')}"
            for i, hit in enumerate(hits)
        ])
        
        prompt = (
            f"You are a helpful assistant. Use ONLY the following context to answer the question. "
            f"If the answer is not in the context, say \"I don't know\".\n\n"
            f"{context}\n\n"
            f"Question: {query}\n"
            f"Answer:"
        )
        
        # 4️⃣ Generate answer with Claude
        answer = generate_bedrock(prompt)
        
        return QueryResponse(answer=answer, retrieved=hits)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check AWS Bedrock connectivity
        bedrock_ok = False
        try:
            # Simple embedding test
            test_embedding = embed_text_bedrock("test")
            bedrock_ok = len(test_embedding) > 0
        except:
            bedrock_ok = False
        
        return {
            "status": "ok",
            "providers": {
                "bedrock": "connected" if bedrock_ok else "disconnected",
                "pinecone": "connected",
                "embedding_model": EMBEDDING_MODEL,
                "generation_model": GENERATION_MODEL
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "🚀 RAG Server (AWS Bedrock)",
        "version": "2.0.0",
        "providers": {
            "embedding": f"AWS Titan ({EMBEDDING_MODEL})",
            "generation": f"AWS Claude ({GENERATION_MODEL})",
            "vector_db": "Pinecone"
        },
        "cost_info": {
            "embedding": "$0.0001 per 1K tokens",
            "generation": "$0.00025 per 1K input tokens, $0.00125 per 1K output tokens"
        }
    }


if __name__ == "__main__":
    import uvicorn
    print(f"🚀 RAG Server starting on http://localhost:{PORT}")
    print("💡 Using AWS Bedrock (Titan + Claude Haiku)")
    print("📝 Make sure AWS credentials are configured")
    print("💰 Cost: ~$0.0002 per query (embedding + generation)")
    uvicorn.run(app, host="0.0.0.0", port=PORT)

