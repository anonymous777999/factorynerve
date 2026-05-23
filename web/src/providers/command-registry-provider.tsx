"use client";

import * as React from "react";

import type { CommandPaletteItem } from "@/components/ui/command-palette";

type CommandRegistryContextValue = {
  commands: CommandPaletteItem[];
  registerCommands: (source: string, commands: CommandPaletteItem[]) => void;
  unregisterCommands: (source: string) => void;
};

const CommandRegistryContext = React.createContext<CommandRegistryContextValue | null>(null);

export function CommandRegistryProvider({ children }: { children: React.ReactNode }) {
  const [registry, setRegistry] = React.useState<Record<string, CommandPaletteItem[]>>({});

  const registerCommands = React.useCallback((source: string, commands: CommandPaletteItem[]) => {
    setRegistry((current) => {
      if (current[source] === commands) {
        return current;
      }

      return {
        ...current,
        [source]: commands,
      };
    });
  }, []);

  const unregisterCommands = React.useCallback((source: string) => {
    setRegistry((current) => {
      if (!(source in current)) {
        return current;
      }

      const next = { ...current };
      delete next[source];
      return next;
    });
  }, []);

  const commands = React.useMemo(
    () => Object.values(registry).flat(),
    [registry],
  );

  return (
    <CommandRegistryContext.Provider value={{ commands, registerCommands, unregisterCommands }}>
      {children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry() {
  const context = React.useContext(CommandRegistryContext);

  if (!context) {
    throw new Error("useCommandRegistry must be used within a CommandRegistryProvider");
  }

  return context;
}

export function useRegisterCommands(source: string, commands: CommandPaletteItem[]) {
  const { registerCommands, unregisterCommands } = useCommandRegistry();

  React.useEffect(() => {
    registerCommands(source, commands);
    return () => unregisterCommands(source);
  }, [commands, registerCommands, source, unregisterCommands]);
}
