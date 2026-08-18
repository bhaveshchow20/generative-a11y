import * as React from "react";
import {
  Copy,
  Download,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [snapshot, setSnapshot] = React.useState(() => store.getSnapshot());
  React.useEffect(
    () => store.subscribe(() => setSnapshot(store.getSnapshot())),
    [store],
  );
  return snapshot;
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

function traceStage(record: DevtoolsRecord): 0 | 1 | 2 {
  if (record.kind === "event-observed") return 0;
  if (record.kind === "dom-delivery") return 2;
  return 1;
}

function TraceMap({ store }: { readonly store: DevtoolsStore }) {
  const snapshot = useStoreSnapshot(store);
  const prefersReducedMotion = useReducedMotion();
  const [selectedKey, setSelectedKey] = React.useState<string>();
  const records = snapshot.records.slice(-24);
  const selected = records.find((record) => recordKey(record) === selectedKey);
  const width = 960;
  const height = 214;
  const left = 102;
  const right = 40;
  const lanes = [54, 108, 162] as const;
  const labels = ["Observed", "Runtime", "Browser"] as const;
  const range = Math.max(1, records.length - 1);
  return (
    <section
      aria-label="Visual trace map"
      className="ga-trace-map"
      data-testid="trace-map"
    >
      <div className="ga-trace-map-heading">
        <div>
          <p>Trace map</p>
          <h3>Follow a runtime decision across its delivery path.</h3>
        </div>
        <span>{records.length} recent signals</span>
      </div>
      <svg
        aria-label="Trace events arranged from observed input through runtime decisions to browser delivery"
        className="ga-trace-map-svg"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {lanes.map((lane, index) => (
          <g key={labels[index]}>
            <text className="ga-trace-map-label" x="0" y={lane + 4}>
              {labels[index]}
            </text>
            <line
              className="ga-trace-map-lane"
              x1={left}
              x2={width - right}
              y1={lane}
              y2={lane}
            />
          </g>
        ))}
        {records.map((record, index) => {
          const stage = traceStage(record);
          const x = left + ((width - left - right) * index) / range;
          const y = lanes[stage];
          const previous = records[index - 1];
          const previousStage = previous ? traceStage(previous) : stage;
          const previousX =
            left + ((width - left - right) * Math.max(0, index - 1)) / range;
          const previousY = lanes[previousStage];
          const tone =
            record.kind === "dom-delivery"
              ? "delivery"
              : record.kind === "decision"
                ? "decision"
                : "observed";
          return (
            <g
              aria-label={`Inspect ${recordTitle(record)}`}
              className={`ga-trace-map-event ga-trace-map-event-${tone}`}
              data-trace-key={recordKey(record)}
              key={recordKey(record)}
              onClick={() => setSelectedKey(recordKey(record))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedKey(recordKey(record));
                }
              }}
              role="button"
              tabIndex={0}
            >
              {previous ? (
                <path
                  className="ga-trace-map-path"
                  d={`M ${previousX} ${previousY} C ${(previousX + x) / 2} ${previousY}, ${(previousX + x) / 2} ${y}, ${x} ${y}`}
                />
              ) : null}
              <motion.circle
                animate={
                  prefersReducedMotion ? false : { opacity: 1, scale: 1 }
                }
                cx={x}
                cy={y}
                initial={
                  prefersReducedMotion ? false : { opacity: 0, scale: 0.6 }
                }
                r="6"
                transition={{
                  delay: Math.min(index * 0.025, 0.28),
                  duration: 0.18,
                }}
              >
                <title>{`${recordTitle(record)} at ${formatTime(record.at)}`}</title>
              </motion.circle>
            </g>
          );
        })}
      </svg>
      <div className="ga-trace-map-legend" aria-label="Trace map legend">
        <span>
          <i className="ga-tone-observed" />
          Input
        </span>
        <span>
          <i className="ga-tone-decision" />
          Decision
        </span>
        <span>
          <i className="ga-tone-delivery" />
          Delivery
        </span>
      </div>
      <div className="ga-trace-map-selection" data-testid="trace-map-selection">
        {selected ? (
          <>
            <strong>Selected signal</strong>
            <span>
              {recordTitle(selected)} · {formatTime(selected.at)} ·{" "}
              {recordSummary(selected)}
            </span>
          </>
        ) : (
          <span>
            Select a signal to inspect its safe correlation and timing.
          </span>
        )}
      </div>
    </section>
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
                    <dt>Sequence</dt>
                    <dd>{selected.sequence}</dd>
                  </div>
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
  const [feedback, setFeedback] = React.useState<string>();
  const runtimeCount = snapshot.runtimeIds.length;
  const queued = Object.values(snapshot.runtimeSnapshots).reduce(
    (count, runtime) => count + runtime.pendingCount,
    0,
  );
  const deliveries = snapshot.records.filter(
    (record) => record.kind === "dom-delivery",
  ).length;
  const copyTrace = () => {
    const serialized = JSON.stringify(store.exportTrace(), null, 2);
    try {
      const result = onCopy?.(serialized);
      if (result && "catch" in result)
        void result.catch(() => setFeedback("Copy unavailable"));
      setFeedback(
        onCopy ? "Trace copied to the local clipboard" : "Copy unavailable",
      );
    } catch {
      setFeedback("Copy unavailable");
    }
  };
  const toggleCapture = () => {
    if (snapshot.paused) {
      store.resumeCapture();
      setFeedback("Capture resumed");
    } else {
      store.pauseCapture();
      setFeedback("Capture paused");
    }
  };
  const refresh = () => {
    store.refreshSnapshots();
    setFeedback("Runtime snapshot refreshed");
  };
  const clear = () => {
    store.clear();
    setFeedback("Local trace cleared");
  };

  return (
    <section
      aria-label="Generative accessibility runtime inspector"
      className="ga-inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="ga-inspector-header">
        <div className="ga-inspector-title-group">
          <div>
            <p>Local workspace</p>
            <h2>Runtime trace</h2>
          </div>
        </div>
        <div className="ga-inspector-header-actions">
          <Button onClick={toggleCapture} size="sm" variant="outline">
            {snapshot.paused ? (
              <Play aria-hidden="true" size={14} />
            ) : (
              <Pause aria-hidden="true" size={14} />
            )}
            {snapshot.paused ? "Resume capture" : "Pause capture"}
          </Button>
          <Button
            aria-label="Refresh runtime snapshot"
            onClick={refresh}
            size="icon-sm"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" size={15} />
          </Button>
          <Button
            aria-label="Close inspector"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden="true" size={17} />
          </Button>
        </div>
      </header>
      <AnimatePresence>
        {feedback ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="ga-workspace-feedback"
            data-testid="workspace-feedback"
            exit={{ opacity: 0, y: 6 }}
            initial={{ opacity: 0, y: 6 }}
            key={feedback}
            onAnimationComplete={() =>
              window.setTimeout(() => setFeedback(undefined), 2200)
            }
          >
            {feedback}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Tabs className="ga-inspector-tabs" defaultValue="trace">
        <div className="ga-inspector-tabs-bar">
          <TabsList>
            <TabsTrigger value="trace">Trace</TabsTrigger>
            <TabsTrigger value="timeline">Events</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
            <TabsTrigger value="traces">Library</TabsTrigger>
          </TabsList>
          <div className="ga-inspector-primary-actions">
            <Button onClick={copyTrace} size="sm" variant="ghost">
              <Download aria-hidden="true" size={14} /> Export
            </Button>
          </div>
        </div>
        <TabsContent value="trace">
          <div className="ga-inspector-overview">
            <TraceMap store={store} />
            <div className="ga-inspector-metrics ga-inspector-evidence-strip">
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
                  <CardDescription>Capture</CardDescription>
                  <CardTitle>
                    {snapshot.paused ? "Paused" : "Running"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    {snapshot.droppedCount > 0
                      ? `${snapshot.droppedCount} older entries were evicted by the bounded buffer.`
                      : "The buffer is bounded and currently has no evicted entries."}
                  </p>
                  <div className="ga-inspector-inline-actions">
                    <Button onClick={clear} size="sm" variant="ghost">
                      Clear trace
                    </Button>
                    <Button onClick={copyTrace} size="sm" variant="outline">
                      <Copy aria-hidden="true" size={14} /> Export trace
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Evidence boundary</CardDescription>
                  <CardTitle>Observed delivery, not speech</CardTitle>
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
                  <Button onClick={copyTrace} variant="secondary">
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
