#!/usr/bin/env python3
"""
Simple test script for RAG backend
Tests basic functionality without external dependencies
"""

import requests
import time
import sys

BASE_URL = "http://localhost:3000"

def test_health():
    """Test health endpoint"""
    print("🏥 Testing /health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Is it running?")
        return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_index():
    """Test indexing text"""
    print("\n📥 Testing /index endpoint...")
    try:
        test_data = {
            "text": "Paris is the capital of France. The city is famous for the Eiffel Tower, Louvre Museum, and delicious croissants. It is located on the Seine River.",
            "source": "test",
            "clearPrevious": True
        }
        
        response = requests.post(
            f"{BASE_URL}/index",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Indexing successful: {data}")
            return True
        else:
            print(f"❌ Indexing failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Indexing error: {e}")
        return False

def test_query():
    """Test querying"""
    print("\n🔍 Testing /query endpoint...")
    try:
        test_query = {
            "query": "What is the capital of France?",
        }
        
        response = requests.post(
            f"{BASE_URL}/query",
            json=test_query,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Query successful!")
            print(f"📝 Answer: {data.get('answer', 'No answer')}")
            print(f"📊 Retrieved {len(data.get('retrieved', []))} documents")
            return True
        else:
            print(f"❌ Query failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Query error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 RAG Backend Test Suite\n")
    print("=" * 50)
    
    # Wait a bit for server to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(2)
    
    tests = [
        ("Health Check", test_health),
        ("Index Text", test_index),
        ("Query Text", test_query),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print("-" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("-" * 50)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 50)
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())

