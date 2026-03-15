# 11 - Demo Application Setup

> **Goal:** Deploy a user-friendly chat interface for RAG demonstrations.

## Application Options

| Option | Pros | Cons |
|--------|------|------|
| **Streamlit** | Fast to build, Python native | Single-user |
| **Gradio** | Simple chat UI, shareable | Limited customization |
| **Open WebUI** | Full-featured, multi-user | Heavier |
| **Custom React** | Fully customizable | More development time |

**Recommended:** Streamlit for simplicity, Open WebUI for full demo.

---

## Option A: Streamlit RAG Chat

### Step 1: Install Python Environment

```bash
# Install Python and pip
sudo apt install -y python3-pip python3-venv

# Create virtual environment
python3 -m venv /opt/ddil/demo-app/venv
source /opt/ddil/demo-app/venv/bin/activate

# Install dependencies
pip install streamlit elasticsearch ollama requests
```

### Step 2: Create Streamlit App

```bash
mkdir -p /opt/ddil/demo-app

cat > /opt/ddil/demo-app/app.py <<'EOF'
import streamlit as st
import requests
from elasticsearch import Elasticsearch
import json

# Configuration
ES_HOST = "http://localhost:9200"
ES_USER = "elastic"
ES_INDEX = "ddil-docs-demo"
DGX_HOST = "http://192.168.1.20:11434"
EMBED_HOST = "http://localhost:11434"
MODEL = "llama3.1:70b"

# Load password
with open("/opt/ddil/config/.es_password", "r") as f:
    ES_PASSWORD = f.read().strip()

# Initialize Elasticsearch client
es = Elasticsearch(
    ES_HOST,
    basic_auth=(ES_USER, ES_PASSWORD),
    verify_certs=False
)

st.set_page_config(
    page_title="DDIL Demo - AI Search",
    page_icon="🔍",
    layout="wide"
)

st.title("🔍 DDIL Demo Kit - AI-Powered Search")
st.markdown("*Semantic search and RAG powered by Elasticsearch + NVIDIA DGX Spark*")

# Sidebar
st.sidebar.header("Settings")
model_choice = st.sidebar.selectbox(
    "LLM Model",
    ["llama3.1:70b", "llama3.1:8b", "qwen2.5:72b", "mistral:7b (local)"]
)
num_results = st.sidebar.slider("Search results", 1, 10, 3)
show_sources = st.sidebar.checkbox("Show source documents", value=True)

# Chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if "sources" in message and show_sources:
            with st.expander("📚 Sources"):
                for src in message["sources"]:
                    st.markdown(f"**{src['title']}** (score: {src['score']:.3f})")
                    st.markdown(f"_{src['content'][:200]}..._")

def get_embedding(text):
    """Get embedding from local Ollama"""
    response = requests.post(
        f"{EMBED_HOST}/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text}
    )
    return response.json()["embedding"]

def search_documents(query, k=3):
    """Semantic search in Elasticsearch"""
    embedding = get_embedding(query)
    
    response = es.search(
        index=ES_INDEX,
        knn={
            "field": "content_embedding",
            "query_vector": embedding,
            "k": k,
            "num_candidates": k * 3
        },
        source=["title", "content", "category"]
    )
    
    results = []
    for hit in response["hits"]["hits"]:
        results.append({
            "title": hit["_source"]["title"],
            "content": hit["_source"]["content"],
            "score": hit["_score"]
        })
    return results

def generate_response(query, context, model):
    """Generate RAG response using LLM"""
    # Determine host based on model
    if "local" in model:
        host = EMBED_HOST
        model_name = "mistral:7b"
    else:
        host = DGX_HOST
        model_name = model
    
    # Build prompt
    context_text = "\n\n".join([
        f"Title: {doc['title']}\nContent: {doc['content']}"
        for doc in context
    ])
    
    prompt = f"""Based on the following context, answer the question accurately and concisely.

Context:
{context_text}

Question: {query}

Answer:"""
    
    # Stream response
    response = requests.post(
        f"{host}/api/generate",
        json={
            "model": model_name,
            "prompt": prompt,
            "stream": True
        },
        stream=True
    )
    
    full_response = ""
    for line in response.iter_lines():
        if line:
            data = json.loads(line)
            token = data.get("response", "")
            full_response += token
            yield token
    
    return full_response

# Chat input
if prompt := st.chat_input("Ask a question about your documents..."):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # Search for relevant documents
    with st.spinner("Searching documents..."):
        sources = search_documents(prompt, k=num_results)
    
    # Generate response
    with st.chat_message("assistant"):
        response_placeholder = st.empty()
        full_response = ""
        
        for token in generate_response(prompt, sources, model_choice):
            full_response += token
            response_placeholder.markdown(full_response + "▌")
        
        response_placeholder.markdown(full_response)
        
        if show_sources:
            with st.expander("📚 Sources"):
                for src in sources:
                    st.markdown(f"**{src['title']}** (score: {src['score']:.3f})")
                    st.markdown(f"_{src['content'][:200]}..._")
    
    # Save assistant message
    st.session_state.messages.append({
        "role": "assistant",
        "content": full_response,
        "sources": sources
    })

# Footer
st.sidebar.markdown("---")
st.sidebar.markdown("**System Status**")
try:
    health = es.cluster.health()
    st.sidebar.success(f"ES: {health['status']}")
except:
    st.sidebar.error("ES: Disconnected")

try:
    r = requests.get(f"{DGX_HOST}/api/tags", timeout=2)
    st.sidebar.success("DGX: Connected")
except:
    st.sidebar.warning("DGX: Disconnected")
EOF
```

