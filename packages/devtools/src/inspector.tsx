import * as React from "react";
import {
  Copy,
  Download,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DevtoolsRecord, DevtoolsStore } from "./index.js";

export interface DevtoolsInspectorProps {
  readonly store: DevtoolsStore;
  readonly onClose: () => void;
  readonly onCopy?: (value: string) => void | Promise<void>;
}

type TimelineFilter = "all" | "event-observed" | "decision" | "dom-delivery";

function recordKey(record: DevtoolsRecord): string {
  return String(record.captureSequence);
}

function recordTitle(record: DevtoolsRecord): string {
  if (record.kind === "dom-delivery")
    return `${record.deliveryStatus ?? "delivery"} via ${record.deliveryMethod ?? "browser"}`;
  return record.kind === "event-observed"
    ? (record.sourceType ?? "Observed event")
    : (record.reason ?? record.disposition ?? "Runtime decision");
}

function recordSummary(record: DevtoolsRecord): string {
  const parts = [
    record.disposition,
    record.sourceType,
    record.responseId,
    record.toolId,
    record.interactionId,
    record.announcementId,
    record.deliveryMethod,
    record.deliveryStatus,
  ].filter((value): value is string => Boolean(value));
  return parts.join(" · ") || "No correlated entity";
}

function formatTime(value: number): string {
  if (value >= 10_000_000_000)
    return new Date(value).toISOString().slice(11, 23);
  return `${value.toLocaleString()} ms`;
}

function useStoreSnapshot(store: DevtoolsStore) {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

function SnapshotCard({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: number;
  readonly detail: string;
}) {
  return (
    <Card className="ga-inspector-metric" size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value.toLocaleString()}</CardTitle>
      </CardHeader>
      <CardContent>{detail}</CardContent>
    </Card>
  );
}

