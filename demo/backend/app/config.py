from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Elasticsearch — one cluster, two data nodes ───────────────────────────
    ES_MAIN_URL: str = "http://es-cpu:9200"            # Framework CPU node (local)
    ES_GPU_URL: str = "http://192.168.1.20:9200"       # DGX Spark GPU node (airgapped default)

    # Optional host/port overrides (used by the AWS bench .env). When the *_HOST
    # form is supplied it wins over the *_URL default above — this is what lets a
    # single code base point at the airgapped box OR the bench by swapping .env.
    ES_GPU_HOST: str | None = None
    ES_GPU_PORT: int = 9200
    ES_CPU_HOST: str | None = None
    ES_CPU_PORT: int = 9201

    # ── DGX Spark — AI/ML powerhouse ──────────────────────────────────────────
    DGX_SPARK_HOST: str = "192.168.1.20"

    # ── Ollama — local inference (airgapped) ──────────────────────────────────
    OLLAMA_EMBED_URL: str = "http://192.168.1.20:11434"
    OLLAMA_LLM_URL: str = "http://192.168.1.20:11434"
    EMBED_MODEL: str = "nomic-embed-text"
    LLM_MODEL: str = "gpt-oss:120b"

    # ── Data paths (container mount) ──────────────────────────────────────────
    DATA_DIR: str = "/data"

    # ── Race settings ─────────────────────────────────────────────────────────
    RACE_BATCH_SIZE: int = 500
    RACE_METRICS_INTERVAL_MS: int = 500

    # ── Finance / SEC demo (chapters 03 + 04) ─────────────────────────────────
    # Which embedder produces query vectors for /api/finance/search:
    #   "bedrock" → Cohere Embed v4 via AWS Bedrock (1536-d) — bench / connected
    #   "ollama"  → local nomic-embed-text (768-d)           — airgapped
    # The chosen backend MUST match the dims the SEC_INDEX was built with.
    EMBED_BACKEND: str = "bedrock"

    SEC_INDEX: str = "sec_10k_2026"

    # Elasticsearch basic-auth (security on for the SEC index; None = no auth)
    ES_USER: str | None = None
    ES_PASSWORD: str | None = None

    # Kibana / Agent Builder
    KIBANA_URL: str = "http://192.168.1.10:5601"
    KIBANA_SPACE: str = "default"
    KIBANA_USER: str | None = None
    KIBANA_PASSWORD: str | None = None
    AGENT_BUILDER_AGENT_ID: str = "finance-analyst"
    AGENT_BUILDER_CONNECTOR_ID: str | None = None
    ES_INFERENCE_LLM_ID: str | None = None

    # AWS Bedrock (only used when EMBED_BACKEND == "bedrock")
    AWS_PROFILE: str | None = None
    AWS_REGION: str = "us-east-2"
    BEDROCK_EMBED_MODEL: str = "us.cohere.embed-v4:0"
    BEDROCK_LLM_MODEL: str = "us.anthropic.claude-sonnet-4-6"

    # ── Jina multimodal + DLS demo (adventure 3) ──────────────────────────────
    # Local Jina omni embedding server (OpenAI-compatible /v1/embeddings) on the
    # Blackwell GPU. Speaks text + image (base64) into one shared vector space.
    JINA_OMNI_URL: str = "http://192.168.1.20:8081"
    JINA_OMNI_MODEL: str = "jina-embeddings-v5-omni-small"
    JINA_ES_URL: str | None = None              # falls back to es_gpu_url
    # Simple "search images by typing" track (ES-native inference, 768-d)
    JINA_MM_INDEX: str = "jina-multimodal"
    JINA_MM_INFERENCE_ID: str = "jina-omni-text"
    JINA_MM_DIMS: int = 768
    # Scale / DLS "Need-to-Know" track (app-side embed, 1024-d, bbq_hnsw)
    JINA_DLS_INDEX: str = "pmc-unstructured"
    JINA_DLS_DIMS: int = 1024
    # On-box media mounts (figures + source PDFs) served back to the UI
    JINA_FIG_DIR: str = "/data/jina/extracted_imgs"
    JINA_PDF_DIR: str = "/data/jina/samples"
    JINA_IMG_DIR: str = "/data/jina/images"     # 10-doc track PNGs

    # ── CCS edge-federation demo (adventure 4) ────────────────────────────────
    # The querying cluster is Elastic Cloud Hosted (stateful); it adds THIS box
    # as a remote cluster and runs cross-cluster search down into it. The backend
    # (on the box) orchestrates the ECH cluster over the temporary uplink.
    ECH_ES_URL: str = "https://your-deployment.es.us-east-1.aws.found.io:9243"
    ECH_API_KEY: str | None = None              # ApiKey auth to the ECH cluster
    CCS_REMOTE_ALIAS: str = "edge"              # remote-cluster name for the box on ECH
    CCS_BOX_PROXY: str = "edge.ddil.example:9443"  # box transport proxy reachable from ECH
    CCS_BOX_MODE: str = "proxy"                # proxy mode = one endpoint over the uplink
    CCS_INDEX: str = "field-reports"           # demo index present on both clusters

    # ── Derived URLs ──────────────────────────────────────────────────────────
    @property
    def jina_es_url(self) -> str:
        return self.JINA_ES_URL or self.es_gpu_url

    @property
    def es_gpu_url(self) -> str:
        if self.ES_GPU_HOST:
            return f"http://{self.ES_GPU_HOST}:{self.ES_GPU_PORT}"
        return self.ES_GPU_URL

    @property
    def es_cpu_url(self) -> str:
        if self.ES_CPU_HOST:
            return f"http://{self.ES_CPU_HOST}:{self.ES_CPU_PORT}"
        return self.ES_MAIN_URL

    @property
    def kibana_space_url(self) -> str:
        """Base URL for Agent Builder calls, space-scoped when not 'default'."""
        if self.KIBANA_SPACE and self.KIBANA_SPACE != "default":
            return f"{self.KIBANA_URL}/s/{self.KIBANA_SPACE}"
        return self.KIBANA_URL

    class Config:
        env_prefix = "VINEYARD_"
        env_file = ".env"
        extra = "ignore"  # tolerate bench-only vars (DRIVER_*, RACE_*) not modeled here


settings = Settings()
