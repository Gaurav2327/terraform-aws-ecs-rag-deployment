# 🤖 RAG System with AWS Bedrock

A production-ready RAG (Retrieval-Augmented Generation) system using **AWS Bedrock** for cost-efficient, scalable document Q&A with a Chrome extension interface.

## ✨ Features

- 📄 **Multi-Format Support**: Upload Excel (.xlsx, .xls), PDF, CSV, TXT files
- 🔍 **Smart Q&A**: Ask questions about your uploaded documents using natural language
- ☁️ **AWS Bedrock**: Uses Titan for embeddings and Claude Haiku for generation
- 💰 **Cost-Efficient**: ~$0.0002 per query (100x cheaper than self-hosting)
- ⚡ **Fast**: Sub-second response times
- 📊 **Vector Search**: Powered by Pinecone for semantic similarity
- 🐳 **Docker Ready**: Deploy to EC2, ECS, or anywhere
- 🔒 **Production Ready**: Proper error handling, health checks, and monitoring

---

## 🚀 Quick Start

### 1. Prerequisites

- **Python 3.11+**
- **AWS Account** with Bedrock access enabled
- **Pinecone Account** (free tier available)
- **Docker** (optional, for containerized deployment)

### 2. Install Dependencies

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 3. Configure Environment

Create `.env` file in `backend/`:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_INDEX=rag

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
AWS_REGION=us-east-1

# Server Configuration
PORT=3000
```

**Get API Keys:**
- **Pinecone**: https://www.pinecone.io/ (free tier: 100K vectors)
- **AWS**: Get from AWS Console → IAM → Users → Security Credentials → Create Access Key

### 4. Get AWS Access Keys

1. Go to **AWS Console → IAM → Users**
2. Select your user (or create new one)
3. Go to **Security credentials** tab
4. Click **Create access key**
5. Choose **Application running outside AWS**
6. Copy the **Access key ID** and **Secret access key**
7. Add them to your `.env` file

### 5. Enable AWS Bedrock Models

1. Go to **AWS Console → Bedrock → Model access**
2. Click **Modify model access**
3. Enable these models:
   - ✅ **Titan Embeddings G1 - Text**
   - ✅ **Claude 3 Haiku**
4. Click **Save changes**
5. Wait for status to show "Access granted"

### 6. Start the Server

```bash
cd backend
python server.py
```

Server will start at `http://localhost:3000`

### 7. Load Chrome Extension

1. Open `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

---

## 📖 How It Works

### Architecture

```
┌─────────────────┐
│ Chrome Extension│
│  (Upload Files) │
└────────┬────────┘
         │ HTTP/JSON
         ▼
┌─────────────────┐
│ FastAPI Backend │
│  (Python 3.11)  │
└────┬──────┬─────┘
     │      │
     │      └──────────────┐
     │                     │
     ▼                     ▼
┌──────────────┐    ┌──────────────┐
│ AWS Bedrock  │    │   Pinecone   │
│              │    │  Vector DB   │
│ • Titan      │    │              │
│   Embeddings │    │ Store & Query│
│ • Claude     │    │  Embeddings  │
│   Generation │    │              │
└──────────────┘    └──────────────┘
```

### Workflow

1. **Upload Document** → Chrome extension extracts text
2. **Chunk Text** → Backend splits into 2000-char chunks
3. **Generate Embeddings** → AWS Titan creates vector embeddings
4. **Store in Pinecone** → Vectors stored with metadata
5. **Query** → User asks a question
6. **Semantic Search** → Pinecone finds relevant chunks
7. **Generate Answer** → Claude generates response from context

---

## 💰 Cost Breakdown

### Per-Query Cost

| Component | Model | Cost per 1K tokens | Avg Cost/Query |
|-----------|-------|-------------------|----------------|
| **Embedding** | Titan Text v1 | $0.0001 | $0.00005 |
| **Generation** | Claude 3 Haiku | $0.00025 (input)<br>$0.00125 (output) | $0.00015 |
| **Vector DB** | Pinecone | Free tier | $0.00000 |
| **Total** | | | **~$0.0002** |

### Monthly Costs by Usage

| Queries/Day | Queries/Month | API Cost | Infrastructure | Total/Month |
|-------------|---------------|----------|----------------|-------------|
| 10 | 300 | $0.06 | $20-35 | **$20-35** |
| 100 | 3,000 | $0.60 | $20-35 | **$21-36** |
| 500 | 15,000 | $3.00 | $20-35 | **$23-38** |
| 1,000 | 30,000 | $6.00 | $20-35 | **$26-41** |
| 5,000 | 150,000 | $30.00 | $35-50 | **$65-80** |

**Infrastructure cost** = EC2 t3.medium or ECS Fargate 2 vCPU/4GB RAM

---

## 🐳 Deployment Options

### Option 1: Local Development

```bash
cd backend
python server.py
```

**Best for**: Development and testing

---

### Option 2: Docker

```bash
cd backend

# Build image
docker build -t rag-backend .

