import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

function FieldWrapper({ label, error, hint, children, required, className = "" }: FieldWrapperProps) {
  return (
    <label className={["block", className].join(" ")}>
      <span className="text-sm font-semibold text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 animate-fade-in">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
      )}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
  wrapperClassName?: string;
}

export function Input({ label, error, hint, leadingIcon, wrapperClassName, required, className = "", ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      {leadingIcon ? (
        <div className={["mt-2 flex items-center gap-2 rounded-md border-[1.5px] bg-white px-3 h-11 transition-all duration-150", error ? "border-red-400" : "border-[var(--color-border)] focus-within:border-emerald-600 focus-within:shadow-[0_0_0_3px_rgb(5_150_105/0.12)] hover:border-[#c9c4b9]"].join(" ")}>
          <span className="text-stone-400 shrink-0">{leadingIcon}</span>
          <input
            {...props}
            required={required}
            className={["h-full min-w-0 flex-1 bg-transparent outline-none text-[0.9375rem]", className].join(" ")}
          />
        </div>
      ) : (
        <input
          {...props}
          required={required}
          className={["input mt-2", error ? "input-error" : "", className].join(" ")}
        />
      )}
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function Textarea({ label, error, hint, wrapperClassName, required, className = "", ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        {...props}
        required={required}
        className={["textarea mt-2", error ? "input-error" : "", className].join(" ")}
      />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  children: ReactNode;
}

export function SelectField({ label, error, hint, wrapperClassName, required, children, className = "", ...props }: SelectFieldProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select
        {...props}
        required={required}
        className={["input mt-2 cursor-pointer", error ? "input-error" : "", className].join(" ")}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
