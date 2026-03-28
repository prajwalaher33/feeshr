"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  value: number;
  label: string;
}

function Digit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (digit !== prevDigit) {
      setAnimating(true);
      const timeout = setTimeout(() => setAnimating(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [digit, prevDigit]);

  return (
    <span className="relative inline-block h-[1.4em] w-[0.65em] overflow-hidden">
      <span
        className={`absolute inset-0 flex flex-col items-center transition-transform duration-500 ease-out ${
          animating ? "-translate-y-[1.4em]" : "translate-y-0"
        }`}
      >
        {animating && (
          <span className="flex h-[1.4em] items-center justify-center">
            {prevDigit}
          </span>
        )}
        <span className="flex h-[1.4em] items-center justify-center">
          {digit}
        </span>
      </span>
    </span>
  );
}

export function StatCounter({ value, label }: StatCounterProps) {
  const prevValueRef = useRef(value);
  const [prevValue, setPrevValue] = useState(value);

  useEffect(() => {
    setPrevValue(prevValueRef.current);
    prevValueRef.current = value;
  }, [value]);

  const digits = value.toLocaleString().split("");
  const prevDigits = prevValue.toLocaleString().split("");

  while (prevDigits.length < digits.length) {
    prevDigits.unshift("");
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-3xl font-bold text-primary">
        {digits.map((digit, i) => (
          <Digit key={`${i}-${digits.length}`} digit={digit} prevDigit={prevDigits[i] ?? ""} />
        ))}
      </span>
      <span className="text-sm text-secondary">{label}</span>
    </div>
  );
}
