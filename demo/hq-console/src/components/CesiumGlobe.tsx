/**
 * CesiumGlobe Component
 * Renders the 3D globe with regional cluster markers
 */

import React, { useEffect, useRef } from 'react';
import {
  Viewer,
  Cartesian3,
  Color,
  VerticalOrigin,
  Entity,
  Ion,
  HorizontalOrigin,
  ImageryLayer,
  TileMapServiceImageryProvider,
  buildModuleUrl,
} from 'cesium';
import type { Cluster } from '../types';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Cesium Ion token from env (optional). Empty → Cesium's default/offline
// imagery, which is what an airgapped kit wants anyway.
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';

/**
 * Calculate great circle path between two points using Haversine formula
 * Returns array of intermediate points following Earth's curvature
 */
function calculateGreatCirclePath(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  numPoints: number = 50
): Cartesian3[] {
  const points: Cartesian3[] = [];
  const earthRadius = 6371000; // Earth radius in meters

  // Convert to radians
  const lat1 = (startLat * Math.PI) / 180;
  const lon1 = (startLon * Math.PI) / 180;
  const lat2 = (endLat * Math.PI) / 180;
  const lon2 = (endLon * Math.PI) / 180;

  // Calculate the great circle distance using Haversine formula
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  // Calculate arc height based on distance (proportional for visual effect)
  const maxArcHeight = distance * 0.2; // 20% of distance for dramatic arc

  // Generate intermediate points along the great circle
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;

    // Spherical interpolation (slerp) for accurate great circle
    const A = Math.sin((1 - fraction) * c) / Math.sin(c);
    const B = Math.sin(fraction * c) / Math.sin(c);

    const x =
      A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y =
      A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    // Convert back to degrees
    const latDeg = (lat * 180) / Math.PI;
    const lonDeg = (lon * 180) / Math.PI;

    // Add parabolic arc height (highest at midpoint)
    const arcHeight = maxArcHeight * Math.sin(fraction * Math.PI);

    points.push(Cartesian3.fromDegrees(lonDeg, latDeg, arcHeight));
  }

  return points;
}

