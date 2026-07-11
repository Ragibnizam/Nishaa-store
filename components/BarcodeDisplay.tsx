'use client';

import { useEffect, useRef } from 'react';

interface BarcodeSVGProps {
  value: string;
  height?: number;
}

// Minimal Code39 barcode renderer (no external dependency needed)
const CODE39_CHARS: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
};

function encodeCode39(text: string): string {
  const chars = ('*' + text.toUpperCase() + '*').split('');
  return chars.map((c, i) => {
    const pattern = CODE39_CHARS[c] || CODE39_CHARS['-'];
    return (i > 0 ? '0' : '') + pattern;
  }).join('');
}

export default function BarcodeDisplay({ value, height = 50 }: BarcodeSVGProps) {
  const moduleWidth = 1.5;
  const pattern = encodeCode39(value);
  const totalWidth = pattern.length * moduleWidth;

  const bars = pattern.split('').map((bit, i) => ({
    x: i * moduleWidth,
    fill: bit === '1' ? '#000000' : 'none',
    width: moduleWidth,
  }));

  return (
    <svg width={totalWidth} height={height} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '4px auto' }}>
      {bars.map((bar, i) =>
        bar.fill !== 'none' ? (
          <rect key={i} x={bar.x} y={0} width={bar.width} height={height} fill={bar.fill} />
        ) : null
      )}
    </svg>
  );
}
