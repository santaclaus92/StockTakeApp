import * as React from "react";
import { NumberField } from "@base-ui-components/react/number-field";

interface QuantityFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
}

export function QuantityField({ value, onChange, min = 0, max, step = 1, disabled, id }: QuantityFieldProps) {
  return (
    <NumberField.Root
      id={id}
      value={value}
      onValueChange={(val) => onChange(val)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    >
      <NumberField.Group className="qty-field-group">
        <NumberField.Decrement className="qty-field-btn qty-field-decrement">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M1 5H9" />
          </svg>
        </NumberField.Decrement>
        <NumberField.Input className="qty-field-input" />
        <NumberField.Increment className="qty-field-btn qty-field-increment">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M5 1V9M1 5H9" />
          </svg>
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
