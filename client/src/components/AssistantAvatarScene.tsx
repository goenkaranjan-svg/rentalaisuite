import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Html,
  OrbitControls,
  RoundedBox,
  Sphere,
  Torus,
  useGLTF,
} from "@react-three/drei";
import type { Group, Material, Mesh, Object3D, SkinnedMesh } from "three";
import {
  Color,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  VRMExpressionPresetName,
  type VRM,
} from "@pixiv/three-vrm";

export type AssistantAvatarMode = "idle" | "thinking" | "speaking";
export type AssistantAvatarExpression = "neutral" | "happy" | "surprised" | "confused";

type AvatarAssetSpec =
  | { type: "vrm"; url: string }
  | { type: "glb"; url: string }
  | null;

type AvatarDriver = {
  jawOpen: number;
  mouthRound: number;
  mouthWide: number;
  mouthSmile: number;
  blink: number;
  browRaise: number;
  browFurrow: number;
  headTurn: number;
  headTilt: number;
  torsoBreath: number;
};

type AssistantAvatarSceneProps = {
  mode: AssistantAvatarMode;
  expression: AssistantAvatarExpression;
  name: string;
  speechText?: string;
  speechCursor?: number;
};

const DEFAULT_VRM_URL = "/avatar/aster.vrm";
const DEFAULT_GLB_URL = "/avatar/aster.glb";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mix(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function getExpressionPose(expression: AssistantAvatarExpression) {
  switch (expression) {
    case "happy":
      return { smile: 0.9, browRaise: 0.18, browFurrow: 0, blinkBias: 0.08 };
    case "surprised":
      return { smile: 0.1, browRaise: 0.8, browFurrow: 0, blinkBias: -0.18 };
    case "confused":
      return { smile: 0, browRaise: 0.05, browFurrow: 0.78, blinkBias: 0.02 };
    default:
      return { smile: 0.08, browRaise: 0.05, browFurrow: 0, blinkBias: 0 };
  }
}

function getSpeechProfile(text: string, cursor: number, mode: AssistantAvatarMode) {
  if (mode !== "speaking" || text.trim().length === 0) {
    return { jawOpen: 0.08, mouthRound: 0.05, mouthWide: 0.08, consonantTension: 0.1 };
  }

  const index = Math.max(0, Math.min(text.length - 1, cursor));
  const sample = text.slice(index, index + 3).toLowerCase();
  const active = sample[0] || " ";

  let jawOpen = /[aeiouy]/.test(active) ? 0.65 : 0.18;
  let mouthRound = /[oquw]/.test(sample) ? 0.85 : 0.12;
  let mouthWide = /[eiy]/.test(sample) ? 0.75 : 0.15;
  let consonantTension = /[fvbmp]/.test(sample) ? 0.85 : 0.15;

  if (/[bmp]/.test(active)) {
    jawOpen = 0.04;
    mouthRound = 0.06;
  }

  if (/[lrstnd]/.test(sample)) {
    jawOpen = Math.max(jawOpen, 0.28);
    mouthWide = Math.max(mouthWide, 0.4);
  }

  return { jawOpen, mouthRound, mouthWide, consonantTension };
}

function useAvatarAssetSpec() {
  const [asset, setAsset] = useState<AvatarAssetSpec | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function probeAsset(url: string) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Range: "bytes=0-32",
          },
        });
        if (!response.ok) return false;
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (contentType.includes("text/html")) return false;
        return true;
      } catch {
        return false;
      }
    }

    void (async () => {
      const hasVrm = await probeAsset(DEFAULT_VRM_URL);
      if (cancelled) return;
      if (hasVrm) {
        setAsset({ type: "vrm", url: DEFAULT_VRM_URL });
        return;
      }

      const hasGlb = await probeAsset(DEFAULT_GLB_URL);
      if (cancelled) return;
      if (hasGlb) {
        setAsset({ type: "glb", url: DEFAULT_GLB_URL });
        return;
      }

      setAsset(null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return asset;
}

function useAvatarDriver(mode: AssistantAvatarMode, expression: AssistantAvatarExpression, speechText: string, speechCursor: number) {
  const driver = useRef<AvatarDriver>({
    jawOpen: 0.08,
    mouthRound: 0.05,
    mouthWide: 0.08,
    mouthSmile: 0.08,
    blink: 0,
    browRaise: 0.04,
    browFurrow: 0,
    headTurn: 0,
    headTilt: 0,
    torsoBreath: 0.02,
  });

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const expressionPose = getExpressionPose(expression);
    const speech = getSpeechProfile(speechText, speechCursor, mode);
    const blinkWave = Math.pow((Math.sin(t * 0.7) + 1) * 0.5, 24);
    const speakingPulse = mode === "speaking" ? (Math.sin(t * 11) + 1) * 0.5 : 0;

    driver.current.jawOpen = mix(driver.current.jawOpen, clamp01(speech.jawOpen + speakingPulse * 0.12), Math.min(1, delta * 10));
    driver.current.mouthRound = mix(driver.current.mouthRound, speech.mouthRound, Math.min(1, delta * 8));
    driver.current.mouthWide = mix(driver.current.mouthWide, speech.mouthWide, Math.min(1, delta * 8));
    driver.current.mouthSmile = mix(driver.current.mouthSmile, expressionPose.smile, Math.min(1, delta * 7));
    driver.current.blink = mix(driver.current.blink, clamp01(blinkWave + expressionPose.blinkBias), Math.min(1, delta * 15));
    driver.current.browRaise = mix(driver.current.browRaise, expressionPose.browRaise, Math.min(1, delta * 7));
    driver.current.browFurrow = mix(driver.current.browFurrow, expressionPose.browFurrow, Math.min(1, delta * 7));
    driver.current.headTurn = mix(
      driver.current.headTurn,
      (mode === "thinking" ? 0.2 : 0.12) * Math.sin(t * 0.55),
      Math.min(1, delta * 5),
    );
    driver.current.headTilt = mix(
      driver.current.headTilt,
      (expression === "confused" ? -0.18 : 0.08) * Math.sin(t * 0.9),
      Math.min(1, delta * 5),
    );
    driver.current.torsoBreath = 0.035 + Math.sin(t * 1.4) * 0.018;
  });

  return driver;
}

