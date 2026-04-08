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

function getGridConfig(width: number): GridConfig {
  if (width < 640) {
    return {
      amountX: 16,
      amountY: 24,
      separation: 92,
      pointSize: 5.2,
      amplitudeX: 15,
      amplitudeY: 22,
      speed: 0.019,
    };
  }

  if (width < 1024) {
    return {
      amountX: 22,
      amountY: 30,
      separation: 104,
      pointSize: 6,
      amplitudeX: 18,
      amplitudeY: 26,
      speed: 0.016,
    };
  }

  return {
    amountX: 28,
    amountY: 40,
    separation: 112,
    pointSize: 6.8,
    amplitudeX: 20,
    amplitudeY: 30,
    speed: 0.014,
  };
}

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(new THREE.Color("#07111b"), 0.00022);

    const camera = new THREE.PerspectiveCamera(46, 1, 1, 4000);
    camera.position.set(0, 165, 860);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "h-full w-full";
    container.appendChild(renderer.domElement);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const colorNear = new THREE.Color("#d7ebff");
    const colorFar = new THREE.Color("#7be7dd");

    let animationFrame = 0;
    let points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
    let config = getGridConfig(container.clientWidth || window.innerWidth);
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
      config = getGridConfig(width);
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

    const resizeObserver = new ResizeObserver((entries) => {
      const nextEntry = entries[0];
      if (!nextEntry) return;
      const { width, height } = nextEntry.contentRect;
      rebuildSurface(width, height);
      if (reducedMotion) {
        renderer.render(scene, camera);
      }
    });

    resizeObserver.observe(container);
    prefersReducedMotion.addEventListener("change", handleMotionChange);
    rebuildSurface(container.clientWidth || window.innerWidth, container.clientHeight || 520);

    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      resizeObserver.disconnect();
      prefersReducedMotion.removeEventListener("change", handleMotionChange);
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
