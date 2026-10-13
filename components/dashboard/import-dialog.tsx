"use client";

import * as React from "react";
import { Download, FileSpreadsheet } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IMPORT_FIELDS,
  autoMapColumns,
  buildErrorCsv,
  buildImportTemplate,
  detectDuplicates,
  parseCsv,
  validateRows,
  type DuplicatePolicy,
  type DuplicateMatch,
  type ImportField,
  type ImportJob,
  type ImportJobResult,
  type ParsedCsv,
  type RowContext,
  type ValidatedRow,
} from "@/lib/csv-import";
import { cn, downloadCsv } from "@/lib/utils";

type Step = "upload" | "map" | "review" | "running" | "done";

const STEP_LABELS: Record<Step, string> = {
  upload: "1 · Upload",
  map: "2 · Map columns",
  review: "3 · Review",
  running: "4 · Importing",
  done: "5 · Result",
};

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { importDeals, eligibleOwners, ownerNames, currency, opportunities } = usePipeline();

  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, number | null>>({});
  const [validated, setValidated] = React.useState<ValidatedRow[]>([]);
  const [duplicates, setDuplicates] = React.useState<Map<number, DuplicateMatch>>(new Map());
  const [policy, setPolicy] = React.useState<DuplicatePolicy>("skip");
  const [updateSelection, setUpdateSelection] = React.useState<Set<number>>(new Set());
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [results, setResults] = React.useState<ImportJobResult[]>([]);
  const [running, setRunning] = React.useState(false);

  const defaultOwner = ownerNames[0] ?? eligibleOwners[0] ?? "";

  function reset() {
    setStep("upload");
    setFileName("");
    setParseError(null);
    setParsed(null);
    setMapping({});
    setValidated([]);
    setDuplicates(new Map());
    setPolicy("skip");
    setUpdateSelection(new Set());
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setRunning(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  function downloadTemplate() {
    downloadCsv("salesflow-import-template.csv", buildImportTemplate());
  }

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (!result.headers.length || !result.rows.length) {
        setParseError("That file has no data rows. Download the template to see the expected format.");
        return;
      }
      setParsed(result);
      setFileName(file.name);
      setMapping(autoMapColumns(result.headers) as Record<string, number | null>);
      setStep("map");
    } catch {
      setParseError("The file could not be read. Make sure it is a plain .csv file.");
    }
  }

  function runValidation() {
    if (!parsed) return;
    const context: RowContext = {
      currency,
      defaultOwner,
      eligibleOwners: eligibleOwners.length ? eligibleOwners : [defaultOwner],
    };
    const rows = validateRows(parsed, mapping as Record<ImportField, number | null>, context);
    const matches = detectDuplicates(
      rows,
      opportunities.map((opportunity) => ({
        id: opportunity.id,
        company: opportunity.company,
        value: opportunity.value,
        expectedCloseDate: opportunity.expectedCloseDate,
      })),
    );
    setValidated(rows);
    setDuplicates(matches);
    setUpdateSelection(new Set([...matches.entries()]
      .filter(([, match]) => match.existingId)
      .map(([index]) => index)));
    setStep("review");
  }

  const validCount = validated.filter((row) => row.deal).length;
  const errorCount = validated.length - validCount;

  function buildJobs(): ImportJob[] {
    const jobs: ImportJob[] = [];
    validated.forEach((row, index) => {
      if (!row.deal) return;
      const duplicate = duplicates.get(index);
      if (duplicate) {
        if (policy === "skip") return;
        if (policy === "update") {
          // Only explicitly selected rows are updated; the rest stay untouched.
          if (!duplicate.existingId || !updateSelection.has(index)) return;
          jobs.push({ rowNumber: row.rowNumber, deal: row.deal, updateExistingId: duplicate.existingId });
          return;
        }
        // "import-new" falls through: created as a separate deal.
      }
      jobs.push({ rowNumber: row.rowNumber, deal: row.deal });
    });
    return jobs;
  }

  async function startImport() {
    if (running) return;
    const jobs = buildJobs();
    setResults([]);
    setStep("running");
    setProgress({ done: 0, total: jobs.length });
    if (!jobs.length) {
      setStep("done");
      return;
    }

    setRunning(true);
    const collected: ImportJobResult[] = [];
    for (const job of jobs) {
      try {
        const [result] = await importDeals([job]);
        collected.push(result ?? {
          rowNumber: job.rowNumber,
          status: "failed",
          error: "The import did not return a result for this row.",
        });
      } catch (error) {
        collected.push({
          rowNumber: job.rowNumber,
          status: "failed",
          error: error instanceof Error ? error.message : "The row could not be saved.",
        });
      }
      setResults([...collected]);
      setProgress((current) => ({ done: current.done + 1, total: jobs.length }));
    }
    setRunning(false);
    setStep("done");
  }

  function downloadErrors() {
    const runtimeFailures = results.filter((result) => result.status === "failed");
    if (!errorCount && !runtimeFailures.length) return;
    downloadCsv(
      `salesflow-import-errors-${new Date().toISOString().slice(0, 10)}.csv`,
      buildErrorCsv(validated, runtimeFailures),
    );
  }
  const failedResults = results.filter((result) => result.status === "failed");
  const insertedCount = results.filter((result) => result.status === "inserted").length;
  const updatedCount = results.filter((result) => result.status === "updated").length;
  const importable = buildJobs().length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import deals from CSV</DialogTitle>
          <DialogDescription>
            Nothing is written until you confirm on the review step. Existing deals are never
            overwritten without your explicit choice, and your organization currency never changes.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <ol className="flex flex-wrap gap-1.5" aria-label="Import progress">
          {(Object.keys(STEP_LABELS) as Step[]).map((key) => (
            <li
              key={key}
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs font-medium",
                step === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              {STEP_LABELS[key]}
            </li>
          ))}
        </ol>

        {/* ── Step: upload ─────────────────────────────────────────── */}
        {step === "upload" ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Choose a CSV file</p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Columns: Company, Contact, Email, Phone, Stage, Value, Probability, Owner,
                  Expected Close Date, Closed Date, Lead Source.
                </p>
              </div>
              <label className="inline-flex">
                <span className="sr-only">Import CSV file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full max-w-xs text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Download template
              </Button>
            </div>
            {parseError ? (
              <p role="alert" className="text-sm text-destructive">
                {parseError}
              </p>
            ) : null}
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Dates: <code className="rounded bg-muted px-1">YYYY-MM-DD</code> or day-first{" "}
              <code className="rounded bg-muted px-1">DD/MM/YYYY</code>. Amounts must be in your
              workspace currency ({currency}); closed stages need a Closed Date. Owner defaults to
              you and only accepts active members of your organization.
            </p>
          </div>
        ) : null}
        {/* ── Step: map columns ────────────────────────────────────── */}
        {step === "map" && parsed ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.field} className="space-y-1.5">
                  <Label htmlFor={`map-${field.field}`}>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Select
                    value={
                      mapping[field.field] === null || mapping[field.field] === undefined
                        ? "none"
                        : String(mapping[field.field])
                    }
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [field.field]: value === "none" ? null : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger id={`map-${field.field}`} aria-label={`Column for ${field.label}`}>
                      <SelectValue placeholder="Not mapped" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not mapped</SelectItem>
                      {parsed.headers.map((header, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {header || `Column ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-2xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    {IMPORT_FIELDS.filter((field) => mapping[field.field] !== null).map((field) => (
                      <th key={field.field} className="px-2.5 py-2 font-medium">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsed.rows.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {IMPORT_FIELDS.filter((field) => mapping[field.field] !== null).map((field) => (
                        <td key={field.field} className="px-2.5 py-1.5">
                          {mapping[field.field] !== null
                            ? row[mapping[field.field] as number] ?? ""
                            : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-2xs text-muted-foreground">
              Showing the first {Math.min(5, parsed.rows.length)} of {parsed.rows.length} data
              rows. Nothing has been imported yet.
            </p>
          </div>
        ) : null}
        {/* ── Step: review ─────────────────────────────────────────── */}
        {step === "review" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Ready</p>
                <p className="text-lg font-bold tabular on-success">{validCount - duplicates.size}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Duplicates</p>
                <p className="text-lg font-bold tabular text-amber-600">{duplicates.size}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Errors</p>
                <p className="text-lg font-bold tabular on-danger">{errorCount}</p>
              </div>
            </div>

            {duplicates.size > 0 ? (
              <fieldset className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                <legend className="text-xs font-semibold text-amber-800">
                  {duplicates.size} row{duplicates.size === 1 ? "" : "s"} match an existing deal
                  (same company, amount and expected close date)
                </legend>
                {(
                  [
                    { value: "skip", label: "Skip them — import nothing for these rows" },
                    { value: "import-new", label: "Import as separate new deals" },
                    { value: "update", label: "Update the matched existing deals (selected below)" },
                  ] as { value: DuplicatePolicy; label: string }[]
                ).map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-9 items-center gap-2.5 text-sm text-amber-900"
                  >
                    <input
                      type="radio"
                      name="duplicate-policy"
                      value={option.value}
                      checked={policy === option.value}
                      onChange={() => setPolicy(option.value)}
                      className="size-4 accent-amber-700"
                    />
                    {option.label}
                  </label>
                ))}
                {policy === "update" ? (
                  <ul className="space-y-1.5 pl-1">
                    {[...duplicates.entries()].map(([rowIndex, duplicate]) => (
                      <li key={rowIndex} className="flex items-center gap-2 text-2xs text-amber-900">
                        <input
                          type="checkbox"
                          checked={Boolean(duplicate.existingId && updateSelection.has(rowIndex))}
                          aria-label={`Update row ${validated[rowIndex]?.rowNumber ?? rowIndex + 1}`}
                          disabled={!duplicate.existingId}
                          onChange={(event) =>
                            setUpdateSelection((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(rowIndex);
                              else next.delete(rowIndex);
                              return next;
                            })
                          }
                          className="size-3.5 accent-amber-700"
                        />
                        Row {validated[rowIndex]?.rowNumber ?? rowIndex + 1} →{" "}
                        {validated[rowIndex]?.deal?.company ?? ""} (
                        {duplicate.existingId
                          ? `existing deal ${duplicate.existingId.slice(0, 8)}…`
                          : `duplicate of row ${(duplicate.earlierRowIndex ?? 0) + 1} in this file`}
                        )
                      </li>
                    ))}
                  </ul>
                ) : null}
              </fieldset>
            ) : null}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-left text-2xs">
                <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">Row</th>
                    <th className="px-2.5 py-2 font-medium">Company</th>
                    <th className="px-2.5 py-2 font-medium">Stage</th>
                    <th className="px-2.5 py-2 font-medium">Close date</th>
                    <th className="px-2.5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validated.map((row, index) => (
                    <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50" : undefined}>
                      <td className="px-2.5 py-1.5 tabular">{row.rowNumber}</td>
                      <td className="px-2.5 py-1.5">{row.cells.company || "—"}</td>
                      <td className="px-2.5 py-1.5">{row.cells.stage || "—"}</td>
                      <td className="px-2.5 py-1.5">{row.cells.expectedCloseDate || "—"}</td>
                      <td className="px-2.5 py-1.5">
                        {row.errors.length ? (
                          <span className="text-destructive">{row.errors.join("; ")}</span>
                        ) : duplicates.has(index) ? (
                          <span className="font-medium text-amber-700">
                            {policy === "skip"
                              ? "Duplicate · will be skipped"
                              : policy === "update"
                                ? duplicates.get(index)?.existingId
                                  ? updateSelection.has(index)
                                    ? "Duplicate · will update existing"
                                    : "Duplicate · not selected"
                                  : "Duplicate in file · cannot update until imported"
                                : "Duplicate · will import as new"}
                          </span>
                        ) : (
                          <span className="on-success">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errorCount > 0 ? (
              <div>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Download className="h-4 w-4" />
                  Download {errorCount} failed row{errorCount === 1 ? "" : "s"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {/* ── Step: running ────────────────────────────────────────── */}
        {step === "running" ? (
          <div className="space-y-3 py-6 text-center" role="status" aria-live="polite">
            <p className="text-sm font-semibold">
              Importing row {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </p>
            <div className="mx-auto h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Each row is saved individually — if one fails, the rest still import and you can
              retry the failed rows.
            </p>
          </div>
        ) : null}

        {/* ── Step: done ───────────────────────────────────────────── */}
        {step === "done" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Imported</p>
                <p className="text-lg font-bold tabular on-success">{insertedCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Updated</p>
                <p className="text-lg font-bold tabular">{updatedCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">Failed</p>
                <p className={cn("text-lg font-bold tabular", failedResults.length && "on-danger")}>
                  {failedResults.length + errorCount}
                </p>
              </div>
            </div>

            {failedResults.length || errorCount > 0 ? (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3.5">
                <p className="text-sm font-semibold text-destructive">
                  {failedResults.length + errorCount} row
                  {failedResults.length + errorCount === 1 ? "" : "s"} did not import
                </p>
                {failedResults.length ? (
                  <ul className="space-y-1 text-2xs text-muted-foreground">
                    {failedResults.map((result) => (
                      <li key={result.rowNumber}>
                        Row {result.rowNumber}: {result.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-2xs text-muted-foreground">
                  Correct these rows in your file and import again — rows that already imported will
                  be flagged as duplicates instead of being created twice.
                </p>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Download className="h-4 w-4" />
                  Download failed rows
                </Button>
              </div>
            ) : (
              <p className="text-sm on-success">
                {insertedCount + updatedCount} row
                {insertedCount + updatedCount === 1 ? "" : "s"} imported successfully.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {step === "map" ? (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
          ) : null}
          {step === "review" ? (
            <Button variant="outline" onClick={() => setStep("map")}>
              Back
            </Button>
          ) : null}
          {step === "map" ? (
            <Button onClick={runValidation}>Preview &amp; validate</Button>
          ) : null}
          {step === "review" ? (
            <Button onClick={() => void startImport()} disabled={importable === 0}>
              Import {importable} row{importable === 1 ? "" : "s"}
            </Button>
          ) : null}
          {step === "done" ? (
            <Button onClick={() => handleClose(false)}>Finish</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