function setMorphInfluence(mesh: Mesh | SkinnedMesh, aliases: string[], value: number) {
  const dictionary = (mesh as Mesh).morphTargetDictionary;
  const influences = (mesh as Mesh).morphTargetInfluences;
  if (!dictionary || !influences) return;

  const matched = Object.entries(dictionary).filter(([name]) =>
    aliases.some((alias) => name.toLowerCase().includes(alias.toLowerCase())),
  );
  for (const [, index] of matched) {
    influences[index] = value;
  }
}

function collectAvatarNodes(root: Object3D) {
  const state: {
    head?: Object3D;
    neck?: Object3D;
    spine?: Object3D;
    leftEye?: Object3D;
    rightEye?: Object3D;
    jaw?: Object3D;
    skinnedMeshes: Array<Mesh | SkinnedMesh>;
  } = {
    skinnedMeshes: [],
  };

  root.traverse((node) => {
    const name = node.name.toLowerCase();
    if (!state.head && name.includes("head")) state.head = node;
    if (!state.neck && name.includes("neck")) state.neck = node;
    if (!state.spine && (name.includes("spine") || name.includes("chest"))) state.spine = node;
    if (!state.leftEye && (name.includes("lefteye") || name.includes("eye_l"))) state.leftEye = node;
    if (!state.rightEye && (name.includes("righteye") || name.includes("eye_r"))) state.rightEye = node;
    if (!state.jaw && name.includes("jaw")) state.jaw = node;
    if ((node as Mesh).isMesh || (node as SkinnedMesh).isSkinnedMesh) {
      state.skinnedMeshes.push(node as Mesh | SkinnedMesh);
    }
  });

  return state;
}

