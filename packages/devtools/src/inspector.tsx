import * as React from "react";
import { Copy, Pause, Play, RefreshCw, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  DevtoolsRecord,
  DevtoolsSnapshot,
  DevtoolsStore,
} from "./index.js";

export interface DevtoolsInspectorProps {
  readonly store: DevtoolsStore;
  readonly onClose: () => void;
  readonly onCopy?: (value: string) => void | Promise<void>;
}
type Filter = "all" | "event-observed" | "decision" | "dom-delivery";
const key = (record: DevtoolsRecord) => String(record.captureSequence);
const time = (value: number) =>
  value >= 10_000_000_000
    ? new Date(value).toISOString().slice(11, 23)
    : `+${(value / 1000).toFixed(2)}s`;
const stage = (record: DevtoolsRecord) =>
  record.kind === "event-observed"
    ? "Source evidence"
    : record.kind === "decision"
      ? "Runtime decision"
      : "DOM delivery";
const title = (record: DevtoolsRecord) =>
  record.kind === "event-observed"
    ? (record.sourceType ?? "Observed event")
    : record.kind === "dom-delivery"
      ? `${record.deliveryStatus ?? "Delivery"} via ${record.deliveryMethod ?? "browser"}`
      : (record.reason ?? record.disposition ?? "Runtime decision");
function correlationKeys(record: DevtoolsRecord): readonly string[] {
  const prefix = `${record.runtimeId}:`;
  const keys = new Set<string>();
  if (record.sourceEventId) keys.add(`${prefix}event:${record.sourceEventId}`);
  if (record.responseId) keys.add(`${prefix}response:${record.responseId}`);
  if (record.toolId) keys.add(`${prefix}tool:${record.toolId}`);
  if (record.interactionId)
    keys.add(`${prefix}interaction:${record.interactionId}`);
  if (record.approvalId) keys.add(`${prefix}approval:${record.approvalId}`);
  if (record.announcementId)
    keys.add(`${prefix}announcement:${record.announcementId}`);
  if (record.runId)
    keys.add(
      `${prefix}run:${record.runId}:${record.runInstanceId ?? "unidentified"}`,
    );
  if (record.runId && record.nextRunInstanceId)
    keys.add(`${prefix}run:${record.runId}:${record.nextRunInstanceId}`);
  if (record.parentRunId)
    keys.add(
      `${prefix}run:${record.parentRunId}:${record.parentRunInstanceId ?? "unidentified"}`,
    );
  if (record.stepId)
    keys.add(
      `${prefix}step:${record.runId ?? "unknown"}:${record.runInstanceId ?? "unidentified"}:${record.stepId}:${record.stepInstanceId ?? "unidentified"}`,
    );
  if (record.stepId && record.nextStepInstanceId)
    keys.add(
      `${prefix}step:${record.runId ?? "unknown"}:${record.runInstanceId ?? "unidentified"}:${record.stepId}:${record.nextStepInstanceId}`,
    );
  if (record.parentStepId)
    keys.add(
      `${prefix}step:${record.runId ?? "unknown"}:${record.runInstanceId ?? "unidentified"}:${record.parentStepId}:${record.parentStepInstanceId ?? "unidentified"}`,
    );
  if (record.parentToolId) keys.add(`${prefix}tool:${record.parentToolId}`);
  if (record.parentResponseId)
    keys.add(`${prefix}response:${record.parentResponseId}`);
  if (keys.size === 0) keys.add(`${prefix}record:${record.captureSequence}`);
  return [...keys];
}
function relatedRecords(
  records: readonly DevtoolsRecord[],
  selected: DevtoolsRecord,
): readonly DevtoolsRecord[] {
  const related = new Set<DevtoolsRecord>();
  const keys = new Set(correlationKeys(selected));
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      if (related.has(record)) continue;
      const recordKeys = correlationKeys(record);
      if (!recordKeys.some((value) => keys.has(value))) continue;
      related.add(record);
      for (const value of recordKeys) keys.add(value);
      changed = true;
    }
  }
  return [...related];
}
function explain(record: DevtoolsRecord) {
  if (record.kind === "event-observed")
    return "The adapter supplied this normalized public lifecycle signal.";
  if (record.kind === "dom-delivery")
    return record.deliveryStatus === "unavailable"
      ? "The DOM driver was unavailable, so no browser delivery action was observed."
      : "The DOM driver reported this delivery action.";
  return (
    (
      {
        scheduled:
          "The runtime placed an announcement intent into its bounded queue.",
        coalesced:
          "The runtime merged this work with an existing queued announcement.",
        duplicate: "The runtime suppressed a recently delivered duplicate.",
        "policy-silent":
          "The active policy intentionally made this event silent.",
        "queue-capacity": "The bounded queue rejected or displaced this work.",
        "scope-cancelled":
          "The lifecycle scope ended before this queued work delivered.",
        "runtime-disposed":
          "The runtime was disposed and cancelled remaining queued work.",
        "stale-response":
          "This signal did not match the active response epoch.",
        "stale-tool": "This signal did not match the active tool instance.",
        "delivery-error":
          "A registered announcement listener failed during delivery.",
        delivered:
          "A registered runtime announcement listener accepted this intent.",
      } as Record<string, string>
    )[record.reason ?? ""] ?? "The runtime recorded this policy decision."
  );
}
function useSnapshot(store: DevtoolsStore) {
  return React.useSyncExternalStore(
    React.useCallback((listener) => store.subscribe(listener), [store]),
    React.useCallback(() => store.getSnapshot(), [store]),
  );
}

