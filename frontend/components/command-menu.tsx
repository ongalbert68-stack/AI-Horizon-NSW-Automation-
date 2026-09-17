"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, ListTree, Home } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const DESTINATIONS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Troubleshoot a case", href: "/cases/new", icon: FilePlus2 },
  { label: "View all cases", href: "/cases", icon: ListTree },
] as const;

/**
 * Cmd/Ctrl+K palette for jumping between pages without the mouse. cmdk (via
 * shadcn's Command primitives) drives arrow-key/enter/escape/type-ahead
 * navigation, so none of that needs to be reimplemented here.
 */
export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Jump to"
      description="Navigate the app by keyboard"
    >
      <Command>
        <CommandInput placeholder="Type a page name..." />
        <CommandList>
          <CommandEmpty>No matching page.</CommandEmpty>
          <CommandGroup heading="Pages">
            {DESTINATIONS.map(({ label, href, icon: Icon }) => (
              <CommandItem key={href} value={label} onSelect={() => go(href)}>
                <Icon />
                <span>{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-end gap-1 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>Toggle with</span>
          <CommandShortcut>⌘K</CommandShortcut>
        </div>
      </Command>
    </CommandDialog>
  );
}
