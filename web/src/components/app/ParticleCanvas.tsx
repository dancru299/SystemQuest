"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
};

const COLORS = ["rgba(179,136,255,0.55)", "rgba(255,215,0,0.45)", "rgba(100,255,218,0.35)"];

export function ParticleCanvas({ disabled }: { disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawingCanvas = canvas;
    const drawingContext = ctx;

    let animationId = 0;
    let hidden = document.hidden;
    const particles: Particle[] = [];

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      drawingCanvas.width = window.innerWidth * ratio;
      drawingCanvas.height = window.innerHeight * ratio;
      drawingCanvas.style.width = `${window.innerWidth}px`;
      drawingCanvas.style.height = `${window.innerHeight}px`;
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seed() {
      particles.length = 0;
      const count = window.innerWidth < 768 ? 28 : 60;
      for (let index = 0; index < count; index += 1) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -0.08 - Math.random() * 0.16,
          size: 1 + Math.random() * 2,
          color: COLORS[index % COLORS.length],
        });
      }
    }

    function frame() {
      if (!hidden) {
        drawingContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.y < -10) particle.y = window.innerHeight + 10;
          if (particle.x < -10) particle.x = window.innerWidth + 10;
          if (particle.x > window.innerWidth + 10) particle.x = -10;
          drawingContext.fillStyle = particle.color;
          drawingContext.fillRect(particle.x, particle.y, particle.size, particle.size);
        }
      }
      animationId = requestAnimationFrame(frame);
    }

    function visibilityHandler() {
      hidden = document.hidden;
    }

    resize();
    seed();
    frame();

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [disabled]);

  if (disabled) return null;
  return <canvas ref={canvasRef} className="particle-canvas pointer-events-none fixed inset-0 z-0 opacity-80" />;
}
