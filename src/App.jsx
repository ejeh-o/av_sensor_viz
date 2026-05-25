import React, { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  Activity,
  Bike,
  Camera,
  Car,
  CircleDot,
  Gauge,
  Layers3,
  PanelRightClose,
  PanelRightOpen,
  Radar,
  Route,
  RotateCcw,
  Satellite,
  ShieldAlert,
  Waves,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AVScene } from './components/AVScene.jsx';

const SENSOR_CONFIG = {
  camera: {
    label: 'Camera',
    icon: Camera,
    color: '#38bdf8',
    range: '120 m',
    strength: 'Classifies lanes, signs, lights, vehicles, people, and scene context.',
    limitation: 'Sensitive to glare, darkness, heavy rain, fog, and occlusion.',
  },
  lidar: {
    label: 'Lidar',
    icon: CircleDot,
    color: '#22c55e',
    range: '80 m',
    strength: 'Builds 3D geometry, depth, free space, and object contours.',
    limitation: 'Higher cost and can degrade in severe precipitation or dirty housings.',
  },
  radar: {
    label: 'Radar',
    icon: Radar,
    color: '#f59e0b',
    range: '180 m',
    strength: 'Measures distance and relative speed, even through dust, fog, and rain.',
    limitation: 'Lower spatial detail than camera or lidar.',
  },
  ultrasonic: {
    label: 'Ultrasonic',
    icon: Waves,
    color: '#a855f7',
    range: '5 m',
    strength: 'Detects nearby curbs, parked cars, and obstacles during parking.',
    limitation: 'Short range and mostly useful at low speed.',
  },
};

const OBJECTS = [
  { label: 'Lead car', icon: Car, type: 'Vehicle', position: '32 m ahead', seenBy: ['camera', 'lidar', 'radar'] },
  { label: 'Pedestrian', icon: Activity, type: 'Vulnerable road user', position: 'Crosswalk right', seenBy: ['camera', 'lidar'] },
  { label: 'Cyclist', icon: Bike, type: 'Vulnerable road user', position: 'Adjacent lane', seenBy: ['camera', 'lidar', 'radar'] },
  { label: 'Traffic cone', icon: Satellite, type: 'Obstacle', position: 'Near shoulder', seenBy: ['camera', 'lidar', 'ultrasonic'] },
];

const SENSOR_OBSERVATIONS = {
  camera: {
    title: 'Visual labels',
    summary: 'Labels traffic light, lane lines, pedestrian, cyclist, and vehicles.',
    detects: ['Traffic light', 'Lane lines', 'Pedestrian'],
  },
  lidar: {
    title: '3D shape outlines',
    summary: 'Wraps nearby actors with depth-aware object contours and geometry bounds.',
    detects: ['Vehicle boxes', 'Cyclist volume', 'Pedestrian volume'],
  },
  radar: {
    title: 'Motion readout',
    summary: 'Projects long-range returns with relative speed vectors for moving objects.',
    detects: ['Lead car -12 mph', 'Cyclist +4 mph', 'Long-range arcs'],
  },
  ultrasonic: {
    title: 'Close-range warnings',
    summary: 'Highlights curb, cone, and parking-distance risks close to the ego vehicle.',
    detects: ['Cone warning', 'Curb proximity', 'Parking bubble'],
  },
};

const FUSION_TRACKS = [
  {
    label: 'Lead car',
    confidence: '98%',
    risk: 'Medium',
    summary: 'Camera classifies the vehicle, lidar confirms 3D extent, and radar estimates closing speed.',
    sources: ['Camera', 'Lidar', 'Radar'],
  },
  {
    label: 'Pedestrian',
    confidence: '94%',
    risk: 'High',
    summary: 'Camera identifies the person and lidar places them at the crosswalk edge.',
    sources: ['Camera', 'Lidar'],
  },
  {
    label: 'Cyclist',
    confidence: '91%',
    risk: 'Medium',
    summary: 'Camera labels the cyclist, lidar bounds the shape, and radar adds relative motion.',
    sources: ['Camera', 'Lidar', 'Radar'],
  },
  {
    label: 'Traffic cone',
    confidence: '87%',
    risk: 'Low',
    summary: 'Camera recognizes the cone while lidar and ultrasonic confirm close obstacle geometry.',
    sources: ['Camera', 'Lidar', 'Ultrasonic'],
  },
];

