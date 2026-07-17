/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, TerraformIcon } from './Icons';

const DpadButton: React.FC<{
  onPress: () => void;
  onRelease: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
  isKeyPressed?: boolean;
}> = ({ onPress, onRelease, children, className = '', ariaLabel, isKeyPressed = false }) => {
  const [isPointerPressed, setIsPointerPressed] = useState(false);
  const activePointerId = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activePointerId.current !== null) return;
    
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Pointer capture failed.", err);
    }
    activePointerId.current = e.pointerId;

    setIsPointerPressed(true);
    onPress();
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
      setIsPointerPressed(false);
      onRelease();
    }
  };

  const isVisuallyPressed = isPointerPressed || isKeyPressed;

  return (
    <div
      role="button"
      aria-label={ariaLabel}
      className={`w-10 h-10 sm:w-14 sm:h-14 bg-gray-500/30 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white transition-transform duration-100 ease-in-out select-none touch-none ${className} ${isVisuallyPressed ? 'bg-white/40 scale-90' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onLostPointerCapture={handlePointerUpOrCancel}
    >
      {children}
    </div>
  );
};

const TerraformButton: React.FC<{
  onPress: () => void;
  onRelease: () => void;
  power: number;
}> = ({ onPress, onRelease, power }) => {
  const [isPointerPressed, setIsPointerPressed] = useState(false);
  const activePointerId = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activePointerId.current !== null) return;
    
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn("Pointer capture failed.", err);
    }
    activePointerId.current = e.pointerId;

    setIsPointerPressed(true);
    onPress();
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
      setIsPointerPressed(false);
      onRelease();
    }
  };
  
  const isFull = power >= 1.0;
  const isDepleted = power <= 0.01;
  const fillHeight = `${Math.min(1, power) * 100}%`;

  const fillColor = isFull ? 'bg-cyan-400/50' : 'bg-white/40';
  const iconColor = isFull ? 'text-cyan-300' : 'text-white';

  return (
    <div
      role="button"
      aria-label="Terraform Fractal"
      title="Terraform"
      className={`w-16 h-16 sm:w-20 sm:h-20 bg-gray-500/30 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white transition-all duration-150 ease-in-out select-none touch-none transform relative overflow-hidden ${isPointerPressed ? 'scale-95' : ''} ${isDepleted && !isPointerPressed ? 'opacity-70' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onLostPointerCapture={handlePointerUpOrCancel}
    >
      <div 
        className={`absolute bottom-0 left-0 w-full transition-colors duration-300 ${fillColor}`}
        style={{ height: fillHeight, transitionProperty: 'height, background-color', transitionTimingFunction: 'linear' }}
      />
      <TerraformIcon className={`w-8 h-8 sm:w-10 sm:h-10 relative z-10 transition-colors duration-300 ${iconColor}`} />
    </div>
  );
};


export const DpadControls: React.FC = () => {
  const { pressKey, releaseKey, cameraControlsEnabled, pressedKeys, handleTerraformPress, handleTerraformRelease, terraformPower, controlConfig } = useAppContext();

  if (!cameraControlsEnabled) {
    return null;
  }

  const keybinds = controlConfig?.keybinds || {};
  const keyForward = keybinds.forward || 'w';
  const keyBackward = keybinds.backward || 's';
  const keyStrafeLeft = keybinds.strafeLeft || 'a';
  const keyStrafeRight = keybinds.strafeRight || 'd';
  const keyAscend = keybinds.ascend || ' ';
  const keyDescend = keybinds.descend || 'shift';
  const keyPitchUp = keybinds.pitchUp || 'arrowup';
  const keyPitchDown = keybinds.pitchDown || 'arrowdown';
  const keyYawLeft = keybinds.yawLeft || 'arrowleft';
  const keyYawRight = keybinds.yawRight || 'arrowright';

  return (
    <div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-end pointer-events-none z-30" aria-hidden="true">
      {/* Left Side: Movement */}
      <div className="flex items-end gap-3 pointer-events-auto">
        <div className="grid grid-cols-3 grid-rows-3 w-28 h-28 sm:w-40 sm:h-40">
          <div className="col-start-2 row-start-1 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyForward)} onRelease={() => releaseKey(keyForward)} ariaLabel="Move Forward" isKeyPressed={pressedKeys.has(keyForward)}><ChevronUpIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-1 row-start-2 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyStrafeLeft)} onRelease={() => releaseKey(keyStrafeLeft)} ariaLabel="Move Left" isKeyPressed={pressedKeys.has(keyStrafeLeft)}><ChevronLeftIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-3 row-start-2 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyStrafeRight)} onRelease={() => releaseKey(keyStrafeRight)} ariaLabel="Move Right" isKeyPressed={pressedKeys.has(keyStrafeRight)}><ChevronRightIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-2 row-start-3 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyBackward)} onRelease={() => releaseKey(keyBackward)} ariaLabel="Move Backward" isKeyPressed={pressedKeys.has(keyBackward)}><ChevronDownIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
        </div>
        <div className="flex flex-col gap-2 h-28 sm:h-40 justify-center pb-1 sm:pb-2">
          <DpadButton onPress={() => pressKey(keyDescend)} onRelease={() => releaseKey(keyDescend)} ariaLabel="Move Down" className="!w-10 !h-16 sm:!w-12 sm:!h-20 !rounded-xl" isKeyPressed={pressedKeys.has(keyDescend)}><ChevronUpIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          <DpadButton onPress={() => pressKey(keyAscend)} onRelease={() => releaseKey(keyAscend)} ariaLabel="Move Up" className="!w-10 !h-16 sm:!w-12 sm:!h-20 !rounded-xl" isKeyPressed={pressedKeys.has(keyAscend)}><ChevronDownIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
        </div>
      </div>
      
      {/* Center: Terraform Button */}
      <div className="absolute bottom-8 sm:bottom-14 left-1/2 -translate-x-1/2 pointer-events-auto">
        <TerraformButton onPress={handleTerraformPress} onRelease={handleTerraformRelease} power={terraformPower} />
      </div>

      {/* Right Side: Rotation */}
      <div className="pointer-events-auto">
        <div className="grid grid-cols-3 grid-rows-3 w-28 h-28 sm:w-40 sm:h-40">
          <div className="col-start-2 row-start-1 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyPitchUp)} onRelease={() => releaseKey(keyPitchUp)} ariaLabel="Look Up" isKeyPressed={pressedKeys.has(keyPitchUp)}><ChevronUpIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-1 row-start-2 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyYawLeft)} onRelease={() => releaseKey(keyYawLeft)} ariaLabel="Look Left" isKeyPressed={pressedKeys.has(keyYawLeft)}><ChevronLeftIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-3 row-start-2 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyYawRight)} onRelease={() => releaseKey(keyYawRight)} ariaLabel="Look Right" isKeyPressed={pressedKeys.has(keyYawRight)}><ChevronRightIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
          <div className="col-start-2 row-start-3 flex justify-center items-center">
            <DpadButton onPress={() => pressKey(keyPitchDown)} onRelease={() => releaseKey(keyPitchDown)} ariaLabel="Look Down" isKeyPressed={pressedKeys.has(keyPitchDown)}><ChevronDownIcon className="w-5 h-5 sm:w-7 sm:h-7" /></DpadButton>
          </div>
        </div>
      </div>
    </div>
  );
};
