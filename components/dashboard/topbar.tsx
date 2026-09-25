"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { NotificationMenu } from "@/components/dashboard/notification-menu";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pluralize } from "@/lib/utils";

interface SearchFieldProps {
  inputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
  showShortcutHint?: boolean;
}

function SearchField({ inputRef, className, showShortcutHint }: SearchFieldProps) {
  const { searchQuery, setSearchQuery, totalFiltered, setView, view } = usePipeline();

  return (
    <div className={className}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search opportunities..."
          aria-label="Search opportunities by company, contact, owner, stage or lead source"
          className="pl-9 pr-20 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {showShortcutHint && !searchQuery ? (
            <kbd className="hidden select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground lg:inline-flex">
              ⌘K
            </kbd>
          ) : null}
        </div>
      </div>

      {searchQuery ? (
        <button
          type="button"
          onClick={() => view !== "pipeline" && setView("pipeline")}
          className="mt-1.5 rounded text-2xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {totalFiltered} matching {pluralize(totalFiltered, "opportunity", "opportunities")}
          {view === "pipeline" ? "" : " · view pipeline"}
        </button>
      ) : null}
    </div>
  );
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const {
    exportCsv,
    openCreateDialog,
    setView,
    updateFilter,
    ownerNames,
    searchQuery,
  } = usePipeline();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { signOut, deleteAccount } = useAuth();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const currentUser = ownerNames[0] ?? "Emmanuel A.";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <SearchField
          inputRef={searchInputRef}
          showShortcutHint
          className="hidden max-w-md flex-1 md:block"
        />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <NotificationMenu />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
                onClick={() => exportCsv()}
                aria-label="Export filtered opportunities to CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export filtered opportunities (CSV)</TooltipContent>
          </Tooltip>

          <Button onClick={openCreateDialog} size="sm" className="h-9">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New opportunity</span>
            <span className="sm:hidden">New</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-0.5 rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                aria-label="Open account menu"
              >
                <OwnerAvatar name={currentUser} size="md" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[15rem]">
              <DropdownMenuLabel>{currentUser} · Sales Manager</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  updateFilter("owner", currentUser);
                  setView("pipeline");
                }}
              >
                <UserRound />
                My open pipeline
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportCsv()}>
                <Download />
                Export {searchQuery ? "matching" : "all"} opportunities
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setView("settings")}>
                <Settings />
                Workspace settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  signOut();
                  router.replace("/");
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-rose-600">
                <Trash2 />
                Delete account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchField inputRef={searchInputRef} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete account?"
        description="This demo account and its local session will be removed. You will be signed out and returned to the login page."
        confirmLabel="Delete account"
        onConfirm={() => {
          deleteAccount();
          router.replace("/");
        }}
      />
    </header>
  );
}
