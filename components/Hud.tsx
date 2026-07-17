/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';

export const Hud: React.FC = () => {
    const { 
        cameraRef, 
        renderCameraRef, 
        cameraVelocityRef, 
        isHudEnabled, 
        collisionState, 
        viewModeTransition,
        playerHealth,
        playerMaxHealth,
        score,
        isGameOver,
        aliensRef,
        playerLasersRef,
        alienLasersRef,
        particlesRef,
        screenShakeRef,
        damageFlashRef,
        triggerFireRef,
        handleRestartGame
    } = useAppContext();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showGameOverUI, setShowGameOverUI] = useState(false);

    // Track game over state to toggle overlay with a delay or instantly
    useEffect(() => {
        if (isGameOver) {
            const timer = setTimeout(() => {
                setShowGameOverUI(true);
            }, 800);
            return () => clearTimeout(timer);
        } else {
            setShowGameOverUI(false);
        }
    }, [isGameOver]);

    // Track collision state in a ref for the render loop
    const collisionStateRef = useRef(collisionState);
    useEffect(() => {
        collisionStateRef.current = collisionState;
    }, [collisionState]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isHudEnabled) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let animationFrameId: number;
        
        const render = (timestamp: number) => {
            // Handle canvas resize dynamically
            if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }

            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;

            // Apply screen shake offset before drawing
            const shake = screenShakeRef.current;
            ctx.save();
            if (shake > 0.01) {
                const shakeX = (Math.random() - 0.5) * shake * 35;
                const shakeY = (Math.random() - 0.5) * shake * 35;
                ctx.translate(shakeX, shakeY);
            }

            ctx.clearRect(-100, -100, w + 200, h + 200);

            // Opacity for cockpit elements, which fade out in chase view
            const hudAlpha = 1.0 - viewModeTransition;

            // Read camera transforms directly for max speed
            const cam = renderCameraRef.current; 
            const pitch = cam.rotation[0];
            const yaw = cam.rotation[1];
            const altitude = cameraRef.current.position[1] + 1.49; 
            const vY = cameraVelocityRef.current[1];
            const currentSpeed = Math.sqrt(
                cameraVelocityRef.current[0]**2 + 
                cameraVelocityRef.current[1]**2 + 
                cameraVelocityRef.current[2]**2
            );

            // --- STYLES & COLORS based on Collision State ---
            const currentState = collisionStateRef.current;
            let baseColorStr = '0, 255, 255'; // Cyan (Default)
            if (currentState === 'approaching') {
                baseColorStr = '255, 200, 0'; // Yellow Warning
            } else if (currentState === 'colliding') {
                baseColorStr = '255, 50, 50'; // Red Alert
            }

            // --- 3D PERSPECTIVE PROJECTION SYSTEM ---
            const project3D = (pos: [number, number, number]) => {
                const rx = pos[0] - cam.position[0];
                const ry = pos[1] - cam.position[1];
                const rz = pos[2] - cam.position[2];

                // Camera direction basis vectors
                const fwdX = Math.sin(yaw) * Math.cos(pitch);
                const fwdY = -Math.sin(pitch);
                const fwdZ = Math.cos(yaw) * Math.cos(pitch);

                const rX = Math.cos(yaw);
                const rY = 0;
                const rZ = -Math.sin(yaw);

                const upX = fwdY * rZ - fwdZ * rY;
                const upY = fwdZ * rX - fwdX * rZ;
                const upZ = fwdX * rY - fwdY * rX;

                // Projecting onto camera vectors
                const zPrime = rx * fwdX + ry * fwdY + rz * fwdZ;
                const xPrime = rx * rX + ry * rY + rz * rZ;
                const yPrime = rx * upX + ry * upY + rz * upZ;

                return { x: xPrime, y: yPrime, z: zPrime };
            };

            const fovScale = Math.min(w, h) * 0.75; // Focal length scale

            // --- DRAW PARTICLES ---
            const activeParticles = particlesRef.current;
            for (let i = 0; i < activeParticles.length; i++) {
                const p = activeParticles[i];
                const proj = project3D(p.position);
                if (proj.z > 0.1) {
                    const scrX = cx + (proj.x / proj.z) * fovScale;
                    const scrY = cy - (proj.y / proj.z) * fovScale;
                    const pSize = Math.max(1, (p.size / proj.z) * fovScale);

                    if (scrX > 0 && scrX < w && scrY > 0 && scrY < h) {
                        const alpha = p.timeToLive / p.maxLife;
                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = alpha;
                        ctx.beginPath();
                        ctx.arc(scrX, scrY, pSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1.0; // Reset alpha

            // --- DRAW PLAYER LASERS ---
            const pLasers = playerLasersRef.current;
            ctx.lineWidth = 3;
            for (let i = 0; i < pLasers.length; i++) {
                const l = pLasers[i];
                const projCurrent = project3D(l.position);
                if (projCurrent.z > 0.1) {
                    const scrX = cx + (projCurrent.x / projCurrent.z) * fovScale;
                    const scrY = cy - (projCurrent.y / projCurrent.z) * fovScale;

                    // Deduct velocity * 0.05 for trail
                    const prevPos: [number, number, number] = [
                        l.position[0] - l.velocity[0] * 0.04,
                        l.position[1] - l.velocity[1] * 0.04,
                        l.position[2] - l.velocity[2] * 0.04,
                    ];
                    const projPrev = project3D(prevPos);

                    if (projPrev.z > 0.1) {
                        const prevScrX = cx + (projPrev.x / projPrev.z) * fovScale;
                        const prevScrY = cy - (projPrev.y / projPrev.z) * fovScale;

                        ctx.strokeStyle = l.color;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = l.color;
                        ctx.beginPath();
                        ctx.moveTo(prevScrX, prevScrY);
                        ctx.lineTo(scrX, scrY);
                        ctx.stroke();
                        ctx.shadowBlur = 0; // Reset shadow
                    }
                }
            }

            // --- DRAW ALIEN LASERS ---
            const aLasers = alienLasersRef.current;
            for (let i = 0; i < aLasers.length; i++) {
                const l = aLasers[i];
                const proj = project3D(l.position);
                if (proj.z > 0.1) {
                    const scrX = cx + (proj.x / proj.z) * fovScale;
                    const scrY = cy - (proj.y / proj.z) * fovScale;
                    const size = Math.max(3, (l.size / proj.z) * fovScale);

                    if (scrX > -50 && scrX < w + 50 && scrY > -50 && scrY < h + 50) {
                        // Drawing glowing fireball
                        const grad = ctx.createRadialGradient(scrX, scrY, size * 0.2, scrX, scrY, size);
                        grad.addColorStop(0, '#ffffff');
                        grad.addColorStop(0.3, '#ffaa00');
                        grad.addColorStop(1, 'rgba(255, 60, 0, 0)');

                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.arc(scrX, scrY, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // --- DRAW ENEMIES (ALIENS) ---
            const activeAliens = aliensRef.current;
            for (let i = 0; i < activeAliens.length; i++) {
                const a = activeAliens[i];
                const proj = project3D(a.position);

                if (proj.z > 0.15) {
                    const scrX = cx + (proj.x / proj.z) * fovScale;
                    const scrY = cy - (proj.y / proj.z) * fovScale;
                    const size = (a.size / proj.z) * fovScale;

                    const onScreen = scrX > 20 && scrX < w - 20 && scrY > 20 && scrY < h - 20;

                    if (onScreen) {
                        // 1. Draw alien spacecraft vector graphic
                        ctx.strokeStyle = a.color;
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = a.color;

                        // Saucer Shape
                        ctx.beginPath();
                        ctx.ellipse(scrX, scrY, size * 1.5, size * 0.5, 0, 0, Math.PI * 2);
                        ctx.stroke();

                        // Saucer central dome
                        ctx.beginPath();
                        ctx.arc(scrX, scrY - size * 0.1, size * 0.6, Math.PI, 0);
                        ctx.stroke();

                        // Lateral details / gun barrels
                        ctx.beginPath();
                        ctx.moveTo(scrX - size * 1.5, scrY);
                        ctx.lineTo(scrX - size * 1.8, scrY + size * 0.2);
                        ctx.moveTo(scrX + size * 1.5, scrY);
                        ctx.lineTo(scrX + size * 1.8, scrY + size * 0.2);
                        ctx.stroke();

                        // Glowing pulsing engine core in the middle
                        const pulse = Math.sin(timestamp * 0.015 + i) * 0.3 + 0.7;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(scrX, scrY, size * 0.22 * pulse, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.shadowBlur = 0; // Reset glow

                        // 2. Tactical targeting frame / box
                        ctx.strokeStyle = 'rgba(255, 0, 100, 0.4)';
                        ctx.lineWidth = 1;
                        const boxS = size * 2.2;
                        
                        // Corner brackets
                        ctx.beginPath();
                        // Top-Left
                        ctx.moveTo(scrX - boxS, scrY - boxS + 10);
                        ctx.lineTo(scrX - boxS, scrY - boxS);
                        ctx.lineTo(scrX - boxS + 10, scrY - boxS);
                        // Top-Right
                        ctx.moveTo(scrX + boxS, scrY - boxS + 10);
                        ctx.lineTo(scrX + boxS, scrY - boxS);
                        ctx.lineTo(scrX + boxS - 10, scrY - boxS);
                        // Bottom-Left
                        ctx.moveTo(scrX - boxS, scrY + boxS - 10);
                        ctx.lineTo(scrX - boxS, scrY + boxS);
                        ctx.lineTo(scrX - boxS + 10, scrY + boxS);
                        // Bottom-Right
                        ctx.moveTo(scrX + boxS, scrY + boxS - 10);
                        ctx.lineTo(scrX + boxS, scrY + boxS);
                        ctx.lineTo(scrX + boxS - 10, scrY + boxS);
                        ctx.stroke();

                        // 3. Health bar above
                        const barW = size * 2.0;
                        const barH = 3;
                        const barY = scrY - boxS - 8;
                        const healthPct = a.health / a.maxHealth;

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.fillRect(scrX - barW / 2, barY, barW, barH);
                        ctx.fillStyle = healthPct > 0.4 ? '#00ffcc' : '#ff3355';
                        ctx.fillRect(scrX - barW / 2, barY, barW * healthPct, barH);

                        // 4. Label text below
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                        ctx.font = '9px monospace';
                        ctx.textAlign = 'center';
                        const distToAlien = Math.sqrt(proj.x**2 + proj.y**2 + proj.z**2);
                        const alienLabel = `${a.type.toUpperCase()}: ${distToAlien.toFixed(0)}m`;
                        ctx.fillText(alienLabel, scrX, scrY + boxS + 12);
                    } else {
                        // Target is off-screen but in front of the camera, or behind
                        drawOffScreenArrow(proj.x, proj.y, proj.z, a.color, Math.sqrt(proj.x**2 + proj.y**2 + proj.z**2));
                    }
                } else {
                    // Target is behind camera
                    drawOffScreenArrow(proj.x, proj.y, proj.z, a.color, Math.sqrt(proj.x**2 + proj.y**2 + proj.z**2));
                }
            }

            // Off-screen indicator helper
            function drawOffScreenArrow(camX: number, camY: number, camZ: number, color: string, dist: number) {
                // Determine direction vector on X-Y screen plane
                // Invert camY because 2D canvas coordinates has down as positive Y
                const ang = Math.atan2(-camY, camX);
                
                // Pulsing size and opacity
                const pulse = Math.sin(timestamp * 0.01) * 0.15 + 0.85;

                const borderX = w * 0.45;
                const borderY = h * 0.40;

                // Position on screen edge boundary
                const edgeX = cx + Math.cos(ang) * borderX;
                const edgeY = cy + Math.sin(ang) * borderY;

                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.55 * pulse;

                // Draw arrow pointer pointing to target direction
                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(ang);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-12, -7);
                ctx.lineTo(-8, 0);
                ctx.lineTo(-12, 7);
                ctx.closePath();
                ctx.fill();

                // Draw warning text
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${dist.toFixed(0)}m`, -14, 3);

                ctx.restore();
                ctx.globalAlpha = 1.0;
            }

            // --- DRAW COCKPIT GUN BARRELS & MUZZLE FLASH ---
            if (hudAlpha > 0.01) {
                ctx.strokeStyle = `rgba(0, 255, 255, ${0.45 * hudAlpha})`;
                ctx.fillStyle = `rgba(10, 40, 50, ${0.75 * hudAlpha})`;
                ctx.lineWidth = 3;

                // Gun Recoil logic (quick kickback when shooting is active)
                const isShooting = triggerFireRef.current;
                const recoil = isShooting ? 15 : 0;

                // Left Gun Barrel Outline
                ctx.beginPath();
                ctx.moveTo(50, h);
                ctx.lineTo(150 + recoil, h - 160);
                ctx.lineTo(210 + recoil, h - 150);
                ctx.lineTo(130, h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Right Gun Barrel Outline
                ctx.beginPath();
                ctx.moveTo(w - 50, h);
                ctx.lineTo(w - 150 - recoil, h - 160);
                ctx.lineTo(w - 210 - recoil, h - 150);
                ctx.lineTo(w - 130, h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Muzzle Flash
                if (isShooting) {
                    ctx.fillStyle = '#ffff00';
                    ctx.shadowBlur = 18;
                    ctx.shadowColor = '#00ffff';

                    // Left Gun Flash
                    ctx.beginPath();
                    ctx.arc(210 + recoil, h - 150, 16, 0, Math.PI * 2);
                    ctx.fill();

                    // Right Gun Flash
                    ctx.beginPath();
                    ctx.arc(w - 210 - recoil, h - 150, 16, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.shadowBlur = 0;
                }
            }

            // --- COCKPIT HUD GRAPHICS ---
            if (hudAlpha > 0.01) {
                ctx.strokeStyle = `rgba(${baseColorStr}, ${0.5 * hudAlpha})`;
                ctx.fillStyle = `rgba(${baseColorStr}, ${0.8 * hudAlpha})`;
                ctx.lineWidth = 2;
                ctx.font = 'bold 12px monospace';

                // --- HORIZON LINE ---
                const fovY = Math.PI / 2; // Assume 90 deg FOV
                const horizonOffsetY = -(pitch / (fovY / 2)) * (h / 2);
                const horizonY = cy + horizonOffsetY;

                if (horizonY > -100 && horizonY < h + 100) {
                    ctx.beginPath();
                    const gap = 100;
                    ctx.moveTo(cx - 300, horizonY); ctx.lineTo(cx - gap, horizonY);
                    ctx.moveTo(cx + gap, horizonY); ctx.lineTo(cx + 300, horizonY);
                    ctx.stroke();
                }

                // --- READOUTS ---
                const altText = `ALT: ${altitude.toFixed(2)}`;
                const vsText = `V/S: ${(vY * 10).toFixed(2)}`;

                ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * hudAlpha})`;
                ctx.fillRect(cx + 345, cy - 52, 90, 18);
                ctx.fillRect(cx + 345, cy - 32, 90, 18);

                ctx.fillStyle = `rgba(${baseColorStr}, ${0.85 * hudAlpha})`;
                ctx.textAlign = 'left';
                ctx.fillText(altText, cx + 350, cy - 40);
                ctx.fillText(vsText, cx + 350, cy - 20);

                // Heading
                const headingDeg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
                const headingText = `${headingDeg.toFixed(0)}°`;
                ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * hudAlpha})`;
                ctx.fillRect(cx - 25, 48, 50, 18);

                ctx.fillStyle = `rgba(${baseColorStr}, ${0.85 * hudAlpha})`;
                ctx.textAlign = 'center';
                ctx.fillText(headingText, cx, 61);

                // --- CLIMB RATE INDICATOR ---
                const crHeight = 100;
                const crY = cy;
                const crX = cx + 330;
                ctx.strokeStyle = `rgba(${baseColorStr}, ${0.3 * hudAlpha})`;
                ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * hudAlpha})`;
                ctx.fillRect(crX - 3, crY - crHeight / 2, 6, crHeight);
                ctx.strokeRect(crX - 3, crY - crHeight / 2, 6, crHeight);

                const vYClamped = Math.max(-0.5, Math.min(0.5, vY));
                const indicatorY = crY - (vYClamped / 0.5) * (crHeight / 2);

                ctx.fillStyle = `rgba(${baseColorStr}, ${0.85 * hudAlpha})`;
                ctx.fillRect(crX - 3, indicatorY - 2, 6, 4);
            }

            // --- CENTER WEAPON CROSSHAIR (ALWAYS VISIBLE) ---
            const crosshairAlpha = Math.max(0.75, hudAlpha);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.45 * crosshairAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Outer circle brackets
            ctx.arc(cx, cy, 30, -Math.PI/4, Math.PI/4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, 30, Math.PI * 0.75, Math.PI * 1.25);
            ctx.stroke();

            // Center dot
            ctx.beginPath();
            ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 4, cy);
            ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 15, cy);
            ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 4);
            ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 15);
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 255, 255, ${0.8 * crosshairAlpha})`;
            ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

            // --- SHIELD STATUS COCKPIT DIAL (BOTTOM HEALTHBAR) ---
            if (hudAlpha > 0.01) {
                const barW = 280;
                const barH = 14;
                const barX = cx - barW / 2;
                const barY = h - 65;

                // High-tech frame
                ctx.strokeStyle = `rgba(0, 255, 255, ${0.45 * hudAlpha})`;
                ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * hudAlpha})`;
                ctx.fillRect(barX, barY, barW, barH);
                ctx.strokeRect(barX, barY, barW, barH);

                // Side brackets
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(barX - 8, barY - 4);
                ctx.lineTo(barX - 8, barY + barH + 4);
                ctx.moveTo(barX - 8, barY + barH + 4);
                ctx.lineTo(barX + 12, barY + barH + 4);

                ctx.moveTo(barX + barW + 8, barY - 4);
                ctx.lineTo(barX + barW + 8, barY + barH + 4);
                ctx.moveTo(barX + barW + 8, barY + barH + 4);
                ctx.lineTo(barX + barW - 12, barY + barH + 4);
                ctx.stroke();

                // Draw health bar segments
                const segmentsCount = 10;
                const healthRatio = playerHealth / playerMaxHealth;
                const filledSegments = Math.ceil(healthRatio * segmentsCount);

                const segW = (barW - 14) / segmentsCount;
                const segH = barH - 4;

                for (let i = 0; i < segmentsCount; i++) {
                    const isFilled = i < filledSegments;
                    if (isFilled) {
                        ctx.fillStyle = healthRatio > 0.5 ? 'rgba(0, 255, 204, 0.85)' : healthRatio > 0.25 ? 'rgba(255, 170, 0, 0.85)' : 'rgba(255, 51, 51, 0.85)';
                        // Flashing when critical
                        if (healthRatio <= 0.25 && Math.sin(timestamp * 0.012) > 0) {
                            ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
                        }
                    } else {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                    }
                    ctx.fillRect(barX + 7 + i * (segW + 1), barY + 2, segW, segH);
                }

                // Label Text
                ctx.fillStyle = '#ffffff';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`COCKPIT SHIELD RATIO: ${(healthRatio * 100).toFixed(0)}%`, cx, barY - 8);

                // Warning Overlay on hud
                if (healthRatio <= 0.25) {
                    const flashOpacity = (Math.sin(timestamp * 0.01) * 0.4 + 0.6) * hudAlpha;
                    ctx.fillStyle = `rgba(255, 50, 50, ${flashOpacity})`;
                    ctx.font = 'bold 10px monospace';
                    ctx.fillText('WARNING: SHIELD DEPLETED - EVADE IMMEDIATE THREATS', cx, barY + barH + 18);
                }
            }

            // --- TACTICAL PANEL (TOP-LEFT PANEL) ---
            if (true) {
                const cardW = 200;
                const cardH = 90;
                const cardX = 16;
                const cardY = 80;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.fillRect(cardX, cardY, cardW, cardH);
                ctx.strokeRect(cardX, cardY, cardW, cardH);

                // Sub-header lines
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.moveTo(cardX + 10, cardY + 24);
                ctx.lineTo(cardX + cardW - 10, cardY + 24);
                ctx.stroke();

                ctx.font = 'bold 10px monospace';
                ctx.fillStyle = '#00ffff';
                ctx.textAlign = 'left';
                ctx.fillText('TACTICAL SYSTEMS INTEGRATED', cardX + 10, cardY + 16);

                ctx.font = '10px monospace';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`ALIENS ELIMINATED: ${score}`, cardX + 10, cardY + 40);
                ctx.fillText(`THREAT LEVELS:     ${activeAliens.length} IN AREA`, cardX + 10, cardY + 54);
                
                const sysStatus = playerHealth > 50 ? 'NOMINAL' : playerHealth > 25 ? 'DAMAGE DETECTED' : 'CRITICAL FAULT';
                const sysColor = playerHealth > 50 ? '#00ffcc' : playerHealth > 25 ? '#ffbb00' : '#ff3333';
                ctx.fillText(`PILOT STATUS:   `, cardX + 10, cardY + 68);
                ctx.fillStyle = sysColor;
                ctx.fillText(sysStatus, cardX + 110, cardY + 68);

                ctx.font = '7px monospace';
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText(`COORDS: X:${cam.position[0].toFixed(1)} Y:${cam.position[1].toFixed(1)} Z:${cam.position[2].toFixed(1)}`, cardX + 10, cardY + 81);
            }

            // --- RED DAMAGE VIGNETTE EFFECT ---
            const damageFlash = damageFlashRef.current;
            if (damageFlash > 0.01) {
                const grad = ctx.createRadialGradient(cx, cy, h * 0.35, cx, cy, w * 0.85);
                grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
                grad.addColorStop(1, `rgba(255, 0, 0, ${damageFlash * 0.65})`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            }

            ctx.restore(); // Restore context state

            animationFrameId = requestAnimationFrame(render);
        };

        render(0);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isHudEnabled, cameraRef, renderCameraRef, cameraVelocityRef, viewModeTransition, playerHealth, score]);

    if (!isHudEnabled) return null;

    return (
        <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center">
            {/* High-performance Overlay Canvas */}
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 z-10 pointer-events-none"
            />

            {/* Floating High-fidelity Healthbar Overlay */}
            {!isGameOver && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto bg-black/60 px-4 py-2.5 rounded-xl border border-white/15 backdrop-blur-md shadow-[0_4px_25px_rgba(0,0,0,0.6)] z-20 transition-all duration-300">
                    <div className="flex justify-between w-72 text-xs font-mono mb-1.5 text-white tracking-widest font-bold">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            SHIELD INTEGRITY
                        </span>
                        <span>{playerHealth} / {playerMaxHealth}</span>
                    </div>
                    {/* Health Bar: White represents Total Health/Capacity, Green represents Remaining Health */}
                    <div className="w-72 h-4 bg-white rounded-full overflow-hidden p-0.5 relative shadow-inner border border-white">
                        <motion.div 
                            className="h-full bg-green-500 rounded-full"
                            initial={{ width: '100%' }}
                            animate={{ width: `${Math.max(0, Math.min(100, (playerHealth / playerMaxHealth) * 100))}%` }}
                            transition={{ type: 'spring', stiffness: 90, damping: 15 }}
                        />
                    </div>
                </div>
            )}

            {/* Neon Game Over Screen Overlay */}
            <AnimatePresence>
                {showGameOverUI && (
                    <motion.div 
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-4 pointer-events-auto"
                        id="game-over-screen"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 30, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.8, y: 30, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0.2 }}
                            className="bg-gray-950 border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)] p-8 rounded-2xl max-w-md w-full text-center relative overflow-hidden"
                            id="game-over-card"
                        >
                            {/* Scanning line animation */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500/40 animate-pulse" />

                            <h2 className="text-4xl font-black tracking-widest text-red-500 uppercase mb-2 font-sans animate-pulse">
                                SYSTEM DEFICIT
                            </h2>
                            <p className="text-gray-400 text-xs font-mono tracking-widest uppercase mb-6">
                                PILOT SHIELD CAPACITORS CRUSHED
                            </p>

                            <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-4 mb-6 font-mono">
                                <div className="flex justify-between items-center text-sm mb-2 text-gray-300">
                                    <span>FINAL SCORE</span>
                                    <span className="text-red-400 font-bold text-lg">
                                        {score.toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-left text-xs text-red-300/80 leading-relaxed mt-2 border-t border-red-500/10 pt-2">
                                    Tactical systems register complete cockpit failure in the deep alien sector. Telemetry stream stopped.
                                </div>
                            </div>

                            <p className="text-gray-300 text-xs text-center font-sans max-w-sm mb-6 leading-relaxed bg-gray-900/50 p-3 rounded-lg border border-white/5">
                                <span className="font-semibold text-cyan-400 block mb-1">PRO-FLIGHT TACTICS:</span>
                                Use <strong className="text-white bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">W / S</strong> to accelerate/decelerate, <strong className="text-white bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">Mouse Left-Click</strong> or <strong className="text-white bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">F Key</strong> to fire dual lasers! Hover strategically to dodge orange plasma spheres.
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRestartGame}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold tracking-widest text-sm uppercase py-4 rounded-xl shadow-lg shadow-red-950/50 transition-colors border border-red-400 cursor-pointer"
                                id="btn-restart-game"
                            >
                                RESPOND & REBOOT COCKPIT
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
