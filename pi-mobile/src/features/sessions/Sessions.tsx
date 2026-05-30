import { For, Show, createSignal, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Archive, ArchiveRestore, GitBranch, Pencil, Plus, Settings as SettingsIcon, Trash2 } from "lucide-solid";
import Header from "@/components/Header";
import StatusDot from "@/components/StatusDot";
import PullToRefresh from "@/components/PullToRefresh";
import SwipeActionRow from "@/components/SwipeActionRow";
import NewSessionSheet from "@/features/sessions/components/NewSessionSheet";
import RenameSheet from "@/features/sessions/components/RenameSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { sessions, loadSessions } from "@/stores/sessions";
import { connState, setConnState } from "@/stores/connection";
import {
  createSession,
  deleteSession,
  healthcheck,
  patchSession,
} from "@/lib/api";
import { getBridgeUrl } from "@/lib/settings";
import { haptic } from "@/lib/haptics";
import { relativeTime, shortPath, formatCost } from "@/lib/format";
import { KeyboardAvoidance } from "@/lib/keyboard";
import type { SessionMeta } from "@pi-mobile/protocol";

const SESSION_ACTION_WIDTH = 58;

export default function Sessions() {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [archivedView, setArchivedView] = createSignal(false);
  const [openSessionActionsId, setOpenSessionActionsId] = createSignal<string | null>(null);
  const [renameTarget, setRenameTarget] = createSignal<SessionMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<SessionMeta | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const refresh = async () => {
    try {
      const baseUrl = await getBridgeUrl();
      const ok = await healthcheck(baseUrl);
      setConnState(ok ? "connected" : "error");
      if (!ok) {
        setError(`can't reach bridge at ${baseUrl}`);
        return;
      }
      await loadSessions(baseUrl, { archived: archivedView() });
      setError(null);
    } catch (e) {
      setError(String(e));
      setConnState("error");
    }
  };

  onMount(refresh);

  const handleCreate = async (opts: {
    cwd: string;
    title: string;
    branch?: string;
  }) => {
    if (creating()) return;
    setCreating(true);
    try {
      const baseUrl = await getBridgeUrl();
      const meta = await createSession(baseUrl, opts);
      setArchivedView(false);
      await loadSessions(baseUrl, { archived: false });
      setSheetOpen(false);
      navigate(`/s/${meta.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  async function handleRename(newTitle: string) {
    const target = renameTarget();
    if (!target || saving()) return;
    setSaving(true);
    try {
      const baseUrl = await getBridgeUrl();
      await patchSession(baseUrl, target.id, { title: newTitle });
      await loadSessions(baseUrl, { archived: archivedView() });
      setRenameTarget(null);
      haptic.success();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleArchive(target: SessionMeta) {
    setOpenSessionActionsId(null);
    try {
      const baseUrl = await getBridgeUrl();
      await patchSession(baseUrl, target.id, { archived: !target.archived });
      await loadSessions(baseUrl, { archived: archivedView() });
      haptic.success();
    } catch (e) {
      setError(String(e));
    }
  }

  async function switchArchiveView(next: boolean) {
    if (archivedView() === next) return;
    setOpenSessionActionsId(null);
    setArchivedView(next);
    try {
      const baseUrl = await getBridgeUrl();
      await loadSessions(baseUrl, { archived: next });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function requestDelete(target: SessionMeta) {
    setOpenSessionActionsId(null);
    setDeleteTarget(target);
  }

  async function confirmDelete() {
    const target = deleteTarget();
    if (!target || deleting()) return;
    setDeleting(true);
    try {
      const baseUrl = await getBridgeUrl();
      await deleteSession(baseUrl, target.id);
      await loadSessions(baseUrl, { archived: archivedView() });
      setDeleteTarget(null);
      haptic.heavy();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  function closeOpenSessionActions(e: Event) {
    if (!openSessionActionsId()) return;
    const target = e.target;
    if (target instanceof Element && target.closest("[data-swipe-action-row]")) return;
    setOpenSessionActionsId(null);
  }

  return (
    <KeyboardAvoidance mode="manual">
      <div class="flex min-h-0 flex-1 flex-col" onTouchStart={closeOpenSessionActions}>
        <Header
          trailing={
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void switchArchiveView(!archivedView())}
                class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-fg-muted)] active:bg-[color:var(--color-surface)]"
                aria-label={archivedView() ? "Show active sessions" : "Show archived sessions"}
              >
                <Show when={archivedView()} fallback={<Archive size={16} />}>
                  <ArchiveRestore size={16} />
                </Show>
              </button>
              <A
                href="/settings"
                class="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-fg-muted)] active:bg-[color:var(--color-surface)]"
                aria-label="Settings"
              >
                <SettingsIcon size={16} />
              </A>
            </div>
          }
        >
          <div class="flex items-baseline gap-2">
            <span class="text-[13px] font-medium">{archivedView() ? "archived" : "sessions"}</span>
            <span class="label">{sessions().length}</span>
          </div>
        </Header>

        <Show when={error()}>
          <div class="mx-3 my-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/8 px-3 py-2 text-[12px] text-[color:var(--color-danger)]">
            {error()}
            <button
              type="button"
              onClick={refresh}
              class="ml-2 underline opacity-70 active:opacity-100"
            >
              retry
            </button>
          </div>
        </Show>

        <Show
          when={sessions().length > 0}
          fallback={
            <Show
              when={connState() === "connected" && !error()}
              fallback={null}
            >
              <div class="flex flex-1 items-center justify-center px-6 text-center">
                <p class="text-[12px] text-[color:var(--color-fg-faint)]">
                  <Show
                    when={archivedView()}
                    fallback={
                      <>
                        no sessions yet — tap{" "}
                        <span class="text-[color:var(--color-fg-muted)]">new session</span>{" "}
                        below.
                      </>
                    }
                  >
                    no archived sessions.
                  </Show>
                </p>
              </div>
            </Show>
          }
        >
          <PullToRefresh class="flex-1" onRefresh={refresh}>
            <For each={sessions()}>
              {(s) => (
                <SessionRow
                  session={s}
                  open={openSessionActionsId() === s.id}
                  onOpen={() => setOpenSessionActionsId(s.id)}
                  onClose={() => setOpenSessionActionsId(null)}
                  onRename={() => {
                    setOpenSessionActionsId(null);
                    setRenameTarget(s);
                  }}
                  onToggleArchive={() => void handleToggleArchive(s)}
                  onDelete={() => requestDelete(s)}
                />
              )}
            </For>
          </PullToRefresh>
        </Show>

        <div
          class="hairline-t sticky bottom-0 bg-[color:var(--color-bg)]/95 backdrop-blur-md p-2"
          style={{ "padding-bottom": "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSheetOpen(true);
            }}
            class="flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-strong)] text-[12px] active:bg-[color:var(--color-surface)]"
          >
            <Plus size={14} />
            new session
          </button>
        </div>

        <DeleteSessionSheet
          session={deleteTarget()}
          deleting={deleting()}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />

        <NewSessionSheet
          open={sheetOpen()}
          onCancel={() => setSheetOpen(false)}
          onCreate={handleCreate}
          creating={creating()}
        />

        <Show when={renameTarget()}>
          {(target) => (
            <RenameSheet
              open
              initialTitle={target().title}
              saving={saving()}
              onCancel={() => setRenameTarget(null)}
              onSave={handleRename}
            />
          )}
        </Show>
      </div>
    </KeyboardAvoidance>
  );
}

function SessionRow(props: {
  session: SessionMeta;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <SwipeActionRow
      open={props.open}
      actionWidth={SESSION_ACTION_WIDTH}
      actionCount={3}
      onOpen={props.onOpen}
      onClose={props.onClose}
      actions={
        <>
        <button
          type="button"
          onClick={props.onRename}
          class="flex items-center justify-center bg-[color:var(--color-surface)] text-[color:var(--color-fg-muted)] active:brightness-110"
          style={{ width: `${SESSION_ACTION_WIDTH}px` }}
          aria-label={`Rename ${props.session.title}`}
        >
          <Pencil size={17} />
        </button>
        <button
          type="button"
          onClick={props.onToggleArchive}
          class="flex items-center justify-center bg-[color:var(--color-surface-2)] text-[color:var(--color-fg-muted)] active:brightness-110"
          style={{ width: `${SESSION_ACTION_WIDTH}px` }}
          aria-label={`${props.session.archived ? "Restore" : "Archive"} ${props.session.title}`}
        >
          <Show when={props.session.archived} fallback={<Archive size={17} />}>
            <ArchiveRestore size={17} />
          </Show>
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          class="flex items-center justify-center bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)] active:brightness-110"
          style={{ width: `${SESSION_ACTION_WIDTH}px` }}
          aria-label={`Delete ${props.session.title}`}
        >
          <Trash2 size={17} />
        </button>
        </>
      }
    >
      <A
        href={`/s/${props.session.id}`}
        onContextMenu={(e) => e.preventDefault()}
        class="session-row block bg-[color:var(--color-bg)] px-3 py-3 active:bg-[color:var(--color-surface)]"
      >
        <div class="mb-1 flex items-center gap-2">
          <StatusDot status={props.session.status} />
          <span class="min-w-0 flex-1 truncate text-[13px] leading-tight">
            {props.session.title}
          </span>
          <span class="text-[10px] tabular-nums text-[color:var(--color-fg-faint)]">
            {relativeTime(props.session.updatedAt)}
          </span>
        </div>
        <div class="flex items-center gap-3 text-[11px] text-[color:var(--color-fg-muted)]">
          <span class="truncate">{shortPath(props.session.cwd, 2)}</span>
          <Show when={props.session.branch}>
            <span class="flex shrink-0 items-center gap-1">
              <GitBranch size={10} />
              {props.session.branch}
            </span>
          </Show>
          <span class="ml-auto shrink-0 tabular-nums">
            {formatCost(props.session.costUsd)}
          </span>
        </div>
      </A>
    </SwipeActionRow>
  );
}

function DeleteSessionSheet(props: {
  session: SessionMeta | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  function handleOpenChange(open: boolean) {
    if (!open) props.onCancel();
  }

  return (
    <Show when={props.session}>
      {(session) => (
        <Sheet open onOpenChange={handleOpenChange}>
          <SheetContent
            position="bottom"
            class="flex flex-col !overflow-hidden gap-0 rounded-t-[12px] border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] p-0 text-[color:var(--color-fg)] shadow-none"
            style={{ "padding-bottom": "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
          >
            <SheetHeader class="hairline-b space-y-0 px-3 py-3 pr-12 text-left">
              <SheetTitle class="min-w-0 flex-1 px-1 text-[13px] font-medium">
                delete session?
              </SheetTitle>
            </SheetHeader>

            <div class="px-3 py-3">
              <p class="text-[12px] leading-5 text-[color:var(--color-fg-muted)]">
                “<span class="text-[color:var(--color-fg)]">{session().title}</span>” will be permanently deleted. This cannot be undone.
              </p>
            </div>

            <div class="flex gap-2 px-3 pb-2 pt-1">
              <button
                type="button"
                onClick={props.onCancel}
                disabled={props.deleting}
                class="flex h-10 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-border-strong)] text-[12px] active:bg-[color:var(--color-surface)] disabled:opacity-60"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={props.onConfirm}
                disabled={props.deleting}
                class="flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[color:var(--color-danger)] text-[12px] font-medium text-[color:var(--color-bg)] active:opacity-80 disabled:opacity-60"
              >
                <Trash2 size={13} />
                {props.deleting ? "deleting…" : "delete"}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Show>
  );
}
