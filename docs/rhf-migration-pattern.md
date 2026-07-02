# React Hook Form Migration Pattern

## Step 5.5 — Standardize Form Handling

**Goal:** Replace raw `useState`-based forms with `FormWrapper` + `FormField` for consistent validation, accessibility, and maintainability.

---

## Before / After Example

### Before — Raw `useState` + manual validation

```tsx
"use client";

import { useState } from "react";
import { Input, Label, HelperText, Field } from "@/components/ui/field";

type ContactForm = {
  name: string;
  email: string;
  message: string;
};

export function ContactFormOld() {
  const [form, setForm] = useState<ContactForm>({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.includes("@")) next.email = "Invalid email";
    if (form.message.length < 10) next.message = "Must be at least 10 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    console.log("Submitted:", form);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field validationState={errors.name ? "invalid" : "default"}>
        <Label required>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        {errors.name && <HelperText validationState="invalid">{errors.name}</HelperText>}
      </Field>

      <Field validationState={errors.email ? "invalid" : "default"}>
        <Label required>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
        {errors.email && <HelperText validationState="invalid">{errors.email}</HelperText>}
      </Field>

      <Field validationState={errors.message ? "invalid" : "default"}>
        <Label required>Message</Label>
        <textarea
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
        />
        {errors.message && <HelperText validationState="invalid">{errors.message}</HelperText>}
      </Field>

      <button type="submit">Submit</button>
    </form>
  );
}
```

### After — `FormWrapper` + `FormField` + Zod schema

```tsx
"use client";

import { z } from "zod";
import { FormWrapper } from "@/components/ui/form-wrapper";
import { FormField } from "@/components/ui/form-field";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Must be at least 10 characters"),
});

type ContactForm = z.infer<typeof contactSchema>;

export function ContactFormNew() {
  const handleSubmit = (data: ContactForm) => {
    console.log("Submitted:", data);
  };

  return (
    <FormWrapper schema={contactSchema} onSubmit={handleSubmit}>
      <FormField
        name="name"
        label="Name"
        placeholder="Your name"
        required
      />
      <FormField
        name="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        required
      />
      <FormField
        name="message"
        label="Message"
        placeholder="Tell us what you think..."
        required
      />
      <button
        type="submit"
        className="rounded-md bg-accent px-4 py-2 text-white"
      >
        Submit
      </button>
    </FormWrapper>
  );
}
```

**What improved:**
- **Validation** — centralized Zod schema instead of ad-hoc `if` checks
- **Error display** — automatic via `errors[name]` from RHF context
- **Code size** — ~50 lines → ~25 lines
- **Type safety** — `z.infer<typeof schema>` derives the form type
- **Accessibility** — `aria-invalid`, `role="alert"`, `aria-describedby` auto-wired

---

## Top 5 Forms to Migrate First

| # | Form | File | Rationale |
|---|---|---|---|
| 1 | **Login form** | `src/app/login/page.tsx` | Highest traffic; validation errors block 100% of submissions |
| 2 | **Register form** | `src/app/register/page.tsx` | Critical onboarding path; email/password validation must be correct |
| 3 | **Profile / Settings** | `src/components/settings-page.tsx` | Complex multi-field form with save button — benefits most from auto-validation |
| 4 | **Attendance shift form** | `src/features/attendance/attendance-page.tsx` | Factory operators enter shift data; validation prevents bad data |
| 5 | **Approval action form** | `src/components/approval-queue-workspace.tsx` | One typo can reject/approve the wrong thing; Zod catches it |

---

## Migration Checklist

For each form converted:

1. [ ] Define a Zod schema (`z.object({ ... })`)
2. [ ] Derive the form type (`z.infer<typeof schema>`)
3. [ ] Replace `<form>` + `useState` with `<FormWrapper schema={...}>`
4. [ ] Replace `<Field>` + `<Input>` with `<FormField name="..." label="...">`
5. [ ] Remove manual validation / error state
6. [ ] Run `npm run typecheck` to verify types
7. [ ] Run the form manually — submit valid + invalid data

---

## Validation After

```bash
cd web
npm run build
# Converted forms must still validate correctly end-to-end
```