function QueueTable({ store }: { readonly store: DevtoolsStore }) {
  const snapshot = useStoreSnapshot(store);
  const runtimes = Object.entries(snapshot.runtimeSnapshots);
  return (
    <div className="ga-inspector-runtime-grid">
      {runtimes.map(([id, runtime]) => (
        <Card className="ga-inspector-runtime-card" key={id}>
          <CardHeader>
            <div className="ga-inspector-card-heading">
              <div>
                <CardDescription>Attached runtime</CardDescription>
                <CardTitle>{id}</CardTitle>
              </div>
              <Badge variant="secondary">{runtime.pendingCount} pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="ga-inspector-definition-list">
              <div>
                <dt>Minimum gap</dt>
                <dd>{runtime.policy.minimumGapMs} ms</dd>
              </div>
              <div>
                <dt>Queue capacity</dt>
                <dd>{runtime.policy.maxQueueSize}</dd>
              </div>
              <div>
                <dt>Responses</dt>
                <dd>{runtime.responses.length}</dd>
              </div>
              <div>
                <dt>Tools</dt>
                <dd>{runtime.tools.length}</dd>
              </div>
            </dl>
            <Separator />
            <div className="ga-inspector-subsection">
              <span className="ga-inspector-subsection-title">
                Queue & schedule
              </span>
              {runtime.pending.announcements.length +
                runtime.pending.flushes.length ===
              0 ? (
                <p className="ga-inspector-empty">
                  No pending work is observable.
                </p>
              ) : (
                <ul className="ga-inspector-queue-list">
                  {runtime.pending.announcements.map((item) => (
                    <li key={item.id}>
                      <Badge variant="outline">{item.channel}</Badge>
                      <span>{item.sourceType}</span>
                      <time>due {formatTime(item.dueAt)}</time>
                    </li>
                  ))}
                  {runtime.pending.flushes.map((item) => (
                    <li key={`${item.responseId}:${item.epoch}`}>
                      <Badge variant="outline">flush</Badge>
                      <span>{item.responseId}</span>
                      <time>due {formatTime(item.dueAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {runtimes.length === 0 ? (
        <Card className="ga-inspector-empty-card">
          <CardHeader>
            <CardTitle>No runtime attached</CardTitle>
            <CardDescription>
              Attach a runtime to start a local, redacted inspection session.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}

function Timeline({ store }: { readonly store: DevtoolsStore }) {
  const snapshot = useStoreSnapshot(store);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<TimelineFilter>("all");
  const [selectedKey, setSelectedKey] = React.useState<string | undefined>();
  const records = snapshot.records
    .filter((record) => {
      if (filter !== "all" && record.kind !== filter) return false;
      const haystack = [
        record.runtimeId,
        record.kind,
        record.sourceType,
        record.disposition,
        record.reason,
        record.responseId,
        record.toolId,
        record.interactionId,
        record.announcementId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .slice()
    .reverse();
  const selected = snapshot.records.find(
    (record) => recordKey(record) === selectedKey,
  );
  return (
    <div className="ga-inspector-timeline">
      <div className="ga-inspector-timeline-toolbar">
        <label className="ga-inspector-search">
          <Search aria-hidden="true" size={15} strokeWidth={1.8} />
          <Input
            aria-label="Search trace"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search safe metadata"
            type="search"
            value={query}
          />
        </label>
        <div
          aria-label="Timeline filter"
          className="ga-inspector-filter-group"
          role="group"
        >
          {(["all", "event-observed", "decision", "dom-delivery"] as const).map(
            (value) => (
              <Button
                aria-pressed={filter === value}
                key={value}
                onClick={() => setFilter(value)}
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
              >
                {value === "all"
                  ? "All"
                  : value === "decision"
                    ? "Decisions"
                    : value === "dom-delivery"
                      ? "Delivery"
                      : "Events"}
              </Button>
            ),
          )}
        </div>
      </div>
      <ResizablePanelGroup
        className="ga-inspector-timeline-split"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize={64} minSize={42}>
          <ScrollArea className="ga-inspector-trace-scroll">
            <ol className="ga-inspector-trace-list">
              {records.map((record) => {
                const selectedRecord = recordKey(record) === selectedKey;
                return (
                  <li key={recordKey(record)}>
                    <button
                      aria-current={selectedRecord ? "true" : undefined}
                      className="ga-inspector-trace-row"
                      onClick={() => setSelectedKey(recordKey(record))}
                      type="button"
                    >
                      <time>{formatTime(record.at)}</time>
                      <span className="ga-inspector-trace-kind">
                        {record.kind === "decision"
                          ? "Decision"
                          : record.kind === "dom-delivery"
                            ? "Delivery"
                            : "Observed"}
                      </span>
                      <span className="ga-inspector-trace-title">
                        {recordTitle(record)}
                      </span>
                      <span className="ga-inspector-trace-summary">
                        {recordSummary(record)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {records.length === 0 ? (
                <li className="ga-inspector-empty">
                  No trace entries match these filters.
                </li>
              ) : null}
            </ol>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={36} minSize={28}>
          <aside
            aria-label="Selected trace detail"
            className="ga-inspector-detail"
          >
            {selected ? (
              <>
                <div className="ga-inspector-detail-heading">
                  <Badge variant="secondary">{selected.kind}</Badge>
                  <strong>{recordTitle(selected)}</strong>
                </div>
                <dl className="ga-inspector-definition-list">
                  <div>
                    <dt>Capture sequence</dt>
                    <dd>{selected.captureSequence}</dd>
                  </div>
                  {selected.sequence !== undefined ? (
                    <div>
                      <dt>Runtime sequence</dt>
                      <dd>{selected.sequence}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Runtime</dt>
                    <dd>{selected.runtimeId}</dd>
                  </div>
                  <div>
                    <dt>Observed at</dt>
                    <dd>{formatTime(selected.at)}</dd>
                  </div>
                  {selected.dueAt !== undefined ? (
                    <div>
                      <dt>Due at</dt>
                      <dd>{formatTime(selected.dueAt)}</dd>
                    </div>
                  ) : null}
                  {selected.delayMs !== undefined ? (
                    <div>
                      <dt>Delay</dt>
                      <dd>{selected.delayMs} ms</dd>
                    </div>
                  ) : null}
                </dl>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              </>
            ) : (
              <p className="ga-inspector-empty">
                Select a trace entry to inspect safe, structured fields.
              </p>
            )}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function DevtoolsInspector({
  store,
  onClose,
  onCopy,
}: DevtoolsInspectorProps) {
  const snapshot = useStoreSnapshot(store);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<string>();
  const copyRequest = React.useRef(0);
  const copyStatusTimer = React.useRef<number | undefined>(undefined);
  const commandTriggerRef = React.useRef<HTMLButtonElement>(null);
  const commandInputRef = React.useRef<HTMLInputElement>(null);
  const commandWasOpen = React.useRef(false);
  React.useEffect(() => {
    if (commandOpen) commandInputRef.current?.focus();
    else if (commandWasOpen.current) commandTriggerRef.current?.focus();
    commandWasOpen.current = commandOpen;
  }, [commandOpen]);
  React.useEffect(() => {
    if (!copyStatus || copyStatus === "Copying trace") return;
    copyStatusTimer.current = window.setTimeout(
      () => setCopyStatus(undefined),
      1_800,
    );
    return () => {
      if (copyStatusTimer.current !== undefined)
        window.clearTimeout(copyStatusTimer.current);
      copyStatusTimer.current = undefined;
    };
  }, [copyStatus]);
  const closeInspector = () => {
    copyRequest.current += 1;
    commandWasOpen.current = false;
    setCommandOpen(false);
    if (copyStatusTimer.current !== undefined)
      window.clearTimeout(copyStatusTimer.current);
    copyStatusTimer.current = undefined;
    setCopyStatus(undefined);
    onClose();
  };
  const runtimeCount = snapshot.runtimeIds.length;
  const queued = Object.values(snapshot.runtimeSnapshots).reduce(
    (count, runtime) => count + runtime.pendingCount,
    0,
  );
  const deliveries = snapshot.records.filter(
    (record) => record.kind === "dom-delivery",
  ).length;
  const copyTrace = async () => {
    const request = ++copyRequest.current;
    const serialized = JSON.stringify(store.exportTrace(), null, 2);
    setCopyStatus(onCopy ? "Copying trace" : "Copy unavailable");
    if (!onCopy) return;
    try {
      await onCopy(serialized);
      if (request === copyRequest.current) setCopyStatus("Trace copied");
    } catch {
      if (request === copyRequest.current) setCopyStatus("Copy unavailable");
    }
  };
  const runCommand = (command: "capture" | "refresh" | "clear" | "export") => {
    if (command === "capture") {
      if (snapshot.paused) store.resumeCapture();
      else store.pauseCapture();
    }
    if (command === "refresh") store.refreshSnapshots();
    if (command === "clear") store.clear();
    if (command === "export") void copyTrace();
    setCommandOpen(false);
  };

  return (
    <section
      aria-label="Generative accessibility runtime inspector"
      className="ga-inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (commandOpen) setCommandOpen(false);
          else closeInspector();
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          event.stopPropagation();
          setCommandOpen((open) => !open);
        }
      }}
    >
      <header className="ga-inspector-header">
        <div className="ga-inspector-title-group">
          <div className="ga-inspector-mark" aria-hidden="true">
            GA
          </div>
          <div>
            <p>LOCAL DIAGNOSTICS</p>
            <h2>Runtime inspector</h2>
          </div>
        </div>
        <div className="ga-inspector-header-actions">
          <Badge variant={snapshot.paused ? "outline" : "secondary"}>
            {snapshot.paused ? "Capture paused" : "Capturing"}
          </Badge>
          <Button
            ref={commandTriggerRef}
            onClick={() => setCommandOpen((open) => !open)}
            size="sm"
            variant="outline"
          >
            <Settings2 aria-hidden="true" size={14} />
            Commands
          </Button>
          <Button
            aria-label="Close inspector"
            onClick={closeInspector}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden="true" size={17} />
          </Button>
        </div>
      </header>
      {commandOpen ? (
        <div
          className="ga-inspector-command"
          role="dialog"
          aria-label="Inspector commands"
        >
          <Command>
            <CommandInput
              ref={commandInputRef}
              placeholder="Find an inspector action"
            />
            <CommandList>
              <CommandEmpty>No local action found.</CommandEmpty>
              <CommandGroup heading="Capture session">
                <CommandItem onSelect={() => runCommand("capture")}>
                  {snapshot.paused ? <Play size={14} /> : <Pause size={14} />}
                  {snapshot.paused ? "Resume capture" : "Pause capture"}
                </CommandItem>
                <CommandItem onSelect={() => runCommand("refresh")}>
                  <RefreshCw size={14} /> Refresh runtime snapshots
                </CommandItem>
                <CommandItem onSelect={() => runCommand("clear")}>
                  <X size={14} /> Clear local trace
                </CommandItem>
                <CommandItem onSelect={() => runCommand("export")}>
                  <Download size={14} /> Export trace
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      ) : null}
      <Tabs className="ga-inspector-tabs" defaultValue="overview">
        <div className="ga-inspector-tabs-bar">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
            <TabsTrigger value="traces">Traces</TabsTrigger>
          </TabsList>
          <div className="ga-inspector-primary-actions">
            <Button
              onClick={() =>
                snapshot.paused ? store.resumeCapture() : store.pauseCapture()
              }
              size="sm"
              variant={snapshot.paused ? "secondary" : "outline"}
            >
              {snapshot.paused ? <Play size={14} /> : <Pause size={14} />}
              {snapshot.paused ? "Resume capture" : "Pause capture"}
            </Button>
            <Button
              onClick={() => store.refreshSnapshots()}
              size="icon-sm"
              variant="ghost"
              aria-label="Refresh runtime snapshots"
            >
              <RefreshCw aria-hidden="true" size={15} />
            </Button>
          </div>
        </div>
        <TabsContent value="overview">
          <div className="ga-inspector-overview">
            <div className="ga-inspector-metrics">
              <SnapshotCard
                detail="attached sources"
                label="Runtimes"
                value={runtimeCount}
              />
              <SnapshotCard
                detail="bounded local records"
                label="Trace events"
                value={snapshot.records.length}
              />
              <SnapshotCard
                detail="public pending work"
                label="Queued"
                value={queued}
              />
              <SnapshotCard
                detail="browser delivery results"
                label="Deliveries"
                value={deliveries}
              />
            </div>
            <div className="ga-inspector-overview-grid">
              <Card>
                <CardHeader>
                  <CardDescription>Capture session</CardDescription>
                  <CardTitle>
                    {snapshot.paused ? "Paused locally" : "Collecting locally"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    {snapshot.droppedCount > 0
                      ? `${snapshot.droppedCount} older entries were evicted by the bounded buffer.`
                      : "The buffer is bounded and currently has no evicted entries."}
                  </p>
                  <div className="ga-inspector-inline-actions">
                    <Button
                      onClick={() => store.clear()}
                      size="sm"
                      variant="ghost"
                    >
                      Clear trace
                    </Button>
                    <Button
                      onClick={() => void copyTrace()}
                      size="sm"
                      variant="outline"
                    >
                      <Copy aria-hidden="true" size={14} /> Export trace
                    </Button>
                  </div>
                  {copyStatus ? (
                    <p className="ga-inspector-status">{copyStatus}</p>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Evidence boundary</CardDescription>
                  <CardTitle>Runtime decisions, not speech</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    This inspector records public runtime decisions and browser
                    delivery metadata only. It does not retain announcement text
                    or prove assistive-technology output.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="timeline">
          <Timeline store={store} />
        </TabsContent>
        <TabsContent value="runtime">
          <QueueTable store={store} />
        </TabsContent>
        <TabsContent value="traces">
          <div className="ga-inspector-traces">
            <Card>
              <CardHeader>
                <CardDescription>Portable, redacted trace</CardDescription>
                <CardTitle>Export the local investigation</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Exports include schema-versioned safe metadata, captured
                  runtime snapshots, and bounded-buffer accounting. They never
                  include response deltas, labels, errors, DOM text, or stacks.
                </p>
                <div className="ga-inspector-inline-actions">
                  <Button onClick={() => void copyTrace()} variant="secondary">
                    <Copy aria-hidden="true" size={14} /> Copy trace JSON
                  </Button>
                  <Button onClick={() => store.clear()} variant="outline">
                    Discard local trace
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