### Step 3: Create Systemd Service

```bash
sudo tee /etc/systemd/system/ddil-demo.service <<EOF
[Unit]
Description=DDIL Demo Streamlit App
After=network.target docker.service

[Service]
Type=simple
User=ddil
WorkingDirectory=/opt/ddil/demo-app
Environment="PATH=/opt/ddil/demo-app/venv/bin"
ExecStart=/opt/ddil/demo-app/venv/bin/streamlit run app.py --server.port 8501 --server.address 0.0.0.0
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ddil-demo
sudo systemctl start ddil-demo
```

### Step 4: Access Demo

Open browser: `http://192.168.1.10:8501`

---

## Option B: Open WebUI (Full Featured)

### Step 1: Add to Docker Compose

```bash
cat >> /opt/ddil/docker-compose.yml <<'EOF'

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: ddil-webui
    volumes:
      - /opt/ddil/data/open-webui:/app/backend/data
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://192.168.1.20:11434
      - WEBUI_AUTH=false
    networks:
      - ddil-net
    restart: unless-stopped
EOF
```

### Step 2: Start Open WebUI

```bash
cd /opt/ddil
docker compose up -d open-webui
```

### Step 3: Access

Open browser: `http://192.168.1.10:3000`

---

## Option C: Kibana AI Assistant

Kibana includes built-in AI Assistant features:

1. Go to Kibana: `http://192.168.1.10:5601`
2. Enable AI Assistant in Stack Management
3. Configure Ollama connector:
   - URL: `http://192.168.1.20:11434`
   - Model: `llama3.1:70b`

---

## Create Demo Dashboard in Kibana

### Step 1: Import Sample Data

```bash
# Create index pattern in Kibana
curl -X POST -u "elastic:${ELASTIC_PASSWORD}" \
  "http://localhost:5601/api/saved_objects/index-pattern/ddil-docs-*" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d '{
    "attributes": {
      "title": "ddil-docs-*",
      "timeFieldName": "timestamp"
    }
  }'
```

### Step 2: Create Visualizations

In Kibana:

1. **Document Count** - Metric visualization
2. **Categories Breakdown** - Pie chart by category
3. **Recent Documents** - Data table
4. **Search Analytics** - Line chart of search latency

---

## Demo Scenarios Script

```bash
cat > /opt/ddil/scripts/demo-scenarios.md <<'EOF'
# DDIL Demo Kit - Demo Scenarios

## Scenario 1: Basic Semantic Search (2 min)

1. Open Kibana or Streamlit UI
2. Search: "How does vector search work?"
3. Show: Relevant results ranked by semantic similarity
4. Point out: No keyword matching required

## Scenario 2: RAG Q&A (3 min)

1. Ask: "What is the difference between keyword and semantic search?"
2. Show: Model generating answer based on retrieved context
3. Point out: Sources shown for verification
4. Highlight: Running entirely offline

## Scenario 3: Document Ingestion (2 min)

1. Upload new document via API
2. Show: Automatic embedding generation
3. Search for content in new document
4. Point out: Sub-second indexing

## Scenario 4: Multi-Model Demo (3 min)

1. Start with fast 8B model for simple query
2. Switch to 70B model for complex analysis
3. Compare response quality
4. Point out: Model selection flexibility

## Scenario 5: Airgapped Operation (2 min)

1. Disconnect Wi-Fi / external network
2. Continue querying - all works
3. Point out: Zero cloud dependency
4. Highlight: Data never leaves the device

## Talking Points

- "1 PFLOP of AI compute in a Pelican case"
- "GPT-4 class reasoning, completely offline"
- "Enterprise search + AI inference in one rack"
- "Sub-second semantic search, 4-5 second responses"
- "From classified SCIFs to forward operating bases"
EOF
```

---

## Demo Application Complete

### Verification Checklist

- [ ] Streamlit app running on port 8501
- [ ] Can connect to Elasticsearch
- [ ] Can connect to DGX Spark
- [ ] Chat interface works
- [ ] Sources displayed correctly
- [ ] Streaming responses working

### Access URLs

| Service | URL |
|---------|-----|
| Streamlit Demo | http://192.168.1.10:8501 |
| Open WebUI | http://192.168.1.10:3000 |
| Kibana | http://192.168.1.10:5601 |

---

## Next Step

Proceed to → [12-VALIDATION.md](12-VALIDATION.md)
