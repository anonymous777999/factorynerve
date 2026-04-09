"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type DottedSurfaceProps = ComponentPropsWithoutRef<"div">;

type GridConfig = {
  amountX: number;
  amountY: number;
  separation: number;
  pointSize: number;
  amplitudeX: number;
  amplitudeY: number;
  speed: number;
};

type CapabilitySnapshot = {
  allowEnhanced: boolean;
  coarsePointer: boolean;
};

type MotionMediaQuery = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function detectCapability(width: number): CapabilitySnapshot {
  if (typeof window === "undefined") {
    return {
      allowEnhanced: false,
      coarsePointer: false,
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
  const deviceMemory = nav.deviceMemory ?? 8;
  const hardwareConcurrency = nav.hardwareConcurrency ?? 8;
  const coarsePointer =
    window.matchMedia("(pointer: coarse)").matches || (nav.maxTouchPoints ?? 0) > 0;
  const compactViewport = width < 768;
  const isAndroid = /android/i.test(nav.userAgent);
  const lowPowerDevice = deviceMemory <= 4 || hardwareConcurrency <= 4;
  const mediumPowerPhone = coarsePointer && compactViewport && (deviceMemory <= 6 || hardwareConcurrency <= 6);

  if (lowPowerDevice || (isAndroid && mediumPowerPhone)) {
    return {
      allowEnhanced: false,
      coarsePointer,
    };
  }

  try {
    const canvas = document.createElement("canvas");
    const options = {
      alpha: true,
      antialias: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: coarsePointer ? "low-power" : "default",
    } as const;
    const context =
      canvas.getContext("webgl2", options) ||
      canvas.getContext("webgl", options) ||
      canvas.getContext("experimental-webgl");

    if (!context) {
      return {
        allowEnhanced: false,
        coarsePointer,
      };
    }

    const loseContext = (context as WebGLRenderingContext).getExtension?.("WEBGL_lose_context");
    loseContext?.loseContext?.();
  } catch {
    return {
      allowEnhanced: false,
      coarsePointer,
    };
  }

  return {
    allowEnhanced: true,
    coarsePointer,
  };
}

function getGridConfig(width: number, coarsePointer: boolean): GridConfig {
  if (width < 640) {
    return {
      amountX: coarsePointer ? 12 : 16,
      amountY: coarsePointer ? 18 : 24,
      separation: coarsePointer ? 96 : 92,
      pointSize: coarsePointer ? 4.2 : 5.2,
      amplitudeX: coarsePointer ? 10 : 15,
      amplitudeY: coarsePointer ? 16 : 22,
      speed: coarsePointer ? 0.013 : 0.019,
    };
  }

  if (width < 1024) {
    return {
      amountX: coarsePointer ? 16 : 22,
      amountY: coarsePointer ? 24 : 30,
      separation: coarsePointer ? 108 : 104,
      pointSize: coarsePointer ? 5.1 : 6,
      amplitudeX: coarsePointer ? 12 : 18,
      amplitudeY: coarsePointer ? 18 : 26,
      speed: coarsePointer ? 0.011 : 0.016,
    };
  }

  return {
    amountX: coarsePointer ? 22 : 28,
    amountY: coarsePointer ? 32 : 40,
    separation: 112,
    pointSize: coarsePointer ? 5.6 : 6.8,
    amplitudeX: coarsePointer ? 14 : 20,
    amplitudeY: coarsePointer ? 20 : 30,
    speed: coarsePointer ? 0.01 : 0.014,
  };
}

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const capability = detectCapability(container.clientWidth || window.innerWidth);
    if (!capability.allowEnhanced) {
      container.dataset.surfaceMode = "fallback";
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color("#07111b"), 0.00022);

    const camera = new THREE.PerspectiveCamera(46, 1, 1, 4000);
    camera.position.set(0, 165, 860);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !capability.coarsePointer,
      failIfMajorPerformanceCaveat: true,
      powerPreference: capability.coarsePointer ? "low-power" : "high-performance",
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, capability.coarsePointer ? 1.05 : 1.5),
    );
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "h-full w-full";
    container.appendChild(renderer.domElement);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ) as MotionMediaQuery;
    const colorNear = new THREE.Color("#d7ebff");
    const colorFar = new THREE.Color("#7be7dd");

    let animationFrame = 0;
    let points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
    let config = getGridConfig(container.clientWidth || window.innerWidth, capability.coarsePointer);
    let basePositions = new Float32Array();
    let reducedMotion = prefersReducedMotion.matches;
    let count = 0;

    const disposePoints = () => {
      if (!points) return;
      scene.remove(points);
      points.geometry.dispose();
      points.material.dispose();
      points = null;
    };

    const rebuildSurface = (width: number, height: number) => {
      if (!width || !height) return;

      disposePoints();
      config = getGridConfig(width, capability.coarsePointer);
      camera.aspect = width / height;
      camera.position.z = config.amountY * config.separation * 0.64;
      camera.position.y = width < 640 ? 132 : 165;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const colors: number[] = [];

      for (let ix = 0; ix < config.amountX; ix += 1) {
        for (let iy = 0; iy < config.amountY; iy += 1) {
          const x = ix * config.separation - (config.amountX * config.separation) / 2;
          const z = iy * config.separation - (config.amountY * config.separation) / 2;
          const mix = config.amountY > 1 ? iy / (config.amountY - 1) : 0;
          const brightness = 0.9 + (ix / Math.max(1, config.amountX - 1)) * 0.22;
          const dotColor = colorNear.clone().lerp(colorFar, mix * 0.72).multiplyScalar(brightness);

          positions.push(x, 0, z);
          colors.push(dotColor.r, dotColor.g, dotColor.b);
        }
      }

      basePositions = Float32Array.from(positions);
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: config.pointSize,
        vertexColors: true,
        transparent: true,
        opacity: width < 640 ? 0.52 : 0.62,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      points = new THREE.Points(geometry, material);
      points.rotation.x = -0.18;
      points.rotation.z = -0.04;
      scene.add(points);
      renderer.render(scene, camera);
    };

    const renderFrame = () => {
      if (!points) return;

      const positionAttribute = points.geometry.getAttribute("position");
      const positions = positionAttribute.array as Float32Array;

      let particleIndex = 0;
      for (let ix = 0; ix < config.amountX; ix += 1) {
        for (let iy = 0; iy < config.amountY; iy += 1) {
          const index = particleIndex * 3;
          positions[index + 1] =
            Math.sin(ix * 0.36 + count) * config.amplitudeX +
            Math.cos(iy * 0.44 + count * 1.18) * config.amplitudeY;
          particleIndex += 1;
        }
      }

      positionAttribute.needsUpdate = true;
      points.rotation.z = -0.04 + Math.sin(count * 0.35) * 0.018;
      points.rotation.x = -0.18 + Math.cos(count * 0.28) * 0.01;
      renderer.render(scene, camera);
      count += config.speed;
    };

    const animate = () => {
      if (document.hidden) {
        animationFrame = 0;
        return;
      }
      renderFrame();
      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const handleMotionChange = () => {
      reducedMotion = prefersReducedMotion.matches;
      if (reducedMotion) {
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        if (points) {
          const positionAttribute = points.geometry.getAttribute("position");
          const positions = positionAttribute.array as Float32Array;
          positions.set(basePositions);
          positionAttribute.needsUpdate = true;
          renderer.render(scene, camera);
        }
        return;
      }

      if (!animationFrame) {
        animate();
      }
    };

    const handleResize = () => {
      rebuildSurface(container.clientWidth || window.innerWidth, container.clientHeight || 520);
      if (reducedMotion) {
        renderer.render(scene, camera);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        return;
      }

      if (!reducedMotion && !animationFrame) {
        animate();
      }
    };

    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      disposePoints();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            const nextEntry = entries[0];
            if (!nextEntry) return;
            const { width, height } = nextEntry.contentRect;
            rebuildSurface(width, height);
            if (reducedMotion) {
              renderer.render(scene, camera);
            }
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", handleResize);
    }

    if (typeof prefersReducedMotion.addEventListener === "function") {
      prefersReducedMotion.addEventListener("change", handleMotionChange);
    } else {
      prefersReducedMotion.addListener?.(handleMotionChange);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    renderer.domElement.addEventListener("webglcontextlost", handleContextLoss, false);
    rebuildSurface(container.clientWidth || window.innerWidth, container.clientHeight || 520);

    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLoss);
      if (typeof prefersReducedMotion.removeEventListener === "function") {
        prefersReducedMotion.removeEventListener("change", handleMotionChange);
      } else {
        prefersReducedMotion.removeListener?.(handleMotionChange);
      }
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      disposePoints();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none overflow-hidden", className)}
      {...props}
    />
  );
}