function applyGenericRig(root: Object3D, driver: AvatarDriver) {
  const nodes = collectAvatarNodes(root);
  const lookTarget = new Vector3(driver.headTurn * 0.4, driver.browRaise * 0.1, 1);

  if (nodes.head) {
    nodes.head.rotation.y = driver.headTurn;
    nodes.head.rotation.z = driver.headTilt;
  }
  if (nodes.neck) {
    nodes.neck.rotation.y = driver.headTurn * 0.5;
    nodes.neck.rotation.z = driver.headTilt * 0.35;
  }
  if (nodes.spine) {
    nodes.spine.scale.setScalar(1 + driver.torsoBreath * 0.25);
  }
  if (nodes.jaw) {
    nodes.jaw.rotation.x = driver.jawOpen * 0.42;
  }
  if (nodes.leftEye) nodes.leftEye.lookAt(lookTarget);
  if (nodes.rightEye) nodes.rightEye.lookAt(lookTarget);

  for (const mesh of nodes.skinnedMeshes) {
    setMorphInfluence(mesh, ["blink", "eyeclose"], driver.blink);
    setMorphInfluence(mesh, ["aa", "jawopen", "mouthopen"], driver.jawOpen);
    setMorphInfluence(mesh, ["oh", "ou", "round"], driver.mouthRound);
    setMorphInfluence(mesh, ["ih", "ee", "wide"], driver.mouthWide);
    setMorphInfluence(mesh, ["smile", "happy"], driver.mouthSmile);
    setMorphInfluence(mesh, ["browup", "surprised"], driver.browRaise);
    setMorphInfluence(mesh, ["browdown", "angry", "sad"], driver.browFurrow);
  }
}

function HumanFallbackBust(props: { mode: AssistantAvatarMode; expression: AssistantAvatarExpression; speechText: string; speechCursor: number }) {
  const rootRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const leftEyeRef = useRef<Group>(null);
  const rightEyeRef = useRef<Group>(null);
  const browLeftRef = useRef<Mesh>(null);
  const browRightRef = useRef<Mesh>(null);
  const shouldersRef = useRef<Group>(null);
  const driverRef = useAvatarDriver(props.mode, props.expression, props.speechText, props.speechCursor);

  useFrame(() => {
    const driver = driverRef.current;
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(performance.now() / 900) * 0.02;
    }
    if (headRef.current) {
      headRef.current.rotation.y = driver.headTurn;
      headRef.current.rotation.z = driver.headTilt;
    }
    if (shouldersRef.current) {
      shouldersRef.current.scale.y = 1 + driver.torsoBreath;
    }
    if (mouthRef.current) {
      mouthRef.current.scale.y = 0.45 + driver.jawOpen * 2.4;
      mouthRef.current.scale.x = 0.75 + driver.mouthSmile * 0.95 + driver.mouthWide * 0.4 - driver.mouthRound * 0.22;
      mouthRef.current.position.y = -0.38 - driver.jawOpen * 0.06;
    }
    const eyeScale = Math.max(0.12, 1 - driver.blink * 0.92);
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScale;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScale;
    if (browLeftRef.current) browLeftRef.current.position.y = 0.42 + driver.browRaise * 0.16;
    if (browRightRef.current) browRightRef.current.position.y = 0.42 + driver.browRaise * 0.16 - driver.browFurrow * 0.04;
    if (browRightRef.current) browRightRef.current.rotation.z = -0.12 - driver.browFurrow * 0.38;
    if (browLeftRef.current) browLeftRef.current.rotation.z = 0.12 + driver.browRaise * 0.12;
  });

  return (
    <group ref={rootRef} position={[0, -1.05, 0]}>
      <Float speed={1.15} rotationIntensity={0.08} floatIntensity={0.22}>
        <group ref={shouldersRef} position={[0, -0.95, 0]}>
          <RoundedBox args={[2.2, 1.25, 1.1]} radius={0.18} smoothness={5}>
            <meshStandardMaterial color="#1f2937" roughness={0.72} metalness={0.08} />
          </RoundedBox>
          <mesh position={[0, 0.1, 0.58]}>
            <planeGeometry args={[0.7, 0.85]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.92} />
          </mesh>
        </group>

        <group ref={headRef} position={[0, 0.42, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.88, 64, 64]} />
            <meshStandardMaterial color="#f1c6a8" roughness={0.78} metalness={0.03} />
          </mesh>

          <mesh position={[0, 0.62, -0.04]} rotation={[-0.05, 0, 0]}>
            <sphereGeometry args={[0.9, 64, 48, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color="#3f2b1f" roughness={0.82} metalness={0.02} />
          </mesh>

          <mesh position={[0, 0.02, 0.68]}>
            <sphereGeometry args={[0.76, 48, 48]} />
            <meshStandardMaterial color="#efc1a4" roughness={0.65} metalness={0.02} />
          </mesh>

          <mesh position={[-0.28, 0.08, 0.79]} rotation={[0.18, 0, 0]}>
            <capsuleGeometry args={[0.1, 0.12, 4, 10]} />
            <meshStandardMaterial color="#e6b08d" roughness={0.75} />
          </mesh>
          <mesh position={[0.28, 0.08, 0.79]} rotation={[0.18, 0, 0]}>
            <capsuleGeometry args={[0.1, 0.12, 4, 10]} />
            <meshStandardMaterial color="#e6b08d" roughness={0.75} />
          </mesh>

          <group ref={leftEyeRef} position={[-0.24, 0.12, 0.84]}>
            <mesh>
              <sphereGeometry args={[0.11, 24, 24]} />
              <meshStandardMaterial color="#ffffff" roughness={0.18} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color="#3a2a1a" emissive="#2a170a" emissiveIntensity={0.35} />
            </mesh>
          </group>
          <group ref={rightEyeRef} position={[0.24, 0.12, 0.84]}>
            <mesh>
              <sphereGeometry args={[0.11, 24, 24]} />
              <meshStandardMaterial color="#ffffff" roughness={0.18} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color="#3a2a1a" emissive="#2a170a" emissiveIntensity={0.35} />
            </mesh>
          </group>

          <mesh ref={browLeftRef} position={[-0.23, 0.42, 0.86]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.2, 0.035, 0.03]} />
            <meshStandardMaterial color="#2a1a12" />
          </mesh>
          <mesh ref={browRightRef} position={[0.23, 0.42, 0.86]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.2, 0.035, 0.03]} />
            <meshStandardMaterial color="#2a1a12" />
          </mesh>

          <mesh position={[0, -0.04, 0.9]}>
            <capsuleGeometry args={[0.03, 0.12, 4, 8]} />
            <meshStandardMaterial color="#ddac8a" roughness={0.7} />
          </mesh>

          <mesh ref={mouthRef} position={[0, -0.38, 0.88]}>
            <capsuleGeometry args={[0.07, 0.18, 6, 12]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.45} metalness={0.02} />
          </mesh>
        </group>
      </Float>
      <ContactShadows position={[0, -1.72, 0]} opacity={0.32} scale={4.6} blur={1.9} far={2.6} />
    </group>
  );
}

