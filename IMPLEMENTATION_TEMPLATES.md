# DPR.ai Page Redesign - Implementation Templates

This document provides detailed TSX templates for each page type based on the Stitch reference designs.

---

## Template 1: Authentication Pages (Login/Forgot Password)

### Structure: 2-Column Split Layout
- **Left Column (col-span-4)**: Context, guardrails, support
- **Right Column (col-span-8)**: Form container

```tsx
export function AuthSplitLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
      {/* Header */}
      <header className="bg-surface-primary border-b border-border-strong h-12 flex justify-between items-center px-8 z-50">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary">DPR.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Steel Industry
          </span>
          <span className="text-sm font-medium text-primary">FACTORY OS</span>
        </div>
      </header>

      {/* Main Content: 2-Column Grid */}
      <main className="flex-grow grid grid-cols-12 gap-8 px-8 py-8 h-[calc(100vh-48px)]">
        {/* Left Column: Context & Guardrails */}
        <aside className="col-span-4 flex flex-col justify-between h-full border-r border-border-default pr-8">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-text-primary mb-3">
                {title}
              </h1>
              <p className="text-sm text-text-muted">{subtitle}</p>
            </div>

            {/* Security Status Panel */}
            <div className="bg-surface-ground border border-border-subtle rounded-lg p-6 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/5 mix-blend-screen pointer-events-none"></div>
              
              <div className="flex items-center gap-2 mb-4 border-b border-border-subtle pb-3 relative z-10">
                <ShieldCheck className="h-[18px] w-[18px] text-tertiary-container" />
                <span className="text-xs font-semibold text-tertiary-container uppercase tracking-wider">
                  Secure Connection Active
                </span>
              </div>

              <ul className="space-y-3 text-sm text-text-secondary relative z-10">
                <li className="flex items-start gap-3">
                  <Lock className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                  <span>End-to-end encryption protocols initialized.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
                  <span>Access restricted to authorized personnel only.</span>
                </li>
              </ul>
            </div>

            {/* System Status */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-text-muted uppercase">
                Core Systems Status
              </span>
              <div className="flex gap-2">
                <div className="h-1 flex-1 bg-tertiary-container rounded-full shadow-[0_0_8px_rgba(51,181,89,0.4)]"></div>
                <div className="h-1 w-1/3 bg-tertiary-container rounded-full shadow-[0_0_8px_rgba(51,181,89,0.4)]"></div>
                <div className="h-1 w-1/4 bg-border-default rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-8 mt-auto">
            <p className="text-xs font-semibold text-text-muted uppercase flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Emergency SysAdmin: EXT 4092
            </p>
          </div>
        </aside>

        {/* Right Column: Form */}
        <section className="col-span-8 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-surface-elevated border-2 border-border-strong rounded-xl p-8 shadow-xl">
              {children}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
```

---

## Template 2: Registration Pages

### Structure: Main (7 cols) + Guidelines (5 cols) on Desktop
- **Left**: Full form with multiple sections
- **Right**: Guidelines, workflow steps, compliance info

```tsx
export function RegistrationLayout({
  formContent,
  guidelinesContent,
}: {
  formContent: React.ReactNode;
  guidelinesContent: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      {/* Header - same as AuthSplitLayout */}
      <header className="bg-surface-primary border-b border-border-strong h-12 flex justify-between items-center px-8 z-50">
        {/* ... */}
      </header>

      <main className="flex-grow flex items-center justify-center p-8 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary-container/5 via-transparent to-transparent"></div>
        </div>

        <div className="max-w-6xl w-full grid grid-cols-12 gap-8 z-10">
          {/* Form (Left, 7 cols) */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-surface-elevated border-2 border-border-strong rounded-xl p-8 shadow-2xl relative overflow-hidden">
              {/* Accent line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary-container to-transparent"></div>

              {formContent}
            </div>
          </div>

          {/* Guidelines (Right, 5 cols, hidden on mobile) */}
          <div className="hidden lg:flex col-span-5 flex-col gap-6">
            {guidelinesContent}
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

## Template 3: Operational Command Centers (Dashboard, Inventory, etc.)

### Structure: Sidebar + Main Content
- **Fixed Header**: 48px
- **Layout**: Sidebar (left) + Main content (right)
- **Main content**: Action bar + Data table/grid

```tsx
export function OperationalCommandCenter({
  title,
  subtitle,
  actionBar,
  children,
}: {
  title: string;
  subtitle: string;
  actionBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      {/* Fixed Header */}
      <header className="bg-surface-primary border-b border-border-strong h-12 flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-surface-overlay rounded transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary">DPR.ai</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-text-muted uppercase">Factory OS</span>
          <Avatar />
        </div>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <main className="flex-grow flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-64 bg-surface-primary border-r border-border-default flex flex-col transition-all duration-300 overflow-y-auto",
            !sidebarOpen && "hidden"
          )}
        >
          {/* Navigation items */}
          <nav className="space-y-1 p-4">
            {/* Menu items */}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page Header */}
          <div className="bg-surface-primary border-b border-border-default px-8 py-6">
            <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
            <p className="text-sm text-text-muted mt-1">{subtitle}</p>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Action Bar */}
            {actionBar && (
              <div className="bg-surface-elevated border-b border-border-default px-8 py-4">
                {actionBar}
              </div>
            )}

            {/* Main Content */}
            <div className="p-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

## Template 4: Form Field with Icon

### Standard Input Group Pattern

