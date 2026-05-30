# MCP Governance Usage Guide

## For AI Agents

### Before Making Any Changes

1. **Read relevant governance files**
   ```
   .mcp/governance/product-memory/visual-doctrine.md
   .mcp/governance/product-memory/anti-patterns.md
   .mcp/governance/frontend-architecture/appshell-doctrine.md (if layout change)
   .mcp/governance/design-system/typography-rules.md (if typography change)
   .mcp/governance/design-system/color-philosophy.md (if color change)
   .mcp/governance/engineering/forbidden-mutations.md
   ```

2. **Check reference index**
   ```
   .mcp/memory/reference-index.json
   ```

3. **Review decision log**
   ```
   .mcp/memory/decision-log.json
   ```

### Making Changes

#### Typography Changes
1. Read `.mcp/governance/design-system/typography-rules.md`
2. Verify: Sentence case, Inter font, 14px body
3. Check anti-patterns: No UPPERCASE, no monospace for UI
4. Implement following rules
5. Test across breakpoints

#### Color Changes
1. Read `.mcp/governance/design-system/color-philosophy.md`
2. Verify: Single indigo accent #6366f1
3. Check anti-patterns: No gradients, no glow, no multiple accents
4. Use design tokens from `web/src/styles/tokens.css`
5. Test in light and dark mode

#### Layout Changes
1. Read `.mcp/governance/frontend-architecture/appshell-doctrine.md`
2. Read `.mcp/governance/frontend-architecture/scroll-ownership.md`
3. Verify: AppShell owns scroll, explicit height, min-h-0 on flex children
4. Check forbidden mutations: No page-level scroll
5. Test scroll behavior across breakpoints

#### Spacing Changes
1. Read `.mcp/governance/design-system/spacing-rhythm.md`
2. Verify: 4px base scale, consistent spacing
3. Check anti-patterns: No random values, no cramped spacing
4. Use semantic tokens (--space-xs, --space-sm, etc.)
5. Test responsive spacing

### Validation Checklist

Before committing changes:

- [ ] Read relevant governance files
- [ ] Checked anti-patterns.md
- [ ] Verified against visual doctrine
- [ ] Used design tokens (no arbitrary values)
- [ ] Tested responsively (mobile, tablet, desktop)
- [ ] Tested scroll behavior (if layout change)
- [ ] Tested accessibility (contrast, focus, keyboard)
- [ ] No forbidden mutations
- [ ] Follows emotional direction (calm, intelligent, professional)
- [ ] Matches reference products (Linear, Stripe, not SOC dashboards)

### Common Workflows

#### Workflow 1: Add New Button
```
1. Read: typography-rules.md, color-philosophy.md
2. Verify: Sentence case, indigo accent, 14px text
3. Implement:
   <button className="bg-[#6366f1] text-white px-4 py-2 rounded-md">
     Save changes
   </button>
4. Test: Hover, focus, active states
5. Verify: No UPPERCASE, no gradient, proper spacing
```

#### Workflow 2: Add New Page Layout
```
1. Read: appshell-doctrine.md, scroll-ownership.md
2. Verify: Page renders into AppShell's scroll container
3. Implement:
   <div className="p-6 space-y-6">
     <h1>Page Title</h1>
     <div>Content</div>
   </div>
4. Test: Page scrolls, no page-level scroll container
5. Verify: Sticky headers work, responsive behavior correct
```

#### Workflow 3: Add New Table
```
1. Read: typography-rules.md, spacing-rhythm.md, scroll-ownership.md
2. Verify: 13px cells, 40px rows, explicit height if scrollable
3. Implement:
   <div className="h-[calc(100dvh-200px)] overflow-y-auto">
     <table>
       <thead>
         <tr className="h-10">
           <th className="px-3 py-2 text-[12px]">Column</th>
         </tr>
       </thead>
       <tbody>
         <tr className="h-10">
           <td className="px-3 py-2 text-[13px]">Data</td>
         </tr>
       </tbody>
     </table>
   </div>
4. Test: Table scrolls independently, sticky headers work
5. Verify: Responsive, accessible, proper spacing
```

#### Workflow 4: Update Colors
```
1. Read: color-philosophy.md, anti-patterns.md
2. Verify: Single indigo accent, no gradients
3. Check: Design tokens in web/src/styles/tokens.css
4. Implement: Use tokens (--color-*, --status-*, --surface-*)
5. Test: Light and dark mode
6. Verify: No gradients, no glow, good contrast
```

### When to Get Approval

#### Changes That Need Approval
1. Modifying AppShell (`web/src/components/app-shell.tsx`)
2. Changing design tokens (`web/src/styles/tokens.css`)
3. Modifying global styles (`web/src/app/globals.css`)
4. Changing scroll ownership architecture
5. Introducing new design patterns
6. Breaking changes