function GLBHumanoid({
  url,
  mode,
  expression,
  speechText,
  speechCursor,
}: {
  url: string;
  mode: AssistantAvatarMode;
  expression: AssistantAvatarExpression;
  speechText: string;
  speechCursor: number;
}) {
  const gltf = useGLTF(url);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const rootRef = useRef<Group>(null);
  const driverRef = useAvatarDriver(mode, expression, speechText, speechCursor);

  useMemo(() => {
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const standard = material as Material;
          if (standard instanceof MeshStandardMaterial) {
            standard.envMapIntensity = 0.95;
          }
        }
      }
    });
  }, [model]);

  useFrame(() => {
    if (!rootRef.current) return;
    applyGenericRig(rootRef.current, driverRef.current);
  });

  return <primitive ref={rootRef} object={model} position={[0, -1.65, 0]} scale={1.55} />;
}

function VRMHumanoid({
  url,
  mode,
  expression,
  speechText,
  speechCursor,
}: {
  url: string;
  mode: AssistantAvatarMode;
  expression: AssistantAvatarExpression;
  speechText: string;
  speechCursor: number;
}) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrm = useMemo(() => {
    const loaded = gltf.userData.vrm as VRM | undefined;
    if (!loaded) return null;
    VRMUtils.rotateVRM0(loaded);
    return loaded;
  }, [gltf]);

  const scene = vrm?.scene ?? null;
  const rootRef = useRef<Group>(null);
  const driverRef = useAvatarDriver(mode, expression, speechText, speechCursor);

  useFrame((_, delta) => {
    if (!vrm || !scene) return;
    vrm.update(delta);

    const driver = driverRef.current;
    const expressionManager = vrm.expressionManager;
    expressionManager?.setValue(VRMExpressionPresetName.Blink, driver.blink);
    expressionManager?.setValue(VRMExpressionPresetName.Aa, driver.jawOpen);
    expressionManager?.setValue(VRMExpressionPresetName.Oh, driver.mouthRound);
    expressionManager?.setValue(VRMExpressionPresetName.Ee, driver.mouthWide);
    expressionManager?.setValue(VRMExpressionPresetName.Happy, driver.mouthSmile);
    expressionManager?.setValue(VRMExpressionPresetName.Relaxed, expression === "neutral" ? 0.2 : 0);
    expressionManager?.setValue(VRMExpressionPresetName.Surprised, expression === "surprised" ? driver.browRaise : 0);

    const humanoid = vrm.humanoid;
    const head = humanoid.getNormalizedBoneNode("head");
    const neck = humanoid.getNormalizedBoneNode("neck");
    const spine = humanoid.getNormalizedBoneNode("chest") ?? humanoid.getNormalizedBoneNode("spine");
    const jaw = humanoid.getNormalizedBoneNode("jaw");

    if (head) {
      head.rotation.y = driver.headTurn;
      head.rotation.z = driver.headTilt;
    }
    if (neck) {
      neck.rotation.y = driver.headTurn * 0.45;
      neck.rotation.z = driver.headTilt * 0.25;
    }
    if (spine) {
      spine.scale.setScalar(1 + driver.torsoBreath * 0.18);
    }
    if (jaw) {
      jaw.rotation.x = driver.jawOpen * 0.34;
    }

    if (rootRef.current) {
      applyGenericRig(rootRef.current, driver);
    }
  });

  if (!scene) return null;
  return <primitive ref={rootRef} object={scene} position={[0, -1.7, 0]} scale={1.62} />;
}