function CausalChain({
  records,
}: {
  readonly records: readonly DevtoolsRecord[];
}) {
  return (
    <section className="ga-causal-chain" data-testid="causal-chain">
      <div className="ga-section-heading">
        <div>
          <p>Related evidence</p>
          <h3>Observed path</h3>
        </div>
        <span>{records.length} records</span>
      </div>
      <ol>
        {records.map((record, index) => (
          <li data-stage={record.kind} key={key(record)}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <b>{stage(record)}</b>
              <code>{title(record)}</code>
            </div>
            <time>{time(record.at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Detail({
  record,
  related,
  snapshot,
}: {
  readonly record: DevtoolsRecord | undefined;
  readonly related: readonly DevtoolsRecord[];
  readonly snapshot: DevtoolsSnapshot;
}) {
  if (!record)
    return (
      <aside className="ga-trace-detail" data-testid="trace-detail">
        <div className="ga-empty-state">
          <p>Choose a record</p>
          <h3>Trace one accessibility decision from source to delivery.</h3>
          <span>
            Selection never changes the runtime, queue, or host focus.
          </span>
        </div>
      </aside>
    );
  const source =
    snapshot.runtimeSources[record.runtimeSourceId ?? record.runtimeId];
  const runtime = snapshot.runtimeSnapshots[record.runtimeId];
  const run = record.runInstanceId
    ? runtime?.runs?.find(
        (item) =>
          item.runId === record.runId &&
          item.instanceId === record.runInstanceId,
      )
    : undefined;
  const step =
    record.runInstanceId && record.stepInstanceId
      ? runtime?.steps?.find(
          (item) =>
            item.runId === record.runId &&
            item.stepId === record.stepId &&
            item.runInstanceId === record.runInstanceId &&
            item.instanceId === record.stepInstanceId,
        )
      : undefined;
  const deliveries = related.filter((item) => item.kind === "dom-delivery");
  return (
    <aside className="ga-trace-detail" data-testid="trace-detail">
      <div className="ga-detail-intro">
        <p>{stage(record)}</p>
        <h3>{title(record)}</h3>
        <span>{explain(record)}</span>
      </div>
      <section className="ga-detail-section">
        <h4>Why inspect this</h4>
        <p>
          {record.reason?.startsWith("stale")
            ? "Compare the instance with the current runtime snapshot."
            : "Inspect related evidence and queue context if this was unexpected."}
        </p>
      </section>
      <CausalChain records={related} />
      {record.runId ? (
        <section className="ga-detail-section">
          <h4>Workflow hierarchy</h4>
          <dl className="ga-key-values">
            <div>
              <dt>Run</dt>
              <dd>{record.runId}</dd>
            </div>
            <div>
              <dt>Run attempt</dt>
              <dd>
                {record.runInstanceId ?? run?.instanceId ?? "Not supplied"}
              </dd>
            </div>
            <div>
              <dt>Parent run</dt>
              <dd>{record.parentRunId ?? run?.parentRunId ?? "None"}</dd>
            </div>
            <div>
              <dt>Run state</dt>
              <dd>{run?.status ?? "Not retained"}</dd>
            </div>
            <div>
              <dt>Step</dt>
              <dd>{record.stepId ?? "Partial identity"}</dd>
            </div>
            <div>
              <dt>Step attempt</dt>
              <dd>
                {record.stepInstanceId ?? step?.instanceId ?? "Not supplied"}
              </dd>
            </div>
            <div>
              <dt>Parent step</dt>
              <dd>{record.parentStepId ?? step?.parentStepId ?? "None"}</dd>
            </div>
            <div>
              <dt>Step state</dt>
              <dd>{step?.status ?? "Not retained"}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <section className="ga-detail-section">
        <h4>Source evidence</h4>
        {source ? (
          <dl className="ga-key-values">
            <div>
              <dt>Adapter</dt>
              <dd>{source.adapter}</dd>
            </div>
            <div>
              <dt>Runs</dt>
              <dd>{source.fidelity.runs ?? "Not declared"}</dd>
            </div>
            <div>
              <dt>Steps</dt>
              <dd>{source.fidelity.steps ?? "Not declared"}</dd>
            </div>
            <div>
              <dt>Hierarchy</dt>
              <dd>{source.fidelity.hierarchy ?? "Not declared"}</dd>
            </div>
            <div>
              <dt>Replay</dt>
              <dd>{source.fidelity.replay ?? "Not declared"}</dd>
            </div>
            <div>
              <dt>Interruption</dt>
              <dd>{source.fidelity.interruption}</dd>
            </div>
            <div>
              <dt>Retry</dt>
              <dd>{source.fidelity.retries}</dd>
            </div>
            <div>
              <dt>Connection</dt>
              <dd>{source.fidelity.connection}</dd>
            </div>
            <div className="ga-key-values-wide">
              <dt>Public signals</dt>
              <dd>{source.evidence.join(", ")}</dd>
            </div>
          </dl>
        ) : (
          <p>Adapter evidence was not declared for this runtime.</p>
        )}
      </section>
      <section className="ga-detail-section">
        <h4>Policy and scheduling</h4>
        {runtime ? (
          <dl className="ga-key-values">
            <div>
              <dt>Queue</dt>
              <dd>{runtime.pendingCount} pending</dd>
            </div>
            <div>
              <dt>Minimum gap</dt>
              <dd>{runtime.policy.minimumGapMs} ms</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>
                {record.dueAt === undefined
                  ? "Not scheduled"
                  : time(record.dueAt)}
              </dd>
            </div>
            <div>
              <dt>Queue sequence</dt>
              <dd>{record.queueSequence ?? "Not queued"}</dd>
            </div>
          </dl>
        ) : (
          <p>No current runtime snapshot is available.</p>
        )}
      </section>
      <section className="ga-detail-section">
        <h4>Delivery evidence</h4>
        {deliveries.length ? (
          deliveries.map((delivery) => (
            <p key={key(delivery)}>
              <code>
                {delivery.deliveryMethod} · {delivery.deliveryStatus}
              </code>
            </p>
          ))
        ) : (
          <p>
            No instrumented DOM delivery result is correlated with this record.
          </p>
        )}
        <p className="ga-boundary">
          A runtime intent or DOM result does not prove that a screen reader
          spoke.
        </p>
      </section>
      <details className="ga-raw-record">
        <summary>Structured record</summary>
        <pre>{JSON.stringify(record, null, 2)}</pre>
      </details>
    </aside>
  );
}

function List({
  records,
  selected,
  onSelect,
}: {
  readonly records: readonly DevtoolsRecord[];
  readonly selected: string | undefined;
  readonly onSelect: (value: string) => void;
}) {
  const index = Math.max(
    0,
    records.findIndex((record) => key(record) === selected),
  );
  return (
    <div
      aria-activedescendant={selected ? `trace-${selected}` : undefined}
      aria-label="Captured accessibility trace"
      className="ga-trace-list"
      onKeyDown={(event) => {
        const direction =
          event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!direction || !records.length) return;
        event.preventDefault();
        const next =
          records[Math.max(0, Math.min(records.length - 1, index + direction))];
        if (next) {
          onSelect(key(next));
          event.currentTarget
            .querySelector<HTMLElement>(`#trace-${key(next)}`)
            ?.scrollIntoView({ block: "nearest" });
        }
      }}
      role="listbox"
      tabIndex={0}
    >
      {records.map((record) => (
        <div
          aria-selected={key(record) === selected}
          className="ga-trace-row"
          id={`trace-${key(record)}`}
          key={key(record)}
          onClick={() => onSelect(key(record))}
          role="option"
        >
          <time>{time(record.at)}</time>
          <span>{stage(record)}</span>
          <strong>{title(record)}</strong>
          <code>
            {record.reason ??
              record.sourceType ??
              record.deliveryStatus ??
              "recorded"}
          </code>
        </div>
      ))}
      {!records.length ? (
        <div className="ga-empty-list">No trace records match this view.</div>
      ) : null}
    </div>
  );
}

export function DevtoolsInspector({
  store,
  onClose,
  onCopy,
}: DevtoolsInspectorProps) {
  const snapshot = useSnapshot(store);
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selectedKey, setSelectedKey] = React.useState<string>();
  const [feedback, setFeedback] = React.useState<string>();
  const feedbackTimer = React.useRef<number | undefined>(undefined);
  const actionRevision = React.useRef(0);
  const visible = snapshot.records
    .filter(
      (record) =>
        (filter === "all" || record.kind === filter) &&
        [
          record.kind,
          record.sourceType,
          record.reason,
          record.disposition,
          record.responseId,
          record.toolId,
          record.interactionId,
          record.approvalId,
          record.runId,
          record.runInstanceId,
          record.stepId,
          record.stepInstanceId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .slice()
    .reverse();
  const selected =
    visible.find((record) => key(record) === selectedKey) ?? visible[0];
  const related = selected ? relatedRecords(snapshot.records, selected) : [];
  React.useEffect(
    () => () => {
      if (feedbackTimer.current !== undefined)
        window.clearTimeout(feedbackTimer.current);
    },
    [],
  );
  const closeInspector = () => {
    actionRevision.current += 1;
    if (feedbackTimer.current !== undefined)
      window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = undefined;
    setFeedback(undefined);
    onClose();
  };
  const notice = (message: string) => {
    if (feedbackTimer.current !== undefined)
      window.clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = window.setTimeout(
      () => setFeedback(undefined),
      2200,
    );
  };
  const copy = async () => {
    if (!onCopy) return notice("Copy is unavailable in this mount");
    const revision = ++actionRevision.current;
    if (feedbackTimer.current !== undefined)
      window.clearTimeout(feedbackTimer.current);
    setFeedback("Copying trace");
    try {
      await onCopy(JSON.stringify(store.exportTrace(), null, 2));
      if (actionRevision.current === revision) notice("Trace copied");
    } catch {
      if (actionRevision.current === revision)
        notice("Copy could not complete");
    }
  };
  return (
    <section
      aria-label="Generative accessibility trace explorer"
      className="ga-inspector"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          closeInspector();
        }
      }}
    >
      <header className="ga-inspector-header">
        <div>
          <p>Local diagnostic session</p>
          <h2>Accessibility trace</h2>
        </div>
        <div className="ga-header-actions">
          <Button
            onClick={() => {
              if (snapshot.paused) {
                store.resumeCapture();
                notice("Capture resumed");
              } else {
                store.pauseCapture();
                notice("Capture paused");
              }
            }}
            size="sm"
            variant="secondary"
          >
            {snapshot.paused ? (
              <Play aria-hidden="true" size={14} />
            ) : (
              <Pause aria-hidden="true" size={14} />
            )}
            {snapshot.paused ? "Resume" : "Pause"}
          </Button>
          <Button
            aria-label="Refresh runtime snapshot"
            onClick={() => {
              store.refreshSnapshots();
              notice("Runtime snapshot refreshed");
            }}
            size="icon-sm"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" size={15} />
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
      <div aria-live="polite" role="status">
        <AnimatePresence>
          {feedback ? (
            <motion.div
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              className="ga-workspace-feedback"
              data-testid="workspace-feedback"
              {...(reduceMotion ? {} : { exit: { opacity: 0, y: 4 } })}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            >
              {feedback}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="ga-session-toolbar">
        <label className="ga-inspector-search">
          <Search aria-hidden="true" size={15} />
          <Input
            aria-label="Search trace"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search safe metadata"
            type="search"
            value={query}
          />
        </label>
        <div
          aria-label="Trace category"
          className="ga-filter-group"
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
                  : value === "event-observed"
                    ? "Source"
                    : value === "decision"
                      ? "Decisions"
                      : "Delivery"}
              </Button>
            ),
          )}
        </div>
        <span className="ga-session-count">
          {snapshot.records.length} captured · {snapshot.droppedCount} dropped
        </span>
        <Button onClick={() => void copy()} size="sm" variant="ghost">
          <Copy aria-hidden="true" size={14} /> Copy
        </Button>
        <Button
          onClick={() => {
            store.clear();
            setSelectedKey(undefined);
            notice("Local trace cleared");
          }}
          size="sm"
          variant="ghost"
        >
          Clear
        </Button>
      </div>
      <ResizablePanelGroup
        className="ga-explorer-layout"
        orientation="horizontal"
      >
        <ResizablePanel defaultSize={48} minSize={34}>
          <ScrollArea className="ga-trace-scroll">
            <List
              onSelect={setSelectedKey}
              records={visible}
              selected={selected ? key(selected) : undefined}
            />
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={52} minSize={34}>
          <Detail record={selected} related={related} snapshot={snapshot} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
