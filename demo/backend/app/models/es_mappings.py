VINEYARD_SOIL = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "vineyard_id": {"type": "keyword"},
            "block_id": {"type": "keyword"},
            "station_id": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "source": {"type": "keyword"},
            "soil_moisture_pct": {"type": "float"},
            "soil_temp_6in_c": {"type": "float"},
            "soil_temp_12in_c": {"type": "float"},
            "soil_temp_24in_c": {"type": "float"},
            "electrical_conductivity": {"type": "float"},
            "depth_cm": {"type": "integer"},
            "reading_vector": {
                "type": "dense_vector",
                "dims": 8,
                "index": True,
                "similarity": "cosine",
            },
        }
    },
}

VINEYARD_NPK = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "vineyard_id": {"type": "keyword"},
            "block_id": {"type": "keyword"},
            "source": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "soil_nitrogen_mgkg": {"type": "float"},
            "soil_phosphorus_mgkg": {"type": "float"},
            "soil_potassium_mgkg": {"type": "float"},
            "temperature_c": {"type": "float"},
            "humidity_pct": {"type": "float"},
            "ph": {"type": "float"},
            "rainfall_mm": {"type": "float"},
            "crop_suitability": {"type": "keyword"},
            "npk_vector": {
                "type": "dense_vector",
                "dims": 7,
                "index": True,
                "similarity": "cosine",
            },
        }
    },
}

VINEYARD_IMAGERY = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "vineyard_id": {"type": "keyword"},
            "block_id": {"type": "keyword"},
            "source": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "image_path": {"type": "keyword"},
            "image_type": {"type": "keyword"},
            "classification": {"type": "keyword"},
            "confidence": {"type": "float"},
            "altitude_m": {"type": "float"},
            "description": {"type": "text", "analyzer": "english"},
            "image_embedding": {
                "type": "dense_vector",
                "dims": 768,
                "index": True,
                "similarity": "cosine",
            },
        }
    },
}

VINEYARD_HARVEST = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "vineyard_id": {"type": "keyword"},
            "block_id": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "grape_mass_kg": {"type": "float"},
            "sugar_brix": {"type": "float"},
            "acidity": {"type": "float"},
            "ph": {"type": "float"},
            "yan_mgL": {"type": "float"},
            "quality_score": {"type": "integer"},
            "variety": {"type": "keyword"},
            "vintage_year": {"type": "integer"},
        }
    },
}

VINEYARD_WINE = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "timestamp": {"type": "date"},
            "wine_type": {"type": "keyword"},
            "fixed_acidity": {"type": "float"},
            "volatile_acidity": {"type": "float"},
            "citric_acid": {"type": "float"},
            "residual_sugar": {"type": "float"},
            "chlorides": {"type": "float"},
            "free_sulfur_dioxide": {"type": "float"},
            "total_sulfur_dioxide": {"type": "float"},
            "density": {"type": "float"},
            "ph": {"type": "float"},
            "sulphates": {"type": "float"},
            "alcohol": {"type": "float"},
            "quality": {"type": "integer"},
        }
    },
}

INDEX_MAPPINGS = {
    "vineyard-soil": VINEYARD_SOIL,
    "vineyard-npk": VINEYARD_NPK,
    "vineyard-imagery": VINEYARD_IMAGERY,
    "vineyard-harvest": VINEYARD_HARVEST,
    "vineyard-wine": VINEYARD_WINE,
}