interface CesiumGlobeProps {
  clusters: Cluster[];
  onClusterClick?: (cluster: Cluster) => void;
  selectedCluster?: string | null;
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  clusters,
  onClusterClick,
  selectedCluster
}) => {
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entitiesRef = useRef<Map<string, Entity>>(new Map());
  const connectionLinesRef = useRef<Entity[]>([]);

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!cesiumContainer.current || viewerRef.current) return;

    const viewer = new Viewer(cesiumContainer.current, {
      // Bundled offline Natural Earth II imagery — no Cesium Ion token, no
      // internet (airgap-friendly). vite-plugin-cesium copies these assets.
      baseLayer: ImageryLayer.fromProviderAsync(
        TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
        {},
      ),
      animation: false,
      baseLayerPicker: false, // picker pulls Ion catalog — off for airgap
      fullscreenButton: true,
      vrButton: false,
      geocoder: false,        // geocoder needs Ion — off for airgap
      homeButton: true,
      infoBox: true,
      sceneModePicker: true, // Enable 2D/3D/Columbus view switching
      selectionIndicator: true,
      timeline: false,
      navigationHelpButton: true, // Enable navigation help
      scene3DOnly: false,
    });

    console.log('Cesium viewer created:', viewer);

    // Set initial camera position to view North America with all clusters visible
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-95.0, 39.0, 7000000),
    });

    viewerRef.current = viewer;

    // Cleanup
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      // Clear entities and connection lines when viewer is destroyed
      entitiesRef.current.clear();
      connectionLinesRef.current = [];
      console.log('Viewer destroyed, entities and connection lines cleared');
    };
  }, []);

  // Update cluster markers
  useEffect(() => {
    if (!viewerRef.current) {
      return;
    }

    const viewer = viewerRef.current;
    const entities = entitiesRef.current;

    console.log('Updating', clusters.length, 'cluster markers');

    // Remove entities for clusters that no longer exist
    const currentClusterIds = new Set(clusters.map(c => c.id));
    for (const [id, entity] of entities) {
      if (!currentClusterIds.has(id)) {
        viewer.entities.remove(entity);
        entities.delete(id);
      }
    }

    // Add or update cluster markers
    clusters.forEach(cluster => {
      const position = Cartesian3.fromDegrees(
        cluster.geo.lon,
        cluster.geo.lat,
        0  // Ground level
      );

      // Determine color based on status
      let color: Color;

      switch (cluster.status) {
        case 'online':
          color = cluster.health?.status === 'green'
            ? Color.GREEN
            : cluster.health?.status === 'yellow'
            ? Color.YELLOW
            : Color.RED;
          break;
        case 'connecting':
          color = Color.ORANGE;
          break;
        case 'offline':
          color = Color.GRAY;
          break;
        default:
          color = Color.WHITE;
      }

      // Use consistent scale for all clusters - small but visible at all zoom levels
      const markerScale = 0.025; // Same size for all clusters including master

      let entity = entities.get(cluster.id);

      if (!entity) {
        // Create new entity with compact Elastic logo
        entity = viewer.entities.add({
          id: cluster.id,
          position,
          billboard: {
            image: '/elastic-logo.png',
            scale: markerScale, // Consistent size for all markers
            color, // tint by status: green online / orange connecting / gray offline
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // Always visible
            sizeInMeters: false, // Size in pixels, not meters (maintains screen size)
          },
          description: createClusterDescription(cluster),
        });

        entities.set(cluster.id, entity);
        console.log(`✓ Created marker for ${cluster.name}`);
      } else {
        // Update existing entity. These are Cesium ConstantProperty instances at
        // runtime (they expose setValue), but the static types are the base
        // Property, so cast to satisfy tsc.
        (entity.position as any)?.setValue(position);
        if (entity.billboard) {
          (entity.billboard.scale as any)?.setValue(markerScale);
          (entity.billboard.color as any)?.setValue(color); // reflect status changes live
        }
        entity.description = createClusterDescription(cluster) as any;
      }
    });
  }, [clusters, selectedCluster]);

  // Draw connection lines from master cluster to all other clusters
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;
    const masterCluster = clusters.find(c => c.id === 'hq');

    // Remove existing connection lines
    connectionLinesRef.current.forEach(line => {
      viewer.entities.remove(line);
    });
    connectionLinesRef.current = [];

    if (!masterCluster) return;

    // Draw a link from HQ to each remote — but only once the remote is live, and
    // tint the arc by its state so the link "lights up" on Synchronise Now.
    clusters.forEach(cluster => {
      if (cluster.id === 'hq') return; // Skip HQ itself
      if (cluster.status === 'offline') return; // no link until it comes online

      const lineColor = cluster.status === 'connecting'
        ? Color.ORANGE.withAlpha(0.8)
        : Color.CYAN.withAlpha(0.8);

      // Calculate great circle path with proper Earth curvature
      const pathPositions = calculateGreatCirclePath(
        masterCluster.geo.lon,
        masterCluster.geo.lat,
        cluster.geo.lon,
        cluster.geo.lat,
        50 // 50 intermediate points for smooth curve
      );

      const line = viewer.entities.add({
        polyline: {
          positions: pathPositions,
          width: 3,
          material: lineColor,
          clampToGround: false,
        },
      });

      connectionLinesRef.current.push(line);
    });

    console.log(`✓ Drew ${connectionLinesRef.current.length} connection lines from master cluster`);
  }, [clusters]);

  // Handle cluster selection from clicking on the globe
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;

    const removeListener = viewer.selectedEntityChanged.addEventListener((entity: Entity | undefined) => {
      if (entity && onClusterClick) {
        const cluster = clusters.find(c => c.id === entity.id);
        if (cluster) {
          onClusterClick(cluster);
        }
      }
    });

    return () => {
      removeListener();
    };
  }, [clusters, onClusterClick]);

  // Handle cluster selection from sidebar - programmatically select entity and fly to it
  useEffect(() => {
    if (!viewerRef.current || !selectedCluster) return;

    const viewer = viewerRef.current;
    const entity = entitiesRef.current.get(selectedCluster);

    if (entity) {
      // Select the entity (shows info box)
      viewer.selectedEntity = entity;

      // Fly camera to the selected cluster
      const cluster = clusters.find(c => c.id === selectedCluster);
      if (cluster) {
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            cluster.geo.lon,
            cluster.geo.lat,
            3000000 // 3000km altitude for good view
          ),
          duration: 2, // 2 second flight
        });
      }
    }
  }, [selectedCluster, clusters]);

  return (
    <div
      ref={cesiumContainer}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}
    />
  );
};


/**
 * Create HTML description for cluster with enhanced styling
 */
