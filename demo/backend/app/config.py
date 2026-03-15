from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DGX Spark Elasticsearch instances
    DGX_SPARK_HOST: str = "192.168.1.20"
    ES_GPU_PORT: int = 9200
    ES_CPU_PORT: int = 9201

    # Ollama endpoints
    OLLAMA_EMBED_URL: str = "http://192.168.1.10:11434"
    OLLAMA_LLM_URL: str = "http://192.168.1.20:11434"

    # Models
    EMBED_MODEL: str = "nomic-embed-text"
    LLM_MODEL: str = "llama3.1:70b"

    # Data paths
    DATA_DIR: str = "/opt/ddil/data/preprocessed"

    # Race settings
    RACE_BATCH_SIZE: int = 500
    RACE_METRICS_INTERVAL_MS: int = 500

    @property
    def es_gpu_url(self) -> str:
        return f"http://{self.DGX_SPARK_HOST}:{self.ES_GPU_PORT}"

    @property
    def es_cpu_url(self) -> str:
        return f"http://{self.DGX_SPARK_HOST}:{self.ES_CPU_PORT}"

    class Config:
        env_prefix = "VINEYARD_"
        env_file = ".env"


settings = Settings()