const SCENARIOS = [
  {
    id: 'highway-underpass',
    label: 'Highway underpass',
    icon: Route,
    factor: 'Grade-separated roadway',
    summary: 'The ego AV approaches an underpass where overhead road geometry can create occlusion, shadow, and localization cues.',
    conditions: ['Overhead one-way road', 'Lane markings', 'No traffic on top'],
  },
];

function App() {
  const [activeSensors, setActiveSensors] = useState({
    camera: true,
    lidar: true,
    radar: false,
    ultrasonic: false,
  });
  const [fusionView, setFusionView] = useState(false);
  const [selectedObject, setSelectedObject] = useState('Lead car');
  const [emptyBannerDismissed, setEmptyBannerDismissed] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState('sensors');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('highway-underpass');

  const enabledSensors = useMemo(
    () => Object.entries(activeSensors).filter(([, enabled]) => enabled).map(([key]) => key),
    [activeSensors],
  );

  const selectedObjectData = OBJECTS.find((item) => item.label === selectedObject) ?? OBJECTS[0];
  const selectedScenarioData = SCENARIOS.find((item) => item.id === selectedScenario) ?? SCENARIOS[0];
  const scenarioEnabled = Boolean(selectedScenario);
  const showEmptyBanner = enabledSensors.length === 0 && !fusionView && !emptyBannerDismissed;

  function toggleSensor(sensor) {
    setActiveSensors((current) => ({ ...current, [sensor]: !current[sensor] }));
    setFusionView(false);
  }

  function enableAll() {
    setActiveSensors({ camera: true, lidar: true, radar: true, ultrasonic: true });
    setFusionView(false);
    setEmptyBannerDismissed(false);
  }

  function enableFusion() {
    setActiveSensors({ camera: true, lidar: true, radar: true, ultrasonic: true });
    setFusionView(true);
    setEmptyBannerDismissed(false);
  }

  function resetView() {
    setActiveSensors({ camera: false, lidar: false, radar: false, ultrasonic: false });
    setFusionView(false);
    setSelectedObject('Lead car');
    setEmptyBannerDismissed(false);
  }

  return (
    <main className={`app-shell ${panelCollapsed ? 'panel-collapsed' : ''}`}>
      <section className="scene-region" aria-label="Interactive autonomous vehicle sensor scene">
        <div className="scene-topbar">
          <div>
            <h1>AV Sensor Visualization</h1>
          </div>
          <div className="view-actions">
            <button type="button" onClick={enableAll}>
              <Layers3 size={18} />
              All sensors
            </button>
            <button type="button" className={fusionView ? 'active' : ''} onClick={enableFusion}>
              <Satellite size={18} />
              Fusion
            </button>
            <button type="button" aria-label="Reset visualization" onClick={resetView}>
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showEmptyBanner && (
            <motion.div
              className="empty-state-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <span>Click sensors in the panel to see visualization.</span>
              <button type="button" aria-label="Dismiss empty state hint" onClick={() => setEmptyBannerDismissed(true)}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
          <PerspectiveCamera makeDefault position={[8.5, 8, 10.5]} fov={46} />
          <ambientLight intensity={0.6} />
          <directionalLight
            castShadow
            position={[6, 12, 7]}
            intensity={1.2}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <Suspense fallback={null}>
            <AVScene
              activeSensors={activeSensors}
              fusionView={fusionView}
              selectedObject={selectedObject}
              selectedScenario={selectedScenario}
            />
            <Environment preset="city" />
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={7}
            maxDistance={18}
            minPolarAngle={0.45}
            maxPolarAngle={1.24}
          />
        </Canvas>

        <div className={`scene-legend ${fusionView ? 'fusion' : ''}`}>
          {fusionView ? (
            <span>Fused perception</span>
          ) : enabledSensors.length === 0 ? (
            <span>No sensors active</span>
          ) : (
            enabledSensors.map((sensor) => (
              <span key={sensor} style={{ '--sensor-color': SENSOR_CONFIG[sensor].color }}>
                {SENSOR_CONFIG[sensor].label}
              </span>
            ))
          )}
        </div>
      </section>

      <aside className="control-panel" aria-label="Visualization controls">
        <button
          type="button"
          className="panel-collapse-button"
          aria-label={panelCollapsed ? 'Expand control panel' : 'Collapse control panel'}
          onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
        >
          {panelCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
        </button>

        {!panelCollapsed && (
          <>
            <div className="panel-tabs" role="tablist" aria-label="Control panel sections">
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === 'sensors'}
                className={activePanelTab === 'sensors' ? 'active' : ''}
                onClick={() => setActivePanelTab('sensors')}
              >
                <Layers3 size={17} />
                Sensor Stack
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanelTab === 'scenarios'}
                className={activePanelTab === 'scenarios' ? 'active' : ''}
                onClick={() => setActivePanelTab('scenarios')}
              >
                <Route size={17} />
                Scenarios
              </button>
            </div>

            {activePanelTab === 'sensors' ? (
              <div role="tabpanel" aria-label="Sensor Stack">
                <div className="panel-section">
                  <div className="section-title">
                    <span>Sensor Stack</span>
                    <span>{fusionView ? 'Fusion mode' : `${enabledSensors.length}/4 active`}</span>
                  </div>
                  {fusionView && (
                    <div className="fusion-mode-card">
                      <Satellite size={19} />
                      <span>
                        <strong>Fused perception</strong>
                        <small>Combines all active sensor evidence into tracked objects, object confidence, and path risk.</small>
                      </span>
                    </div>
                  )}
                  <div className="sensor-list">
                    {Object.entries(SENSOR_CONFIG).map(([key, sensor]) => {
                      const Icon = sensor.icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sensor-toggle ${activeSensors[key] ? 'enabled' : ''}`}
                          onClick={() => toggleSensor(key)}
                          style={{ '--sensor-color': sensor.color }}
                        >
                          <Icon size={20} />
                          <span>
                            <strong>{sensor.label}</strong>
                            <small>{sensor.range}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>{fusionView ? 'Fusion Interpretation' : 'What Active Sensors See'}</span>
                    <span>
                      {fusionView
                        ? `${FUSION_TRACKS.length} tracks`
                        : enabledSensors.length === 0
                          ? 'No readout'
                          : `${enabledSensors.length} layer${enabledSensors.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {fusionView ? (
                    <div className="fusion-track-list">
                      {FUSION_TRACKS.map((track) => (
                        <article key={track.label} className={`fusion-track risk-${track.risk.toLowerCase()}`}>
                          <div className="fusion-track-head">
                            <Gauge size={18} />
                            <span>
                              <strong>{track.label}</strong>
                              <small>{track.confidence} object confidence</small>
                            </span>
                            <em>{track.risk}</em>
                          </div>
                          <p>{track.summary}</p>
                          <div className="readout-chips">
                            {track.sources.map((source) => (
                              <span key={source}>{source}</span>
                            ))}
                          </div>
                        </article>
                      ))}
                      <article className="fusion-path-card">
                        <strong>Path risk overlay</strong>
                        <p>Yellow is the ego AV's planned path corridor. Red marks the part of that path with elevated conflict risk based on fused tracks nearby.</p>
                        <div className="path-key">
                          <span className="planned">Planned path</span>
                          <span className="risk">Conflict risk</span>
                        </div>
                      </article>
                    </div>
                  ) : (
                    <div className="readout-list">
                      {Object.entries(SENSOR_OBSERVATIONS).map(([key, observation]) => {
                        const sensor = SENSOR_CONFIG[key];
                        const Icon = sensor.icon;
                        const enabled = activeSensors[key];
                        return (
                          <article
                            key={key}
                            className={`readout-card ${enabled ? 'enabled' : ''}`}
                            style={{ '--sensor-color': sensor.color }}
                          >
                            <div className="readout-heading">
                              <Icon size={18} />
                              <span>
                                <strong>{sensor.label}</strong>
                                <small>{observation.title}</small>
                              </span>
                            </div>
                            <p>{enabled ? observation.summary : `Toggle ${sensor.label} to show this layer in the scene.`}</p>
                            <div className="readout-chips">
                              {observation.detects.map((item) => (
                                <span key={item}>{item}</span>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>Object Inspector</span>
                    <span>{selectedObjectData.type}</span>
                  </div>
                  <div className="object-grid">
                    {OBJECTS.map((object) => {
                      const Icon = object.icon;
                      return (
                        <button
                          type="button"
                          key={object.label}
                          className={object.label === selectedObject ? 'selected' : ''}
                          onClick={() => setSelectedObject(object.label)}
                        >
                          <Icon size={18} />
                          <span>{object.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedObjectData.label}-${enabledSensors.join('-')}`}
                      className="object-detail"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                    >
                      <h2>{selectedObjectData.label}</h2>
                      <p>{selectedObjectData.position}</p>
                      {fusionView && (
                        <div className="fusion-object-note">
                          <ShieldAlert size={15} />
                          <span>
                            {FUSION_TRACKS.find((track) => track.label === selectedObjectData.label)?.risk ?? 'Low'} risk after sensor fusion
                          </span>
                        </div>
                      )}
                      <div className="seen-by">
                        {selectedObjectData.seenBy.map((sensor) => {
                          const enabled = activeSensors[sensor];
                          return (
                            <span
                              key={sensor}
                              className={enabled ? 'enabled' : ''}
                              style={{ '--sensor-color': SENSOR_CONFIG[sensor].color }}
                            >
                              {SENSOR_CONFIG[sensor].label}
                            </span>
                          );
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>Sensor Notes</span>
                    <span>{fusionView ? 'Fusion view' : 'Single layers'}</span>
                  </div>
                  <div className="notes-list">
                    {Object.entries(SENSOR_CONFIG).map(([key, sensor]) => (
                      <article key={key} className={activeSensors[key] ? 'active' : ''}>
                        <strong style={{ '--sensor-color': sensor.color }}>{sensor.label}</strong>
                        <p>{sensor.strength}</p>
                        <small>{sensor.limitation}</small>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div role="tabpanel" aria-label="Scenarios">
                <div className="panel-section">
                  <div className="section-title">
                    <span>Scenarios</span>
                    <span>{SCENARIOS.length} simulations</span>
                  </div>
                  <div className="scenario-list">
                    {SCENARIOS.map((scenario) => {
                      const Icon = scenario.icon;
                      const selected = selectedScenario === scenario.id;
                      return (
                        <button
                          key={scenario.id}
                          type="button"
                          className={`scenario-card ${selected ? 'selected' : ''}`}
                          onClick={() => setSelectedScenario((current) => (current === scenario.id ? null : scenario.id))}
                        >
                          <span className="scenario-icon">
                            <Icon size={20} />
                          </span>
                          <span className="scenario-copy">
                            <span className="scenario-card-head">
                              <strong>{scenario.label}</strong>
                              <em>{selected ? 'Enabled' : 'Off'}</em>
                            </span>
                            <small>{scenario.factor}</small>
                            <p>{scenario.summary}</p>
                            <span className="scenario-tags">
                              {scenario.conditions.map((condition) => (
                                <em key={condition}>{condition}</em>
                              ))}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>Active Scenario</span>
                    <span>{scenarioEnabled ? selectedScenarioData.factor : 'Disabled'}</span>
                  </div>
                  <article className={`scenario-detail ${scenarioEnabled ? 'enabled' : ''}`}>
                    <strong>{scenarioEnabled ? selectedScenarioData.label : 'No scenario enabled'}</strong>
                    <p>
                      {scenarioEnabled
                        ? selectedScenarioData.summary
                        : 'Enable Highway underpass to add the elevated one-way road back into the scene.'}
                    </p>
                    <div className="readout-chips">
                      {scenarioEnabled ? (
                        selectedScenarioData.conditions.map((condition) => <span key={condition}>{condition}</span>)
                      ) : (
                        <span>Scenario hidden</span>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            )}
          </>
        )}
      </aside>
    </main>
  );
}

export default App;