# Run container
docker run -d \
  -p 3000:3000 \
  -e PINECONE_API_KEY=your-key \
  -e PINECONE_INDEX=rag \
  -e AWS_ACCESS_KEY_ID=your-access-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret-key \
  -e AWS_REGION=us-east-1 \
  --name rag-backend \
  rag-backend
```

**Best for**: Consistent deployments

---

### Option 3: AWS EC2

```bash
# 1. Launch EC2 instance (t3.medium recommended)
# 2. SSH into instance
ssh -i your-key.pem ec2-user@your-instance-ip

# 3. Install Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# 4. Pull and run your image
docker pull your-registry/rag-backend:latest
docker run -d -p 3000:3000 \
  -e PINECONE_API_KEY=your-key \
  --name rag-backend \
  your-registry/rag-backend:latest

# 5. Configure security group to allow port 3000
```

**Cost**: ~$30/month (t3.medium on-demand)  
**Best for**: Simple, stable deployments

---

### Option 4: AWS ECS Fargate

**Step 1**: Push image to ECR

```bash
# Create ECR repository
aws ecr create-repository --repository-name rag-backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag rag-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rag-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rag-backend:latest
```

**Step 2**: Create task definition (`ecs-task-definition.json`)

```json
{
  "family": "rag-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "rag-backend",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/rag-backend:latest",
      "portMappings": [{"containerPort": 3000}],
      "environment": [
        {"name": "PORT", "value": "3000"},
        {"name": "PINECONE_INDEX", "value": "rag"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ],
      "secrets": [
        {
          "name": "PINECONE_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT:secret:pinecone-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rag-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Step 3**: Deploy

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create cluster
aws ecs create-cluster --cluster-name rag-cluster

# Create service
aws ecs create-service \
  --cluster rag-cluster \
  --service-name rag-backend-service \
  --task-definition rag-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

**Cost**: ~$35/month (1 vCPU, 2GB RAM)  
**Best for**: Production, auto-scaling needs

---

## 🧪 Testing

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "providers": {
    "bedrock": "connected",
    "pinecone": "connected",
    "embedding_model": "amazon.titan-embed-text-v1",
    "generation_model": "anthropic.claude-3-haiku-20240307-v1:0"
  }
}
```

### 2. Index Sample Data

```bash
curl -X POST http://localhost:3000/index \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Paris is the capital of France. It is known for the Eiffel Tower, Louvre Museum, and excellent cuisine.",
    "source": "test-doc",
    "clearPrevious": true
  }'
```

### 3. Query

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the capital of France?"
  }'
```

Expected response:
```json
{
  "answer": "The capital of France is Paris.",
  "retrieved": [
    {
      "id": "1234567890-0",
      "score": 0.95,
      "metadata": {
        "source": "test-doc",
        "text": "Paris is the capital of France..."
      }
    }
  ]
}
```

### 4. Test with Chrome Extension

1. Click extension icon
2. Upload `test-data.csv`
3. Ask: "How many employees are in Engineering?"
4. Expected answer: "3 employees"

---

## 📊 API Documentation

Interactive API docs available at: `http://localhost:3000/docs`

### Endpoints

#### POST /index
Index new text into the vector database.

**Request:**
```json
{
  "text": "Your document text here...",
  "source": "filename.pdf",
  "clearPrevious": false
}
```

**Response:**
```json
{
  "ok": true,
  "indexedChunks": 5,
  "indexName": "rag",
  "clearedPrevious": false
}
```

#### POST /query
Query the RAG system.

**Request:**
```json
{
  "query": "Your question here?",
  "filterBySource": "filename.pdf"
}
```

**Response:**
```json
{
  "answer": "The answer based on your documents...",
  "retrieved": [
    {
      "id": "chunk-id",
      "score": 0.95,
      "metadata": {"source": "...", "text": "..."}
    }
  ]
}
```

#### GET /health
Health check endpoint.

#### GET /
Root endpoint with system info.

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PINECONE_API_KEY` | ✅ Yes | - | Pinecone API key |
| `PINECONE_INDEX` | No | `rag` | Pinecone index name |
| `AWS_REGION` | No | `us-east-1` | AWS region for Bedrock |
| `PORT` | No | `3000` | Server port |

### AWS IAM Permissions

Your AWS user or role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }
  ]
}
```

**To attach policy:**
1. Go to **AWS Console → IAM → Users**
2. Select your user
3. Click **Add permissions → Attach policies directly**
4. Click **Create policy** → JSON tab
5. Paste the above policy
6. Name it `BedrockInvokePolicy`
7. Attach it to your user

---

## 📈 Performance

### Benchmarks (Single Query)

| Operation | Time | Cost |
|-----------|------|------|
| Embedding (Titan) | ~100ms | $0.00005 |
| Vector Search (Pinecone) | ~50ms | $0.00000 |
| Generation (Claude Haiku) | ~800ms | $0.00015 |
| **Total** | **~1000ms** | **$0.0002** |

### Optimization Tips

1. **Batch embeddings**: Process multiple chunks in parallel
2. **Cache results**: Cache common queries
3. **Adjust chunk size**: Larger chunks = fewer API calls but less precision
4. **Use filters**: Filter by source to reduce search scope

---

## 🆘 Troubleshooting

### "Bedrock not connected"

**Solution**: Enable Bedrock models in AWS Console

1. Go to AWS Console → Bedrock → Model access
2. Enable these models:
   - **Titan Embeddings G1 - Text v2** (important: v2, not v1!)
   - **Claude 3 Haiku**
3. Wait for "Access granted" status

### "PINECONE_API_KEY missing"

**Solution**: Set environment variable

```bash
export PINECONE_API_KEY=your-key
```

### "No such model" error

**Solution**: Verify models are enabled

1. Go to **AWS Console → Bedrock → Model access**
2. Make sure status shows **"Access granted"** for:
   - Titan Embeddings G1 - Text
   - Claude 3 Haiku
3. If not, click **Modify model access** and enable them
4. Wait a few minutes for access to be granted

### High latency

**Solution**: 
- Check AWS region (use closest to your location)
- Use smaller `max_tokens` for generation
- Enable CloudFront for edge caching

---

## 🔒 Security Best Practices

1. **Use IAM Roles**: Prefer IAM roles over access keys
2. **Secrets Manager**: Store API keys in AWS Secrets Manager
3. **VPC**: Deploy in private subnets with NAT gateway
4. **Security Groups**: Restrict inbound traffic
5. **HTTPS**: Use ALB with SSL certificate
6. **API Gateway**: Add rate limiting and authentication

---

## 💡 Why AWS Bedrock?

### vs Self-Hosted Ollama

| Factor | AWS Bedrock | Self-Hosted Ollama |
|--------|------------|-------------------|
| **Cost (100 queries/day)** | ~$21/month | ~$45-153/month |
| **Setup Complexity** | Low | High |
| **Image Size** | 500 MB | 7.8 GB |
| **Cold Start** | Instant | 2-3 minutes |
| **Scaling** | Automatic | Manual |
| **Maintenance** | Managed | Self-managed |
| **Model Updates** | Automatic | Manual |

**Bedrock is better when**:
- ✅ You want low operational overhead
- ✅ Usage is moderate (<1000 queries/day)
- ✅ You need fast deployments
- ✅ You want automatic scaling

**Self-hosted is better when**:
- ✅ Very high volume (>5000 queries/day)
- ✅ Need complete privacy/offline capability
- ✅ Want to avoid per-query costs

---

## 📦 Project Structure

```
rag-bedrock-pinecone-v2/
├── backend/
│   ├── server.py           # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Docker image
│   ├── .env               # Configuration (gitignored)
│   └── start.sh           # Startup script
├── chrome-extension/
│   ├── manifest.json      # Extension config
│   ├── popup/
│   │   ├── popup.html    # Extension UI
│   │   └── popup.js      # Extension logic
│   └── libs/             # PDF.js, SheetJS
├── test-data.csv         # Sample data
└── README.md             # This file
```

---

## 🎯 Use Cases

- **Document Q&A**: Upload PDFs/docs and ask questions
- **Data Analysis**: Query CSV/Excel files naturally
- **Knowledge Base**: Build searchable knowledge repositories
- **Customer Support**: Create FAQ systems from documentation
- **Research**: Query across multiple research papers

---

## 🔄 Migration from Ollama

If you're migrating from the Ollama version:

1. **Code is already updated** - Just reinstall dependencies
2. **Remove Ollama**: `brew uninstall ollama` (if installed)
3. **Update .env**: Remove `OLLAMA_*` variables
4. **Enable Bedrock**: AWS Console → Bedrock → Model access
5. **Test**: Run `python server.py`

**Benefits**:
- 💰 Lower cost for moderate usage
- ⚡ Instant cold starts
- 🔧 No infrastructure management
- 📈 Automatic scaling

---

## 📄 License

MIT License - Feel free to use and modify!

---

## 🙏 Technologies Used

- **Backend**: Python 3.11, FastAPI
- **LLM**: AWS Bedrock (Titan + Claude)
- **Vector DB**: Pinecone
- **Frontend**: Chrome Extension, PDF.js, SheetJS
- **Deployment**: Docker, AWS EC2/ECS

---

## 🎉 Quick Deploy

```bash
# 1. Clone/navigate to repo
cd rag-bedrock-pinecone-v2/backend

# 2. Setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configure
cp .env.example .env

# Edit .env with your keys:
# - PINECONE_API_KEY (from pinecone.io)
# - AWS_ACCESS_KEY_ID (from AWS Console → IAM)
# - AWS_SECRET_ACCESS_KEY (from AWS Console → IAM)

# 4. Enable Bedrock models
# Go to AWS Console → Bedrock → Model access
# Enable: Titan Embeddings + Claude 3 Haiku

# 5. Run
python server.py

# 6. Load extension in Chrome
# chrome://extensions → Load unpacked → select chrome-extension folder

# 7. Test
# Upload test-data.csv and ask: "How many employees?"
```

**That's it! You're ready to use your RAG system.** 🚀

---

**Questions? Issues?** Check the troubleshooting section above or open an issue.

**Want to contribute?** PRs welcome!
