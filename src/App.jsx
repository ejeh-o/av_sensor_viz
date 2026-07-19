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
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Radar,
  Route,
  RotateCcw,
  Satellite,
  ShieldAlert,
  Snowflake,
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

const NIGHT_SENSOR_IMPACTS = {
  camera: {
    status: 'Reduced',
    summary: 'Lower exposure and contrast make lane markings, traffic-light state, pedestrians, and cone color classification less certain outside lit areas.',
  },
  lidar: {
    status: 'Stable',
    summary: 'Depth returns remain usable because lidar is active illumination, though dark or low-reflectivity surfaces can still reduce return strength.',
  },
  radar: {
    status: 'Strong',
    summary: 'Range and relative-speed estimates are largely unchanged, making radar more important for long-range motion cues at night.',
  },
  ultrasonic: {
    status: 'Stable',
    summary: 'Close-range parking and curb sensing are mostly unaffected by darkness, but they still only cover very short distances.',
  },
};

const SNOW_SENSOR_IMPACTS = {
  camera: {
    status: 'Reduced',
    summary: 'Snow lowers contrast, can partially cover lane markings, and makes camera classification less stable around small objects and pedestrians.',
  },
  lidar: {
    status: 'Reduced',
    summary: 'Falling and accumulated snow add extra returns and can soften object edges, so lidar geometry remains useful but noisier.',
  },
  radar: {
    status: 'Stable',
    summary: 'Radar remains comparatively resilient in snow and keeps long-range speed/range evidence for vehicles and cyclists.',
  },
  ultrasonic: {
    status: 'Reduced',
    summary: 'Packed snow near curbs and sensors can distort very close-range readings, especially around low obstacles.',
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

const FUSION_SCENARIO_IMPACTS = {
  'night-mode': {
    label: 'Night mode',
    panelSummary: 'Fusion down-weights camera-only classification in dim regions and relies more on radar motion plus lidar geometry.',
    pathSummary: 'Night mode expands the conflict corridor near crosswalk actors because visual classification confidence is lower outside headlamp and traffic-light illumination.',
    tracks: {
      'Lead car': {
        confidence: '96%',
        summary: 'Camera classification is less certain in low light, while lidar confirms vehicle extent and radar keeps the closing-speed estimate stable.',
      },
      Pedestrian: {
        confidence: '88%',
        risk: 'High',
        summary: 'The pedestrian remains high risk, but fusion relies more heavily on lidar placement because camera contrast is reduced near the crosswalk edge.',
      },
      Cyclist: {
        confidence: '89%',
        summary: 'Cyclist classification loses visual margin at night, with lidar bounds and radar relative motion carrying more of the fused track.',
      },
      'Traffic cone': {
        confidence: '78%',
        risk: 'Medium',
        summary: 'Cone color and class recognition degrade in low light, so lidar shape and ultrasonic proximity raise the obstacle from low to medium risk.',
      },
    },
  },
  snow: {
    label: 'Snow',
    panelSummary: 'Fusion treats camera and lidar evidence as noisier, leans more on radar for moving actors, and raises caution around lane boundaries and low obstacles.',
    pathSummary: 'Snow widens the uncertainty around the planned path because lane markings and curb edges are partially masked.',
    tracks: {
      'Lead car': {
        confidence: '94%',
        summary: 'Snow reduces visual clarity and adds lidar noise, while radar preserves range and closing-speed evidence for the lead vehicle.',
      },
      Pedestrian: {
        confidence: '86%',
        risk: 'High',
        summary: 'Pedestrian tracking remains high risk because snow reduces camera contrast and can soften lidar body contours near the crosswalk.',
      },
      Cyclist: {
        confidence: '86%',
        risk: 'High',
        summary: 'Cyclist fusion shifts toward radar motion and lidar geometry, but snow lowers classification confidence and raises path-conflict risk.',
      },
      'Traffic cone': {
        confidence: '72%',
        risk: 'Medium',
        summary: 'Snow can partially cover the cone and curb area, so fusion relies on lidar shape plus ultrasonic proximity with lower object confidence.',
      },
    },
  },
  'highway-underpass': {
    label: 'Highway underpass',
    panelSummary: 'Underpass geometry adds occlusion and localization context to fusion, but the currently tracked objects keep their baseline confidence.',
    pathSummary: 'Underpass mode keeps object tracks unchanged here, while fusion treats the overhead structure as a roadway-context cue for shadows and possible occlusion.',
    tracks: {},
  },
};

const FUSION_COMBINATION_IMPACTS = [
  {
    ids: ['night-mode', 'snow'],
    label: 'Night mode + Snow',
    panelSummary: 'Night and snow compound each other: camera contrast drops further, lidar sees noisier edges, and fusion leans hardest on radar for moving actors.',
    pathSummary: 'Night plus snow widens the conflict corridor more than either scenario alone because lane markings, curbs, and actor silhouettes are all less distinct.',
    tracks: {
      'Lead car': {
        confidence: '91%',
        summary: 'Low light and snow both reduce visual classification, while snow adds lidar edge noise; radar becomes the most stable cue for the lead car.',
      },
      Pedestrian: {
        confidence: '80%',
        risk: 'High',
        summary: 'The pedestrian remains high risk with substantially lower confidence because low-light contrast and snowy crosswalk edges both weaken visual confirmation.',
      },
      Cyclist: {
        confidence: '81%',
        risk: 'High',
        summary: 'Cyclist fusion is high risk because low light reduces classification margin and snow makes geometry boundaries less clean, despite useful radar motion.',
      },
      'Traffic cone': {
        confidence: '64%',
        risk: 'High',
        summary: 'The cone becomes high risk because snow can cover the low obstacle and night mode reduces color/class evidence, leaving short-range geometry as the main cue.',
      },
    },
  },
  {
    ids: ['highway-underpass', 'night-mode'],
    label: 'Underpass + Night mode',
    panelSummary: 'The underpass adds shadow and occlusion context to the night model, so fusion treats the upcoming corridor as less visually certain.',
    pathSummary: 'Underpass plus night emphasizes path-level uncertainty under the overhead structure, but the currently visible object tracks keep the night-mode object adjustments.',
    tracks: {},
  },
  {
    ids: ['highway-underpass', 'snow'],
    label: 'Underpass + Snow',
    panelSummary: 'Underpass geometry and snow combine at the road-context level: fusion expects masked lane edges, snow banks near supports, and less reliable curb detail.',
    pathSummary: 'Underpass plus snow increases lane-edge uncertainty near the overhead roadway without directly changing every visible object track.',
    tracks: {},
  },
  {
    ids: ['highway-underpass', 'night-mode', 'snow'],
    label: 'Underpass + Night mode + Snow',
    panelSummary: 'All active scenarios combine into a worst-visibility corridor: fusion down-weights camera evidence, treats lidar edges as noisy, and relies on radar motion where available.',
    pathSummary: 'The full stack produces the widest path uncertainty because snow masks lane boundaries, night lowers visual contrast, and the underpass adds shadow and occlusion context.',
    tracks: {
      'Lead car': {
        confidence: '90%',
        summary: 'The lead car remains trackable, but confidence is limited by low light, snowy lidar edges, and underpass shadow context; radar carries the closing-speed estimate.',
      },
      Pedestrian: {
        confidence: '78%',
        risk: 'High',
        summary: 'The pedestrian is high risk with the lowest confidence because snowy crosswalk markings, night contrast, and underpass shadow context all reduce visual certainty.',
      },
      Cyclist: {
        confidence: '79%',
        risk: 'High',
        summary: 'The cyclist is high risk because radar motion helps, but the combined scene reduces camera classification and geometry confidence.',
      },
      'Traffic cone': {
        confidence: '60%',
        risk: 'High',
        summary: 'The cone has low fused confidence because it is small, snow can obscure it, night reduces color evidence, and underpass context adds road-edge uncertainty.',
      },
    },
  },
];

function hasEveryScenario(activeScenarios, scenarioIds) {
  return scenarioIds.every((scenarioId) => activeScenarios.includes(scenarioId));
}

function getFusionImpacts(activeScenarios) {
  const singleImpacts = SCENARIOS.filter((scenario) => activeScenarios.includes(scenario.id))
    .map((scenario) => FUSION_SCENARIO_IMPACTS[scenario.id])
    .filter(Boolean);
  const combinationImpacts = FUSION_COMBINATION_IMPACTS
    .filter((impact) => hasEveryScenario(activeScenarios, impact.ids))
    .sort((first, second) => first.ids.length - second.ids.length);

  return [...singleImpacts, ...combinationImpacts];
}

const SCENARIOS = [
  {
    id: 'highway-underpass',
    label: 'Highway underpass',
    icon: Route,
    factor: 'Grade-separated roadway',
    summary: 'The ego AV approaches an underpass where overhead road geometry can create occlusion, shadow, and localization cues.',
    conditions: ['Overhead one-way road', 'Lane markings', 'No traffic on top'],
  },
  {
    id: 'night-mode',
    label: 'Night mode',
    icon: Moon,
    factor: 'Low-light operation',
    summary: 'The scene shifts to nighttime with headlamps and dim ambient light so users can still inspect the environment while seeing low-light perception effects.',
    conditions: ['Reduced camera contrast', 'Headlamp-lit road', 'Radar gains relative value'],
  },
  {
    id: 'snow',
    label: 'Snow',
    icon: Snowflake,
    factor: 'Winter road surface',
    summary: 'Static snow cover and suspended flakes slightly dim the scene while reducing visual contrast, lane clarity, and some short-range sensing reliability.',
    conditions: ['Muted visibility', 'Snow-covered shoulders', 'No moving particles'],
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
  const [activeScenarios, setActiveScenarios] = useState(['highway-underpass']);

  const enabledSensors = useMemo(
    () => Object.entries(activeSensors).filter(([, enabled]) => enabled).map(([key]) => key),
    [activeSensors],
  );
  const activeScenarioData = useMemo(
    () => SCENARIOS.filter((scenario) => activeScenarios.includes(scenario.id)),
    [activeScenarios],
  );
  const fusionScenarioImpacts = useMemo(() => getFusionImpacts(activeScenarios), [activeScenarios]);
  const fusionTracks = useMemo(
    () =>
      FUSION_TRACKS.map((track) =>
        fusionScenarioImpacts.reduce(
          (current, impact) => ({
            ...current,
            ...(impact.tracks[current.label] ?? {}),
            scenarioNotes: impact.tracks[current.label]
              ? [...(current.scenarioNotes ?? []), impact.label]
              : (current.scenarioNotes ?? []),
          }),
          { ...track, scenarioNotes: [] },
        ),
      ),
    [fusionScenarioImpacts],
  );

  const selectedObjectData = OBJECTS.find((item) => item.label === selectedObject) ?? OBJECTS[0];
  const scenarioEnabled = activeScenarios.length > 0;
  const nightModeEnabled = activeScenarios.includes('night-mode');
  const snowEnabled = activeScenarios.includes('snow');
  const showEmptyBanner = enabledSensors.length === 0 && !fusionView && !emptyBannerDismissed;
  const sensorScenarioImpacts = {
    camera: [
      ...(nightModeEnabled ? [NIGHT_SENSOR_IMPACTS.camera] : []),
      ...(snowEnabled ? [SNOW_SENSOR_IMPACTS.camera] : []),
    ],
    lidar: [
      ...(nightModeEnabled ? [NIGHT_SENSOR_IMPACTS.lidar] : []),
      ...(snowEnabled ? [SNOW_SENSOR_IMPACTS.lidar] : []),
    ],
    radar: [
      ...(nightModeEnabled ? [NIGHT_SENSOR_IMPACTS.radar] : []),
      ...(snowEnabled ? [SNOW_SENSOR_IMPACTS.radar] : []),
    ],
    ultrasonic: [
      ...(nightModeEnabled ? [NIGHT_SENSOR_IMPACTS.ultrasonic] : []),
      ...(snowEnabled ? [SNOW_SENSOR_IMPACTS.ultrasonic] : []),
    ],
  };

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

  function toggleScenario(scenarioId) {
    setActiveScenarios((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    );
  }

  return (
    <main className={`app-shell ${panelCollapsed ? 'panel-collapsed' : ''} ${nightModeEnabled ? 'night-mode' : ''} ${snowEnabled ? 'snow-mode' : ''}`}>
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
          <color attach="background" args={[nightModeEnabled ? '#101827' : snowEnabled ? '#dce4eb' : '#f6f8f3']} />
          <fog
            attach="fog"
            args={[
              nightModeEnabled ? '#111827' : snowEnabled ? '#dce4eb' : '#f6f8f3',
              nightModeEnabled ? (snowEnabled ? 10 : 13) : snowEnabled ? 17 : 26,
              nightModeEnabled ? (snowEnabled ? 24 : 28) : snowEnabled ? 32 : 42,
            ]}
          />
          <ambientLight intensity={nightModeEnabled ? (snowEnabled ? 0.18 : 0.23) : snowEnabled ? 0.5 : 0.6} />
          <directionalLight
            castShadow
            position={[6, 12, 7]}
            intensity={nightModeEnabled ? (snowEnabled ? 0.22 : 0.28) : snowEnabled ? 0.86 : 1.2}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <Suspense fallback={null}>
            <AVScene
              activeSensors={activeSensors}
              fusionView={fusionView}
              selectedObject={selectedObject}
              activeScenarios={activeScenarios}
              fusionTracks={fusionTracks}
              snowEnabled={snowEnabled}
            />
            {!nightModeEnabled && <Environment preset="city" />}
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
                        ? `${fusionTracks.length} tracks`
                        : enabledSensors.length === 0
                          ? 'No readout'
                          : `${enabledSensors.length} layer${enabledSensors.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {fusionView ? (
                    <div className="fusion-track-list">
                      {fusionScenarioImpacts.length > 0 && (
                        <article className="fusion-scenario-card">
                          <strong>Scenario-adjusted fusion</strong>
                          {fusionScenarioImpacts.map((impact) => (
                            <p key={impact.label}>{impact.panelSummary}</p>
                          ))}
                        </article>
                      )}
                      {fusionTracks.map((track) => (
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
                            {track.scenarioNotes.map((note) => (
                              <span key={note}>{note} adjusted</span>
                            ))}
                          </div>
                        </article>
                      ))}
                      <article className="fusion-path-card">
                        <strong>Path risk overlay</strong>
                        <p>Yellow is the ego AV's planned path corridor. Red marks the part of that path with elevated conflict risk based on fused tracks nearby.</p>
                        {fusionScenarioImpacts.map((impact) => (
                          <p key={impact.label}>{impact.pathSummary}</p>
                        ))}
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
                            {fusionTracks.find((track) => track.label === selectedObjectData.label)?.risk ?? 'Low'} risk after sensor fusion
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
                    <span>{activeScenarios.length}/{SCENARIOS.length} active</span>
                  </div>
                  <div className="scenario-list">
                    {SCENARIOS.map((scenario) => {
                      const Icon = scenario.icon;
                      const selected = activeScenarios.includes(scenario.id);
                      return (
                        <button
                          key={scenario.id}
                          type="button"
                          className={`scenario-card ${selected ? 'selected' : ''}`}
                          onClick={() => toggleScenario(scenario.id)}
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
                    <span>Active Scenarios</span>
                    <span>{scenarioEnabled ? 'Stacked effects' : 'Disabled'}</span>
                  </div>
                  <article className={`scenario-detail ${scenarioEnabled ? 'enabled' : ''}`}>
                    <strong>{scenarioEnabled ? activeScenarioData.map((scenario) => scenario.label).join(' + ') : 'No scenario enabled'}</strong>
                    <p>
                      {scenarioEnabled
                        ? 'Enabled scenarios stack in the same scene, so geometry, lighting, sensor readouts, and situational risk are evaluated together.'
                        : 'Enable one or more scenarios to add their conditions back into the scene.'}
                    </p>
                    <div className="readout-chips">
                      {scenarioEnabled ? (
                        activeScenarioData.flatMap((scenario) => scenario.conditions).map((condition) => <span key={condition}>{condition}</span>)
                      ) : (
                        <span>Scenario hidden</span>
                      )}
                    </div>
                  </article>
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>Sensor Impact</span>
                    <span>{nightModeEnabled || snowEnabled ? 'Scenario adjusted' : 'Nominal'}</span>
                  </div>
                  <div className="impact-list">
                    {Object.entries(SENSOR_CONFIG).map(([key, sensor]) => {
                      const impacts = sensorScenarioImpacts[key];
                      const status = impacts.length > 0 ? impacts.map((impact) => impact.status).join(' / ') : 'Nominal';
                      return (
                        <article key={key} className={activeSensors[key] ? 'active' : ''} style={{ '--sensor-color': sensor.color }}>
                          <strong>{sensor.label}</strong>
                          <em>{status}</em>
                          {impacts.length > 0 ? (
                            impacts.map((impact) => <p key={impact.summary}>{impact.summary}</p>)
                          ) : (
                            <p>{sensor.label} behavior follows the baseline daytime model.</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="panel-section">
                  <div className="section-title">
                    <span>Situational Impact</span>
                    <span>{scenarioEnabled ? `${activeScenarios.length} active` : 'None'}</span>
                  </div>
                  <article className={`scenario-detail ${nightModeEnabled ? 'enabled' : ''}`}>
                    <strong>
                      {nightModeEnabled && snowEnabled
                        ? 'Low light plus snow increases uncertainty'
                        : snowEnabled
                          ? 'Muted visibility and winter road edges'
                          : nightModeEnabled
                            ? 'Lower visual certainty, higher reliance on fusion'
                            : 'Baseline visibility'}
                    </strong>
                    <p>
                      {nightModeEnabled && snowEnabled
                        ? 'Stacked night and snow reduce camera contrast, add lidar uncertainty, and make fusion depend more on radar motion while keeping lidar geometry for crosswalk actors and road edges.'
                        : snowEnabled
                          ? 'Snow slightly dims the scene and masks road-edge detail. Fusion should treat lane markings, curbs, and small obstacles as less certain while using radar to preserve moving-object confidence.'
                          : nightModeEnabled
                            ? 'Night mode keeps a dim scene light and ego headlamps visible, but the AV should treat camera-only classifications as less certain, give radar motion returns more weight, and use lidar geometry to confirm crosswalk actors and road edges.'
                            : 'No low-light or snow adjustment is active. Sensor confidence and object interpretation use normal daylight assumptions.'}
                    </p>
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