#### How to Request Approval
1. Document the change and reason
2. Show before/after (screenshots/videos)
3. List affected files and side effects
4. Demonstrate testing (responsive, scroll, accessibility)
5. Explain why existing patterns don't work
6. Get explicit approval before implementing

### Updating Governance

#### When to Update
- Architectural decisions made
- New patterns introduced
- Design system changes
- Breaking changes

#### What to Update
1. **decision-log.json**: Add new decision with rationale
2. **Governance docs**: Update relevant .md files
3. **reference-index.json**: Update if new files added
4. **anti-patterns.md**: Add new anti-patterns discovered

#### How to Update
```
1. Make the change
2. Update decision-log.json:
   {
     "id": "011",
     "date": "2024-01-XX",
     "category": "design|architecture|engineering",
     "title": "Decision Title",
     "decision": "What was decided",
     "rationale": "Why this decision was made",
     "alternatives": ["What was considered and rejected"],
     "impact": "How this affects the codebase",
     "status": "active"
   }
3. Update relevant governance .md files
4. Update reference-index.json if needed
5. Commit with clear message
```

## For Human Developers

### Quick Reference

#### Visual Rules
- ✅ Sentence case, Inter font, 14px body, single indigo accent
- ❌ UPPERCASE, monospace UI, gradients, glow effects, multiple accents

#### Architecture Rules
- ✅ AppShell owns scroll, explicit height, min-h-0 on flex children
- ❌ Page-level scroll, implicit height, no min-h-0

#### Spacing Rules
- ✅ 4px scale, 40px rows, 20-24px card padding, consistent gaps
- ❌ Random values, cramped spacing, inconsistent gaps

### File Locations

#### Governance Files
```
.mcp/governance/
├── product-memory/
│   ├── visual-doctrine.md
│   ├── emotional-direction.md
│   └── anti-patterns.md
├── frontend-architecture/
│   ├── appshell-doctrine.md
│   └── scroll-ownership.md
├── design-system/
│   ├── typography-rules.md
│   ├── color-philosophy.md
│   └── spacing-rhythm.md
└── engineering/
    ├── implementation-rules.md
    └── forbidden-mutations.md
```

#### Memory Files
```
.mcp/memory/
├── reference-index.json
└── decision-log.json
```

#### Codebase Files
```
web/src/styles/tokens.css          (design tokens)
web/src/app/globals.css             (global styles)
web/src/components/app-shell.tsx    (AppShell)
web/tailwind.config.ts              (Tailwind config)
```

### Common Tasks

#### Task: Review PR for Visual Compliance
```
1. Check typography: Sentence case? Inter font? 14px body?
2. Check colors: Single indigo accent? No gradients?
3. Check spacing: 4px scale? Consistent gaps?
4. Check layout: Scroll ownership correct?
5. Check anti-patterns: Any forbidden mutations?
6. Verify: Matches visual doctrine and emotional direction
```

#### Task: Onboard New Developer
```
1. Read: .mcp/README.md
2. Read: .mcp/governance/product-memory/visual-doctrine.md
3. Read: .mcp/governance/product-memory/anti-patterns.md
4. Read: .mcp/governance/frontend-architecture/appshell-doctrine.md
5. Review: .mcp/memory/reference-index.json
6. Review: .mcp/memory/decision-log.json
7. Practice: Make small change following governance
```

#### Task: Debug Layout Issue
```
1. Read: .mcp/governance/frontend-architecture/scroll-ownership.md
2. Check: AppShell has overflow-y-auto on .factory-workstation-frame
3. Check: Page doesn't create scroll container
4. Check: Scroll containers have explicit height
5. Check: Flex children have min-h-0 if scrolling
6. Test: Scroll behavior across breakpoints
```

### Emergency Procedures

#### Production is Broken
```
1. Identify issue (error logs, reproduce bug)
2. Quick fix (minimal change to fix issue)
3. Test fix (verify it works)
4. Deploy immediately
5. Create follow-up task (proper fix)
6. Document exception (why it was necessary)
7. Update governance (prevent future issues)
```

#### Layout is Unstable
```
1. Check: .factory-workstation-frame has overflow-y-auto
2. Check: No page-level scroll containers
3. Check: Explicit height on scroll containers
4. Check: min-h-0 on flex children that scroll
5. Revert: Recent AppShell changes if needed
6. Test: Scroll behavior across breakpoints
```

## Summary

### For AI Agents
1. **Read governance docs** before making changes
2. **Check anti-patterns** to avoid forbidden mutations
3. **Use design tokens** - no arbitrary values
4. **Test thoroughly** - responsive, scroll, accessibility
5. **Update governance** - document decisions

### For Human Developers
1. **Review governance** when onboarding
2. **Check compliance** when reviewing PRs
3. **Follow patterns** when implementing features
4. **Get approval** for architectural changes
5. **Update docs** when making decisions
