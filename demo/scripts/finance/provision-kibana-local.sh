#!/usr/bin/env bash
# provision-kibana.sh — idempotently create the SEC dashboard assets in the
# nvidia space: data view + Lens visualizations + dashboard.
#
# Run after sec_10k_2026 is loaded:
#   EP="<elastic-password>" bash provision-kibana.sh
set -euo pipefail

KB="${KB:-http://192.168.1.10:5601}"
EP="${EP:?set EP to the elastic user password}"
H=(-u "elastic:$EP" -H 'Content-Type: application/json' -H 'kbn-xsrf: true')

# ─── 1. Data view ──────────────────────────────────────────────────────────
echo "==> data view"
curl -sS "${H[@]}" -X POST "$KB/api/data_views/data_view" -d '{
  "data_view": {"id":"sec-10k-data-view","title":"sec_10k_2026","name":"SEC 10-K filings (S&P 500)","allowNoIndex":false},
  "override": true
}' >/dev/null

# ─── 2. Lens viz: chunks-by-sector donut ───────────────────────────────────
echo "==> lens: chunks by sector"
curl -sS "${H[@]}" -X POST "$KB/api/saved_objects/lens/sec-by-sector?overwrite=true" -d '{
  "attributes": {
    "title": "SEC 10-K chunks by sector",
    "description": "Distribution of indexed 10-K chunks across the 11 GICS sectors",
    "visualizationType": "lnsPie",
    "state": {
      "datasourceStates": {
        "formBased": {
          "layers": {
            "L1": {
              "indexPatternId": "sec-10k-data-view",
              "columns": {
                "c1": {"label":"Sector","dataType":"string","operationType":"terms","sourceField":"sector","scale":"ordinal","params":{"size":11,"orderBy":{"type":"column","columnId":"c2"},"orderDirection":"desc"},"isBucketed":true},
                "c2": {"label":"Chunks","dataType":"number","operationType":"count","sourceField":"___records___","isBucketed":false}
              },
              "columnOrder": ["c1","c2"],
              "incompleteColumns": {}
            }
          }
        }
      },
      "visualization": {
        "shape": "donut",
        "layers": [{"layerId":"L1","primaryGroups":["c1"],"metrics":["c2"],"numberDisplay":"value","categoryDisplay":"default","legendDisplay":"show","legendPosition":"right","layerType":"data"}]
      },
      "filters": [],
      "query": {"language":"kuery","query":""}
    },
    "references": []
  },
  "references": [{"type":"index-pattern","id":"sec-10k-data-view","name":"indexpattern-datasource-layer-L1"}]
}' | python3 -c "import json,sys; print('  ',json.load(sys.stdin).get('id'))"

# ─── 3. Lens viz: top tickers ──────────────────────────────────────────────
echo "==> lens: top tickers"
curl -sS "${H[@]}" -X POST "$KB/api/saved_objects/lens/sec-top-tickers?overwrite=true" -d '{
  "attributes": {
    "title": "Top tickers by indexed chunk count",
    "description": "Which S&P 500 companies produced the longest 10-Ks (most chunks)",
    "visualizationType": "lnsXY",
    "state": {
      "datasourceStates": {
        "formBased": {
          "layers": {
            "L1": {
              "indexPatternId": "sec-10k-data-view",
              "columns": {
                "c1": {"label":"Ticker","dataType":"string","operationType":"terms","sourceField":"ticker","scale":"ordinal","params":{"size":15,"orderBy":{"type":"column","columnId":"c2"},"orderDirection":"desc"},"isBucketed":true},
                "c2": {"label":"Chunks","dataType":"number","operationType":"count","sourceField":"___records___","isBucketed":false}
              },
              "columnOrder": ["c1","c2"],
              "incompleteColumns": {}
            }
          }
        }
      },
      "visualization": {
        "preferredSeriesType": "bar_horizontal",
        "legend": {"isVisible":false,"position":"right"},
        "valueLabels": "show",
        "fittingFunction": "None",
        "axisTitlesVisibilitySettings":{"x":true,"yLeft":true,"yRight":true},
        "tickLabelsVisibilitySettings":{"x":true,"yLeft":true,"yRight":true},
        "labelsOrientation":{"x":0,"yLeft":0,"yRight":0},
        "gridlinesVisibilitySettings":{"x":true,"yLeft":true,"yRight":true},
        "layers": [{"layerId":"L1","accessors":["c2"],"seriesType":"bar_horizontal","layerType":"data","xAccessor":"c1"}]
      },
      "filters": [],
      "query": {"language":"kuery","query":""}
    }
  },
  "references": [{"type":"index-pattern","id":"sec-10k-data-view","name":"indexpattern-datasource-layer-L1"}]
}' | python3 -c "import json,sys; print('  ',json.load(sys.stdin).get('id'))"

