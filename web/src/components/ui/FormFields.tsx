import * as React from "react";
import { cn } from "../../lib/utils";


interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

function FieldWrapper({ label, error, hint, children, required, className }: FieldWrapperProps) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm font-semibold text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error && (
        <p className="mt-1.5 animate-fade-in text-xs font-medium text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
      )}
    </label>
  );
}

export const inputClasses = "mt-2 block w-full h-11 px-3.5 border-[1.5px] border-stone-200 rounded-md bg-white text-stone-900 text-[0.9375rem] transition-all placeholder:text-stone-400 hover:border-[#c9c4b9] focus:outline-none focus:border-emerald-600 focus:shadow-[0_0_0_3px_rgb(5_150_105/0.12)]";
export const inputErrorClasses = "border-red-500 hover:border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgb(239_68_68/0.1)]";
export const textareaClasses = "mt-2 block w-full min-h-[6rem] p-3 border-[1.5px] border-stone-200 rounded-md bg-white text-stone-900 text-[0.9375rem] transition-all placeholder:text-stone-400 hover:border-[#c9c4b9] focus:outline-none focus:border-emerald-600 focus:shadow-[0_0_0_3px_rgb(5_150_105/0.12)] resize-y";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leadingIcon?: React.ReactNode;
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leadingIcon, wrapperClassName, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
        {leadingIcon ? (
          <div className={cn(
            "mt-2 flex h-11 items-center gap-2 rounded-md border-[1.5px] border-stone-200 bg-white px-3 transition-all duration-150 focus-within:border-emerald-600 focus-within:shadow-[0_0_0_3px_rgb(5_150_105/0.12)] hover:border-[#c9c4b9]",
            error && inputErrorClasses
          )}>
            <span className="shrink-0 text-stone-400">{leadingIcon}</span>
            <input
              ref={ref}
              required={required}
              className={cn("h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-stone-900 placeholder:text-stone-400 outline-none", className)}
              {...props}
            />
          </div>
        ) : (
          <input
            ref={ref}
            required={required}
            className={cn(inputClasses, error && inputErrorClasses, className)}
            {...props}
          />
        )}
      </FieldWrapper>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, required, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
        <textarea
          ref={ref}
          required={required}
          className={cn(
            textareaClasses,
            error && inputErrorClasses,
            className
          )}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, wrapperClassName, required, children, className, ...props }, ref) => {
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
        <select
          ref={ref}
          required={required}
          className={cn(inputClasses, "cursor-pointer", error && inputErrorClasses, className)}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  }
);
SelectField.displayName = "SelectField";

export { Input, Textarea, SelectField };
