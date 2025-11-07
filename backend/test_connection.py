#!/usr/bin/env python3
"""
Test script to verify AWS Bedrock and Pinecone connections
Run this before starting the server to ensure everything is configured correctly
"""

import os
import json
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("🧪 Testing RAG System Connections\n")
print("=" * 60)

# Test 1: Check environment variables
print("\n1️⃣ Checking environment variables...")
required_vars = {
    'PINECONE_API_KEY': os.getenv('PINECONE_API_KEY'),
    'AWS_ACCESS_KEY_ID': os.getenv('AWS_ACCESS_KEY_ID'),
    'AWS_SECRET_ACCESS_KEY': os.getenv('AWS_SECRET_ACCESS_KEY'),
    'AWS_REGION': os.getenv('AWS_REGION', 'us-east-1'),
    'PINECONE_INDEX': os.getenv('PINECONE_INDEX', 'rag')
}

all_set = True
for var, value in required_vars.items():
    if not value or value.startswith('your-'):
        print(f"   ❌ {var}: Missing or placeholder")
        all_set = False
    else:
        print(f"   ✅ {var}: Set")

if not all_set:
    print("\n❌ Please update your .env file with actual values!")
    sys.exit(1)

# Test 2: Check AWS credentials
print("\n2️⃣ Testing AWS credentials...")
try:
    import boto3
    sts = boto3.client(
        'sts',
        aws_access_key_id=required_vars['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=required_vars['AWS_SECRET_ACCESS_KEY']
    )
    identity = sts.get_caller_identity()
    print(f"   ✅ AWS credentials valid")
    print(f"   📝 User ARN: {identity['Arn']}")
except Exception as e:
    print(f"   ❌ AWS credentials invalid: {e}")
    sys.exit(1)

# Test 3: Check Bedrock access
print("\n3️⃣ Testing AWS Bedrock access...")
try:
    bedrock = boto3.client(
        'bedrock',
        region_name=required_vars['AWS_REGION'],
        aws_access_key_id=required_vars['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=required_vars['AWS_SECRET_ACCESS_KEY']
    )
    models = bedrock.list_foundation_models()
    print(f"   ✅ Can access Bedrock")
    print(f"   📝 Found {len(models['modelSummaries'])} models")
except Exception as e:
    print(f"   ❌ Cannot access Bedrock: {e}")
    print("   💡 Make sure Bedrock is available in your AWS region")
    sys.exit(1)

# Test 4: Test Titan Embeddings (v2)
print("\n4️⃣ Testing Titan Embeddings v2...")
try:
    bedrock_runtime = boto3.client(
        'bedrock-runtime',
        region_name=required_vars['AWS_REGION'],
        aws_access_key_id=required_vars['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=required_vars['AWS_SECRET_ACCESS_KEY']
    )
    
    response = bedrock_runtime.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        body=json.dumps({'inputText': 'test embedding'})
    )
    
    result = json.loads(response['body'].read())
    embedding = result.get('embedding', [])
    dimension = len(embedding)
    
    print(f"   ✅ Titan embeddings working")
    print(f"   📝 Dimension: {dimension}")
    
    if dimension != 1024:
        print(f"   ⚠️  Warning: Expected 1024 dimensions, got {dimension}")
    
except Exception as e:
    print(f"   ❌ Titan embeddings failed: {e}")
    print("   💡 Go to AWS Console → Bedrock → Model access")
    print("   💡 Enable 'Titan Embeddings G1 - Text v2'")
    sys.exit(1)

# Test 5: Test Claude Haiku
print("\n5️⃣ Testing Claude 3 Haiku...")
try:
    response = bedrock_runtime.invoke_model(
        modelId='anthropic.claude-3-haiku-20240307-v1:0',
        body=json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 100,
            'messages': [
                {
                    'role': 'user',
                    'content': 'Say hello in one word'
                }
            ]
        })
    )
    
    result = json.loads(response['body'].read())
    text = result['content'][0]['text']
    
    print(f"   ✅ Claude Haiku working")
    print(f"   📝 Response: {text}")
    
except Exception as e:
    print(f"   ❌ Claude Haiku failed: {e}")
    print("   💡 Go to AWS Console → Bedrock → Model access")
    print("   💡 Enable 'Claude 3 Haiku'")
    sys.exit(1)

# Test 6: Check Pinecone connection
print("\n6️⃣ Testing Pinecone connection...")
try:
    from pinecone import Pinecone
    
    pc = Pinecone(api_key=required_vars['PINECONE_API_KEY'])
    
    # List indexes
    indexes = pc.list_indexes()
    print(f"   ✅ Pinecone connected")
    print(f"   📝 Available indexes:")
    
    index_name = required_vars['PINECONE_INDEX']
    index_found = False
    correct_dimension = False
    
    for idx in indexes:
        idx_name = idx.get('name', idx)
        if hasattr(idx, 'dimension'):
            dimension = idx.dimension
        elif isinstance(idx, dict):
            dimension = idx.get('dimension', 'unknown')
        else:
            dimension = 'unknown'
            
        status = ""
        if idx_name == index_name:
            index_found = True
            if dimension == 1024:
                correct_dimension = True
                status = " ← Your index (✅ correct dimension)"
            else:
                status = f" ← Your index (⚠️  dimension is {dimension}, should be 1024)"
        
        print(f"      - {idx_name} (dimension: {dimension}){status}")
    
    if not indexes:
        print("      (No indexes found)")
    
    if not index_found:
        print(f"\n   ❌ Index '{index_name}' not found!")
        print(f"   💡 Go to https://app.pinecone.io/")
        print(f"   💡 Create index: name='{index_name}', dimensions=1024")
        sys.exit(1)
    
    if not correct_dimension:
        print(f"\n   ❌ Index '{index_name}' has wrong dimensions!")
        print(f"   💡 Delete and recreate with 1024 dimensions")
        print(f"   💡 Or change PINECONE_INDEX in .env to use different index")
        sys.exit(1)
    
except Exception as e:
    print(f"   ❌ Pinecone connection failed: {e}")
    sys.exit(1)

# Test 7: Test end-to-end embedding + Pinecone
print("\n7️⃣ Testing end-to-end (Embedding + Pinecone)...")
try:
    # Generate embedding
    response = bedrock_runtime.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        body=json.dumps({'inputText': 'test document'})
    )
    result = json.loads(response['body'].read())
    embedding = result.get('embedding', [])
    
    # Connect to Pinecone index
    index = pc.Index(index_name)
    
    # Try to upsert a test vector
    test_id = "test-vector-123"
    index.upsert(vectors=[{
        "id": test_id,
        "values": embedding,
        "metadata": {"text": "test", "source": "test"}
    }])
    
    print(f"   ✅ Successfully stored embedding in Pinecone")
    
    # Try to query
    query_result = index.query(
        vector=embedding,
        top_k=1,
        include_metadata=True
    )
    
    if query_result.matches:
        print(f"   ✅ Successfully queried Pinecone")
        print(f"   📝 Found {len(query_result.matches)} match(es)")
    
    # Clean up test vector
    index.delete(ids=[test_id])
    print(f"   ✅ Cleaned up test data")
    
except Exception as e:
    print(f"   ❌ End-to-end test failed: {e}")
    sys.exit(1)

# All tests passed!
print("\n" + "=" * 60)
print("✅ All tests passed! Your system is ready to use.")
print("\n🚀 Start the server with: python server.py")
print("=" * 60)