function AvatarRuntime({
  asset,
  mode,
  expression,
  speechText,
  speechCursor,
}: {
  asset: AvatarAssetSpec | undefined;
  mode: AssistantAvatarMode;
  expression: AssistantAvatarExpression;
  speechText: string;
  speechCursor: number;
}) {
  if (asset === undefined) {
    return (
      <Html center>
        <div className="rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs text-slate-700">
          Loading avatar runtime...
        </div>
      </Html>
    );
  }

  if (!asset) {
    return <HumanFallbackBust mode={mode} expression={expression} speechText={speechText} speechCursor={speechCursor} />;
  }

  if (asset.type === "vrm") {
    return <VRMHumanoid url={asset.url} mode={mode} expression={expression} speechText={speechText} speechCursor={speechCursor} />;
  }

  return <GLBHumanoid url={asset.url} mode={mode} expression={expression} speechText={speechText} speechCursor={speechCursor} />;
}

export function AssistantAvatarScene({
  mode,
  expression,
  name,
  speechText = "",
  speechCursor = 0,
}: AssistantAvatarSceneProps) {
  const asset = useAvatarAssetSpec();
  const usingFallback = asset === null;

  return (
    <div className="relative h-60 overflow-hidden rounded-[1.8rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(220,252,231,0.86)_34%,_rgba(15,23,42,0.12)_100%)] shadow-inner shadow-emerald-950/5">
      <div className="pointer-events-none absolute inset-x-6 top-4 z-10 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-emerald-950/70">
        <span>{name}</span>
        <span>{mode} / {expression}</span>
      </div>
      <div className="pointer-events-none absolute left-6 top-10 z-10 text-[10px] uppercase tracking-[0.22em] text-emerald-900/55">
        {asset?.type === "vrm" ? "VRM Rig" : asset?.type === "glb" ? "GLB Rig" : usingFallback ? "Fallback Human" : "Avatar Probe"}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(255,255,255,0.92),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(15,23,42,0.08)_100%)]" />
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.08, 5.1], fov: 28 }}>
        <color attach="background" args={["#eefcf5"]} />
        <fog attach="fog" args={["#eefcf5", 5.2, 10]} />
        <ambientLight intensity={1.35} />
        <directionalLight position={[3, 4, 4]} intensity={1.8} color="#fff7ed" />
        <directionalLight position={[-2.5, 2, 3]} intensity={0.9} color="#d1fae5" />
        <pointLight position={[0, 1.5, 2.8]} intensity={1.4} color="#ffffff" />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <AvatarRuntime
            asset={asset}
            mode={mode}
            expression={expression}
            speechText={speechText}
            speechCursor={speechCursor}
          />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
      {usingFallback ? (
        <div className="pointer-events-none absolute inset-x-5 bottom-3 rounded-2xl border border-white/70 bg-white/72 px-3 py-2 text-[11px] text-slate-600 backdrop-blur-sm">
          Add `/client/public/avatar/aster.vrm` or `/client/public/avatar/aster.glb` to switch from the fallback bust to a rigged human avatar.
        </div>
      ) : null}
    </div>
  );
}
