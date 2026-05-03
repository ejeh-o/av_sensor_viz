import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

const SENSOR_COLORS = {
  camera: '#38bdf8',
  lidar: '#22c55e',
  radar: '#f59e0b',
  ultrasonic: '#a855f7',
};

const laneMarkings = [-1.8, 1.8];

export function AVScene({ activeSensors, fusionView, selectedObject }) {
  return (
    <group>
      <RoadEnvironment />
      <EgoVehicle />
      <SceneObjects selectedObject={selectedObject} activeSensors={activeSensors} />
      {fusionView ? (
        <FusionPerceptionLayer />
      ) : (
        <>
          {activeSensors.lidar && <LidarObjectOutlines fusionView={fusionView} />}
          <SensorLayers activeSensors={activeSensors} fusionView={fusionView} />
        </>
      )}
    </group>
  );
}

function RoadEnvironment() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[18, 28]} />
        <meshStandardMaterial color="#d8ded6" roughness={0.86} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[7.4, 25]} />
        <meshStandardMaterial color="#30343b" roughness={0.82} />
      </mesh>
      {[-3.9, 3.9].map((x) => (
        <mesh key={x} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, 0]}>
          <planeGeometry args={[0.16, 25]} />
          <meshStandardMaterial color="#f5f7f2" roughness={0.7} />
        </mesh>
      ))}
      {laneMarkings.map((x) =>
        Array.from({ length: 7 }, (_, index) => (
          <mesh key={`${x}-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, -10 + index * 3.7]}>
            <planeGeometry args={[0.08, 1.55]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.45} />
          </mesh>
        )),
      )}
      <Crosswalk />
      <SidewalkDetails />
    </group>
  );
}

function Crosswalk() {
  return (
    <group position={[0, 0.035, -6.7]}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[-3.05 + index * 0.88, 0, 0]}>
          <planeGeometry args={[0.42, 2]} />
          <meshStandardMaterial color="#edf2f7" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function SidewalkDetails() {
  return (
    <group>
      <ParkedVehicle position={[-5.2, 0.26, 4.1]} />
      <TrafficCone position={[4.7, 0.05, -1.5]} />
      <TrafficSign position={[4.9, 0, -7.8]} />
      <TrafficLight position={[-4.6, 0, -7.2]} />
    </group>
  );
}

function ParkedVehicle({ position }) {
  return (
    <group position={position} rotation={[0, 0, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[1.8, 0.35, 3.2]} />
        <meshStandardMaterial color="#9aa3a3" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.44, 0]}>
        <boxGeometry args={[1.5, 0.55, 2.7]} />
        <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.08} />
      </mesh>
      <VehicleWheels width={1.8} length={3.2} y={-0.12} />
    </group>
  );
}

function EgoVehicle() {
  return (
    <group position={[0, 0.24, 2.7]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.5, 2.65]} />
        <meshStandardMaterial color="#e8eef4" roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh castShadow position={[0, 0.38, -0.12]}>
        <boxGeometry args={[1.18, 0.45, 1.35]} />
        <meshStandardMaterial color="#152033" roughness={0.28} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.51, 0.2]}>
        <boxGeometry args={[0.72, 0.08, 0.7]} />
        <meshStandardMaterial color="#111827" emissive="#0ea5e9" emissiveIntensity={0.18} />
      </mesh>
      <VehicleWheels width={1.55} length={2.65} y={-0.02} />
      <Text position={[0, 0.88, 0]} rotation={[-0.9, 0, 0]} fontSize={0.18} color="#0f172a" anchorX="center">
        EGO AV
      </Text>
    </group>
  );
}

function SceneObjects({ selectedObject, activeSensors }) {
  const labelVisible = Object.values(activeSensors).some(Boolean);
  return (
    <group>
      <Vehicle position={[0.15, 0.2, -5.1]} color="#64748b" label="Lead car" selected={selectedObject === 'Lead car'} labelVisible={labelVisible} />
      <Vehicle position={[-2.1, 0.2, -1.9]} color="#0f766e" label="Adjacent car" labelVisible={false} />
      <Cyclist position={[2.2, 0.1, -3.2]} selected={selectedObject === 'Cyclist'} labelVisible={labelVisible} />
      <Pedestrian position={[3.15, 0.1, -6.65]} selected={selectedObject === 'Pedestrian'} labelVisible={labelVisible} />
      <TrafficCone position={[3.2, 0.05, 1.05]} selected={selectedObject === 'Traffic cone'} labelVisible={labelVisible} />
    </group>
  );
}

function Vehicle({ position, color, label, selected, labelVisible }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.42, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} emissive={selected ? '#facc15' : '#000000'} emissiveIntensity={selected ? 0.15 : 0} />
      </mesh>
      <mesh castShadow position={[0, 0.32, -0.1]}>
        <boxGeometry args={[1.05, 0.38, 1.0]} />
        <meshStandardMaterial color="#172033" roughness={0.25} />
      </mesh>
      <VehicleWheels width={1.45} length={2.2} y={-0.02} />
      {labelVisible && selected && <ObjectLabel label={label} position={[0, 1.2, 0]} />}
    </group>
  );
}

function VehicleWheels({ width, length, y }) {
  const x = width / 2 + 0.08;
  const z = length / 2 - 0.38;
  return (
    <group>
      {[-x, x].map((wheelX) =>
        [-z, z].map((wheelZ) => (
          <VehicleWheel key={`${wheelX}-${wheelZ}`} position={[wheelX, y, wheelZ]} />
        )),
      )}
    </group>
  );
}

function VehicleWheel({ position }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.17, 28]} />
        <meshStandardMaterial color="#101827" roughness={0.72} metalness={0.03} />
      </mesh>
      <mesh position={[0, 0.088, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.012, 24]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Pedestrian({ position, selected, labelVisible }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.63, 0]}>
        <capsuleGeometry args={[0.14, 0.62, 8, 16]} />
        <meshStandardMaterial color="#ef4444" emissive={selected ? '#facc15' : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
      </mesh>
      <mesh castShadow position={[0, 1.09, 0]}>
        <sphereGeometry args={[0.17, 24, 16]} />
        <meshStandardMaterial color="#7c2d12" />
      </mesh>
      {labelVisible && selected && <ObjectLabel label="Pedestrian" position={[0, 1.55, 0]} />}
    </group>
  );
}

function Cyclist({ position, selected, labelVisible }) {
  return (
    <group position={position} rotation={[0, -0.18, 0]}>
      {[-0.45, 0.45].map((z) => (
        <mesh key={z} castShadow position={[0, 0.26, z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.24, 0.035, 12, 36]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      <Line points={[[0, 0.26, -0.45], [0, 0.62, 0], [0, 0.26, 0.45], [0, 0.26, -0.45]]} color="#eab308" lineWidth={3} />
      <Line points={[[0, 0.62, 0], [0, 0.82, -0.35], [0, 0.26, -0.45]]} color="#eab308" lineWidth={3} />
      <Line points={[[0, 0.82, -0.35], [-0.22, 0.88, -0.42], [0.22, 0.88, -0.42]]} color="#111827" lineWidth={3} />
      <Line points={[[0, 0.62, 0], [0, 0.78, -0.18]]} color="#111827" lineWidth={3} />
      <mesh castShadow position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.11, 0.48, 8, 16]} />
        <meshStandardMaterial color="#2563eb" emissive={selected ? '#facc15' : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
      </mesh>
      {labelVisible && selected && <ObjectLabel label="Cyclist" position={[0, 1.55, 0]} />}
    </group>
  );
}

function TrafficCone({ position, selected = false, labelVisible = false }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <coneGeometry args={[0.28, 0.55, 24]} />
        <meshStandardMaterial color="#f97316" emissive={selected ? '#facc15' : '#000000'} emissiveIntensity={selected ? 0.2 : 0} />
      </mesh>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.52, 0.08, 0.52]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {labelVisible && selected && <ObjectLabel label="Traffic cone" position={[0, 1.0, 0]} />}
    </group>
  );
}

function TrafficSign({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.7, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.78, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.65, 0.65, 0.06]} />
        <meshStandardMaterial color="#f43f5e" roughness={0.35} />
      </mesh>
    </group>
  );
}

function TrafficLight({ position }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 12]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh castShadow position={[0.26, 2.18, 0]}>
        <boxGeometry args={[0.36, 0.78, 0.22]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {['#ef4444', '#f59e0b', '#22c55e'].map((color, index) => (
        <mesh key={color} position={[0.26, 2.42 - index * 0.24, -0.12]}>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={index === 2 ? 0.75 : 0.2} />
        </mesh>
      ))}
    </group>
  );
}

function ObjectLabel({ label, position }) {
  return (
    <Html position={position} center distanceFactor={10}>
      <div className="object-label">{label}</div>
    </Html>
  );
}

function SensorLayers({ activeSensors, fusionView }) {
  return (
    <group position={[0, 0.06, 2.7]}>
      {activeSensors.camera && <CameraFrustum fusionView={fusionView} />}
      {activeSensors.lidar && <LidarCloud fusionView={fusionView} />}
      {activeSensors.radar && <RadarArcs fusionView={fusionView} />}
      {activeSensors.ultrasonic && <UltrasonicBubbles fusionView={fusionView} />}
    </group>
  );
}

function CameraFrustum({ fusionView }) {
  const materialRef = useRef();
  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.opacity = fusionView ? 0.23 + Math.sin(clock.elapsedTime * 2.5) * 0.04 : 0.2;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -3.7]}>
        <coneGeometry args={[4.2, 9.2, 4, 1, true, Math.PI / 4]} />
        <meshBasicMaterial ref={materialRef} color={SENSOR_COLORS.camera} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Line points={[[0, 0.2, -0.9], [-3.0, 0.22, -8.1], [3.0, 0.22, -8.1], [0, 0.2, -0.9]]} color={SENSOR_COLORS.camera} lineWidth={2} transparent opacity={0.85} />
      <DetectionTag label="lane lines" position={[-1.4, 0.18, -5.8]} color={SENSOR_COLORS.camera} />
      <DetectionTag label="traffic light" position={[-3.55, 2.35, -7.2]} color={SENSOR_COLORS.camera} />
      <DetectionTag label="pedestrian" position={[3.15, 1.6, -9.35]} color={SENSOR_COLORS.camera} />
    </group>
  );
}

function LidarObjectOutlines({ fusionView }) {
  const opacity = fusionView ? 0.75 : 0.62;
  return (
    <group>
      <LidarBox position={[0.15, 0.52, -5.1]} scale={[1.7, 0.85, 2.45]} opacity={opacity} />
      <LidarBox position={[-2.1, 0.52, -1.9]} scale={[1.7, 0.85, 2.45]} opacity={opacity} />
      <LidarBox position={[2.2, 0.68, -3.2]} scale={[0.85, 1.35, 1.4]} opacity={opacity} />
      <LidarBox position={[3.15, 0.78, -6.65]} scale={[0.55, 1.45, 0.55]} opacity={opacity} />
      <LidarBox position={[3.2, 0.38, 1.05]} scale={[0.75, 0.75, 0.75]} opacity={opacity} />
      <DetectionTag label="3D object outlines" position={[-1.65, 1.2, -3.35]} color={SENSOR_COLORS.lidar} />
    </group>
  );
}

function LidarBox({ position, scale, opacity }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={SENSOR_COLORS.lidar} wireframe transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function FusionPerceptionLayer() {
  return (
    <group>
      <FusionTrack
        position={[0.15, 0.6, -5.1]}
        scale={[1.9, 1.05, 2.65]}
        label="Lead car"
        confidence="98%"
        risk="MED"
        color="#0ea5e9"
      />
      <FusionTrack
        position={[-2.1, 0.6, -1.9]}
        scale={[1.85, 1.0, 2.55]}
        label="Adjacent car"
        confidence="93%"
        risk="LOW"
        color="#14b8a6"
      />
      <FusionTrack
        position={[2.2, 0.78, -3.2]}
        scale={[0.95, 1.5, 1.55]}
        label="Cyclist"
        confidence="91%"
        risk="MED"
        color="#f59e0b"
      />
      <FusionTrack
        position={[3.15, 0.85, -6.65]}
        scale={[0.72, 1.65, 0.72]}
        label="Pedestrian"
        confidence="94%"
        risk="HIGH"
        color="#ef4444"
      />
      <FusionTrack
        position={[3.2, 0.42, 1.05]}
        scale={[0.9, 0.86, 0.9]}
        label="Cone"
        confidence="87%"
        risk="LOW"
        color="#a855f7"
      />
      <Line
        points={[[0, 0.12, 1.25], [0.4, 0.12, -0.6], [1.3, 0.12, -2.6], [2.45, 0.12, -4.7], [3.15, 0.12, -6.15]]}
        color="#ef4444"
        lineWidth={4}
        transparent
        opacity={0.88}
      />
      <Line
        points={[[-0.55, 0.11, -0.2], [-0.1, 0.11, -2.1], [0.05, 0.11, -4.0]]}
        color="#f59e0b"
        lineWidth={4}
        transparent
        opacity={0.72}
      />
      <DetectionTag label="conflict risk path" position={[1.85, 0.48, -4.25]} color="#ef4444" />
      <DetectionTag label="planned path" position={[-0.05, 0.42, -2.15]} color="#f59e0b" />
      <DetectionTag label="tracked objects + object confidence" position={[-1.15, 1.35, -4.45]} color="#0ea5e9" />
    </group>
  );
}

function FusionTrack({ position, scale, label, confidence, risk, color }) {
  return (
    <group>
      <mesh position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[position[0], 0.08, position[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[scale[0] * 0.76, scale[2] * 0.5, 1]}>
        <ringGeometry args={[0.78, 0.94, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html position={[position[0], position[1] + scale[1] * 0.64, position[2]]} center distanceFactor={11}>
        <div className={`fusion-tag risk-${risk.toLowerCase()}`}>
          <strong>{label}</strong>
          <span>{confidence} object conf</span>
          <em>{risk}</em>
        </div>
      </Html>
    </group>
  );
}

function LidarCloud({ fusionView }) {
  const pointsRef = useRef();
  const { positions, colors } = useMemo(() => {
    const count = 900;
    const positionArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    const color = new THREE.Color(SENSOR_COLORS.lidar);
    for (let i = 0; i < count; i += 1) {
      const ring = i % 5;
      const angle = (i / count) * Math.PI * 2 * 8.5;
      const radius = 1.1 + ring * 0.95 + ((i * 17) % 31) / 70;
      positionArray[i * 3] = Math.cos(angle) * radius;
      positionArray[i * 3 + 1] = 0.09 + ring * 0.03;
      positionArray[i * 3 + 2] = Math.sin(angle) * radius;
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }
    return { positions: positionArray, colors: colorArray };
  }, []);

  useFrame(({ clock }) => {
    if (pointsRef.current) pointsRef.current.rotation.y = clock.elapsedTime * (fusionView ? 0.24 : 0.16);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.065} vertexColors transparent opacity={fusionView ? 0.82 : 0.68} depthWrite={false} />
    </points>
  );
}

function RadarArcs({ fusionView }) {
  const groupRef = useRef();
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.position.z = Math.sin(clock.elapsedTime * 1.7) * 0.05;
  });
  return (
    <group ref={groupRef}>
      {[3.2, 5.2, 7.5, 10.2].map((radius, index) => (
        <Arc key={radius} radius={radius} start={-0.45} end={0.45} color={SENSOR_COLORS.radar} opacity={fusionView ? 0.72 - index * 0.1 : 0.58 - index * 0.08} />
      ))}
      <SpeedVector from={[0.15, 0.32, -5.1]} to={[0.15, 0.32, -6.15]} />
      <SpeedVector from={[2.2, 0.32, -3.2]} to={[2.85, 0.32, -3.65]} />
      <VelocityMarker position={[0.15, 0.62, -5.1]} label="-12 mph" />
      <VelocityMarker position={[2.2, 0.62, -3.2]} label="+4 mph" />
    </group>
  );
}

function SpeedVector({ from, to }) {
  return (
    <group>
      <Line points={[from, to]} color={SENSOR_COLORS.radar} lineWidth={4} transparent opacity={0.95} />
      <mesh position={to} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.32, 18]} />
        <meshBasicMaterial color={SENSOR_COLORS.radar} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function Arc({ radius, start, end, color, opacity }) {
  const points = useMemo(() => {
    const result = [];
    for (let i = 0; i <= 48; i += 1) {
      const theta = start + (end - start) * (i / 48) - Math.PI / 2;
      result.push([Math.cos(theta) * radius, 0.18, Math.sin(theta) * radius]);
    }
    return result;
  }, [radius, start, end]);
  return <Line points={points} color={color} lineWidth={3} transparent opacity={opacity} />;
}

function UltrasonicBubbles({ fusionView }) {
  return (
    <group>
      {[
        [0, 0, -1.15],
        [0, 0, 1.15],
        [-1.05, 0, 0],
        [1.05, 0, 0],
      ].map((position, index) => (
        <mesh key={index} position={position} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.72, 1.42, 48]} />
          <meshBasicMaterial color={SENSOR_COLORS.ultrasonic} transparent opacity={fusionView ? 0.55 : 0.42} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[3.2, 0.08, -1.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.92, 40]} />
        <meshBasicMaterial color={SENSOR_COLORS.ultrasonic} transparent opacity={0.72} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <DetectionTag label="close-range warning" position={[3.05, 0.55, -1.65]} color={SENSOR_COLORS.ultrasonic} />
      <DetectionTag label="curb proximity" position={[3.1, 0.35, 1.05]} color={SENSOR_COLORS.ultrasonic} />
    </group>
  );
}

function DetectionTag({ label, position, color }) {
  return (
    <Html position={position} center distanceFactor={12}>
      <div className="detection-tag" style={{ '--tag-color': color }}>
        {label}
      </div>
    </Html>
  );
}

function VelocityMarker({ position, label }) {
  return (
    <Html position={position} center distanceFactor={12}>
      <div className="velocity-tag">{label}</div>
    </Html>
  );
}