```tsx
export function FormFieldWithIcon({
  label,
  icon: Icon,
  error,
  ...props
}: {
  label: string;
  icon?: React.ComponentType<{ className: string }>;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field>
      <Label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-text-muted" />
        )}
        <Input
          {...props}
          className={cn(
            "w-full bg-surface-raised border border-border-default rounded-lg py-3",
            Icon ? "pl-10 pr-3" : "px-3",
            "text-sm text-text-primary placeholder:text-text-muted",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "transition-all"
          )}
        />
      </div>
      {error && (
        <HelperText className="text-error text-xs mt-1">{error}</HelperText>
      )}
    </Field>
  );
}
```

---

## Template 5: Section with Divider and Icon Header

```tsx
export function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-1 pt-4 border-t border-border-subtle">
        {Icon && <Icon className="h-[18px] w-[18px] text-primary" />}
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-widest">
          {title}
        </h2>
      </div>

      {/* Section Content */}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
```

---

## Template 6: Workflow/Progress Map

```tsx
export function WorkflowSteps({
  steps,
}: {
  steps: Array<{
    number: number;
    title: string;
    description: string;
    completed?: boolean;
  }>;
}) {
  return (
    <div className="bg-surface-ground border border-border-subtle rounded-lg p-6">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-6">
        Provisioning Workflow
      </h3>

      <div className="space-y-4 relative pl-4">
        {/* Connecting line */}
        <div className="absolute left-1 top-0 bottom-0 w-px bg-border-strong"></div>

        {/* Steps */}
        {steps.map((step, idx) => (
          <div key={idx} className="relative flex gap-4 pb-4">
            {/* Step circle */}
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold relative z-10",
                step.completed
                  ? "bg-primary text-on-primary"
                  : "bg-surface-raised border border-border-strong text-text-muted"
              )}
            >
              {step.completed ? (
                <Check className="h-3 w-3" />
              ) : (
                step.number
              )}
            </div>

            {/* Step text */}
            <div>
              <p className="font-body-md text-body-md text-text-primary">
                {step.title}
              </p>
              <p className="font-metadata-xs text-metadata-xs text-text-muted mt-1">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Template 7: Status Panel with Glow Effect

```tsx
export function StatusPanel({
  icon: Icon,
  title,
  items,
}: {
  icon?: React.ComponentType<{ className: string }>;
  title: string;
  items: Array<{ icon: React.ComponentType<{ className: string }>; text: string }>;
}) {
  return (
    <div className="bg-surface-ground border border-border-subtle rounded-lg p-6 shadow-lg relative overflow-hidden">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-blue-500/5 mix-blend-screen pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 border-b border-border-subtle pb-4 relative z-10">
        {Icon && <Icon className="h-[18px] w-[18px] text-tertiary-container" />}
        <span className="text-xs font-semibold text-tertiary-container uppercase tracking-wider">
          {title}
        </span>
      </div>

      {/* Items */}
      <ul className="space-y-3 relative z-10">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <item.icon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
            <span className="text-sm text-text-secondary">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Usage Examples

### Login Page Implementation
```tsx
import { AuthSplitLayout } from "@/components/layouts/auth-split-layout";
import { FormFieldWithIcon } from "@/components/layouts/form-field";

export default function LoginPage() {
  return (
    <AuthSplitLayout
      title="System Access"
      subtitle="Enter credentials to interface with Factory OS mainframes."
    >
      <div className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-text-primary">Identify User</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormFieldWithIcon
          label="Operator ID / Email"
          icon={Mail}
          type="email"
          placeholder="operator.name@factory.os"
        />

        <FormFieldWithIcon
          label="Access Code"
          icon={KeyRound}
          type="password"
          placeholder="••••••••"
        />

        <Button className="w-full">Initialize Session</Button>
      </form>
    </AuthSplitLayout>
  );
}
```

---

## Key Classes Quick Reference

| Component | Classes |
|-----------|---------|
| Header | `bg-surface-primary border-b border-border-strong h-12` |
| Main Container | `grid grid-cols-12 gap-8 px-8 py-8` |
| Left Sidebar | `col-span-4 border-r border-border-default pr-8` |
| Right Form | `col-span-8 flex items-center justify-center` |
| Form Panel | `bg-surface-elevated border-2 border-border-strong rounded-xl p-8 shadow-xl` |
| Input | `bg-surface-raised border border-border-default rounded-lg py-3 focus:ring-2 focus:ring-primary` |
| Label | `text-xs font-medium text-text-secondary uppercase tracking-wider` |
| Button | `bg-primary hover:bg-primary-container text-on-primary uppercase text-xs tracking-wider py-3 rounded-lg` |
| Divider | `h-px bg-border-subtle` |
| Icon | `h-[18px] w-[18px] text-text-muted` |

---

## Next Steps for Implementation

1. **Phase 1 (Auth - 4 pages)**: 
   - ✅ Login: Use `AuthSplitLayout`
   - 🔄 Register: Use `RegistrationLayout`
   - 📋 Verify Email: Enhance with workflow graphic
   - 📋 Forgot Password: Use `AuthSplitLayout`

2. **Phase 2 (Dashboard - 4 pages)**:
   - Use `OperationalCommandCenter`
   - Add data tables with proper styling
   - Implement sidebar navigation

3. **Phase 3+ (Advanced)**:
   - Extend operational center for complex pages
   - Implement advanced data grids
   - Add multi-panel layouts