function createClusterDescription(cluster: Cluster): string {
  const healthColor = cluster.health?.status === 'green' ? '#52c41a' :
                     cluster.health?.status === 'yellow' ? '#faad14' : '#f5222d';

  // INT type color mapping
  const intTypeColors: Record<string, { bg: string; text: string; icon: string }> = {
    'HUMINT': { bg: '#e6f4ff', text: '#0958d9', icon: '👤' },
    'SIGINT': { bg: '#f0f5ff', text: '#531dab', icon: '📡' },
    'FINTEL': { bg: '#fff7e6', text: '#d46b08', icon: '💰' },
    'IMINT': { bg: '#e6fffb', text: '#006d75', icon: '🛰️' },
    'GEOINT': { bg: '#e6fffb', text: '#006d75', icon: '🗺️' },
    'MASINT': { bg: '#fff0f6', text: '#c41d7f', icon: '📊' },
    'OSINT': { bg: '#f6ffed', text: '#389e0d', icon: '🌐' },
    'CYBER': { bg: '#fcffe6', text: '#7cb305', icon: '💻' },
    'CIP-FUSION': { bg: '#fff1f0', text: '#cf1322', icon: '🎯' }
  };

  const intTypeInfo = cluster.intType ? intTypeColors[cluster.intType] : null;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; min-width: 300px;">
      <div style="border-bottom: 3px solid #00BFB3; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 8px 0; color: #1890ff; font-size: 20px; font-weight: 600;">${cluster.name}</h2>
        <div style="display: flex; gap: 12px; font-size: 13px; flex-wrap: wrap;">
          ${intTypeInfo ? `
          <span style="background: ${intTypeInfo.bg}; padding: 4px 12px; border-radius: 12px; color: ${intTypeInfo.text}; font-weight: 700; font-size: 14px; border: 2px solid ${intTypeInfo.text};">
            ${intTypeInfo.icon} ${cluster.intType}
          </span>
          ` : ''}
          <span style="background: #f0f0f0; padding: 4px 12px; border-radius: 12px; color: #595959;">
            📍 ${cluster.geo.regionName || cluster.region}
          </span>
          <span style="background: ${cluster.type === 'cloud' ? '#e6f7ff' : '#f6ffed'}; padding: 4px 12px; border-radius: 12px; color: ${cluster.type === 'cloud' ? '#0050b3' : '#237804'}; font-weight: 500;">
            ${cluster.type === 'cloud' ? '☁️ Elastic Cloud' : '⚙️ ECK Self-Managed'}
          </span>
        </div>
      </div>

      ${cluster.health ? `
        <div style="background: linear-gradient(135deg, #f6ffed 0%, #ffffff 100%); padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${healthColor};">
          <h3 style="margin: 0 0 8px 0; color: #262626; font-size: 14px; font-weight: 600;">Cluster Health</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <div>
              <span style="color: #8c8c8c;">Status:</span>
              <strong style="color: ${healthColor}; text-transform: uppercase; margin-left: 4px;">${cluster.health.status}</strong>
            </div>
            <div>
              <span style="color: #8c8c8c;">Nodes:</span>
              <strong style="color: #262626; margin-left: 4px;">${cluster.health.numberOfNodes}</strong>
            </div>
            <div>
              <span style="color: #8c8c8c;">Active Shards:</span>
              <strong style="color: #262626; margin-left: 4px;">${cluster.health.activeShards}</strong>
            </div>
            <div>
              <span style="color: #8c8c8c;">Unassigned:</span>
              <strong style="color: ${cluster.health.unassignedShards > 0 ? '#faad14' : '#52c41a'}; margin-left: 4px;">${cluster.health.unassignedShards}</strong>
            </div>
          </div>
        </div>
      ` : ''}

      ${cluster.stats ? `
        <div style="background: linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%); padding: 12px; border-radius: 8px; border-left: 4px solid #1890ff; margin-bottom: 12px;">
          <h3 style="margin: 0 0 8px 0; color: #262626; font-size: 14px; font-weight: 600;">Statistics</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
            <div>
              <span style="color: #8c8c8c;">Indices:</span>
              <strong style="color: #262626; margin-left: 4px;">${cluster.stats.indices.count}</strong>
            </div>
            <div>
              <span style="color: #8c8c8c;">Documents:</span>
              <strong style="color: #262626; margin-left: 4px;">${cluster.stats.indices.docs.count.toLocaleString()}</strong>
            </div>
            <div style="grid-column: 1 / -1;">
              <span style="color: #8c8c8c;">Storage:</span>
              <strong style="color: #1890ff; margin-left: 4px;">${formatBytes(cluster.stats.indices.store.sizeInBytes)}</strong>
            </div>
          </div>
        </div>
      ` : ''}

      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <a href="${cluster.endpoint === 'demo' ? '#' : `${cluster.endpoint}/app/dashboards`}"
           target="_blank"
           rel="noopener noreferrer"
           style="flex: 1; background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%); color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; text-align: center; font-weight: 500; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;"
           onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)';"
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)';">
          📊 View Kibana Dashboard
        </a>
      </div>

      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #8c8c8c; text-align: center;">
        Cluster ID: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', 'Courier', monospace;">${cluster.id}</code>
      </div>
    </div>
  `;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export default CesiumGlobe;