# ─── 4. Lens viz: total chunks metric ──────────────────────────────────────
echo "==> lens: total chunks metric"
curl -sS "${H[@]}" -X POST "$KB/api/saved_objects/lens/sec-total-chunks?overwrite=true" -d '{
  "attributes": {
    "title": "Total indexed chunks",
    "visualizationType": "lnsMetric",
    "state": {
      "datasourceStates": {
        "formBased": {
          "layers": {
            "L1": {
              "indexPatternId": "sec-10k-data-view",
              "columns": {
                "c1": {"label":"Total chunks","dataType":"number","operationType":"count","sourceField":"___records___","isBucketed":false}
              },
              "columnOrder": ["c1"],
              "incompleteColumns": {}
            }
          }
        }
      },
      "visualization": {"layerId":"L1","layerType":"data","metricAccessor":"c1","color":"#00bfb3"},
      "filters": [],
      "query": {"language":"kuery","query":""}
    }
  },
  "references": [{"type":"index-pattern","id":"sec-10k-data-view","name":"indexpattern-datasource-layer-L1"}]
}' | python3 -c "import json,sys; print('  ',json.load(sys.stdin).get('id'))"

# ─── 5. Lens viz: distinct filings count via ES|QL would be ideal but ──────
# ─── lnsMetric over the chunk count is fine for the chunk view. Add a ──────
# ─── "distinct tickers" tile for color.                              ──────
echo "==> lens: distinct tickers metric"
curl -sS "${H[@]}" -X POST "$KB/api/saved_objects/lens/sec-distinct-tickers?overwrite=true" -d '{
  "attributes": {
    "title": "Distinct tickers",
    "visualizationType": "lnsMetric",
    "state": {
      "datasourceStates": {
        "formBased": {
          "layers": {
            "L1": {
              "indexPatternId": "sec-10k-data-view",
              "columns": {
                "c1": {"label":"Companies","dataType":"number","operationType":"unique_count","sourceField":"ticker","isBucketed":false}
              },
              "columnOrder": ["c1"],
              "incompleteColumns": {}
            }
          }
        }
      },
      "visualization": {"layerId":"L1","layerType":"data","metricAccessor":"c1","color":"#76b900"},
      "filters": [],
      "query": {"language":"kuery","query":""}
    }
  },
  "references": [{"type":"index-pattern","id":"sec-10k-data-view","name":"indexpattern-datasource-layer-L1"}]
}' | python3 -c "import json,sys; print('  ',json.load(sys.stdin).get('id'))"

# ─── 6. Dashboard ──────────────────────────────────────────────────────────
echo "==> dashboard"
curl -sS "${H[@]}" -X POST "$KB/api/saved_objects/dashboard/sec-10k-overview?overwrite=true" -d '{
  "attributes": {
    "title": "SEC 10-K · Indexed corpus overview",
    "description": "What the GPU + Cohere v4 pipeline indexed: 503 S&P 500 latest 10-K filings, chunked, embedded, ready for semantic search and agents.",
    "panelsJSON": "[{\"version\":\"9.4.1\",\"type\":\"lens\",\"gridData\":{\"x\":0,\"y\":0,\"w\":12,\"h\":8,\"i\":\"p1\"},\"panelIndex\":\"p1\",\"embeddableConfig\":{},\"panelRefName\":\"panel_0\"},{\"version\":\"9.4.1\",\"type\":\"lens\",\"gridData\":{\"x\":12,\"y\":0,\"w\":12,\"h\":8,\"i\":\"p2\"},\"panelIndex\":\"p2\",\"embeddableConfig\":{},\"panelRefName\":\"panel_1\"},{\"version\":\"9.4.1\",\"type\":\"lens\",\"gridData\":{\"x\":24,\"y\":0,\"w\":24,\"h\":16,\"i\":\"p3\"},\"panelIndex\":\"p3\",\"embeddableConfig\":{},\"panelRefName\":\"panel_2\"},{\"version\":\"9.4.1\",\"type\":\"lens\",\"gridData\":{\"x\":0,\"y\":8,\"w\":24,\"h\":24,\"i\":\"p4\"},\"panelIndex\":\"p4\",\"embeddableConfig\":{},\"panelRefName\":\"panel_3\"}]",
    "optionsJSON": "{\"hidePanelTitles\":false,\"useMargins\":true,\"syncColors\":false,\"syncCursor\":true,\"syncTooltips\":false}",
    "timeRestore": false,
    "kibanaSavedObjectMeta": {"searchSourceJSON": "{\"query\":{\"query\":\"\",\"language\":\"kuery\"},\"filter\":[]}"}
  },
  "references": [
    {"name":"panel_0","type":"lens","id":"sec-total-chunks"},
    {"name":"panel_1","type":"lens","id":"sec-distinct-tickers"},
    {"name":"panel_2","type":"lens","id":"sec-by-sector"},
    {"name":"panel_3","type":"lens","id":"sec-top-tickers"}
  ]
}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ',d.get('id'),'·',d.get('attributes',{}).get('title'))"

echo
echo "Dashboard:    $KB/app/dashboards#/view/sec-10k-overview"
echo "Discover:     $KB/app/discover#/?_a=(index:sec-10k-data-view)"
echo "Dev Tools:    $KB/app/dev_tools#/console"
