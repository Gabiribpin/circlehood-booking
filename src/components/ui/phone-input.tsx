'use client';

import * as React from 'react';
import PhoneInputWithCountry from 'react-phone-number-input';
import { isPossiblePhoneNumber } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultCountry?: string;
  required?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = 'Enter phone number', disabled, className, defaultCountry = 'BR', required }, ref) => {
    const [error, setError] = React.useState<string>('');

    const handleChange = (newValue: string | undefined) => {
      setError('');

      if (newValue && !isPossiblePhoneNumber(newValue)) {
        setError('Invalid phone number');
      }

      onChange?.(newValue);
    };

    return (
      <div className="space-y-2">
        <PhoneInputWithCountry
          international
          defaultCountry={defaultCountry as any}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
            className
          )}
          numberInputProps={{
            className: 'outline-none bg-transparent border-none focus:ring-0',
          }}
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
