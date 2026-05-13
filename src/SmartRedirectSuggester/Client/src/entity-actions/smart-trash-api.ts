import { umbHttpClient } from "@umbraco-cms/backoffice/http-client";

/**
 * Hand-written typed wrappers around the SmartRedirectSuggester management API endpoints.
 *
 * The hey-api OpenAPI generator can't be re-run from CI without a running test site, so we
 * keep these minimal request/response types co-located with the action that uses them. When the
 * `npm run generate-client` script is re-run against a live backend, these can be swapped for the
 * generated `SmartRedirectSuggesterService.prepare` / `.commit` SDK calls — the shapes match the
 * server-side DTOs in `src/SmartRedirectSuggester/Models/SmartRedirectSuggesterModels.cs`.
 */

const BASE = "/umbraco/smartredirectsuggester/api/v1";
const SECURITY = [{ scheme: "bearer", type: "http" }] as const;

export interface PrepareRequestDto {
  documentKeys: string[];
  candidateCount?: number;
}

export interface OldUrlInfoDto {
  culture: string | null;
  url: string;
}

export interface RedirectCandidateDto {
  documentKey: string;
  name: string;
  url: string;
}

export interface TrashedDocumentSuggestionsDto {
  documentKey: string;
  name: string;
  oldUrls: OldUrlInfoDto[];
  candidates: RedirectCandidateDto[];
}

export interface PrepareResponseDto {
  items: TrashedDocumentSuggestionsDto[];
}

export interface CommitEntryDto {
  trashedDocumentKey: string;
  targetDocumentKey: string | null;
}

export interface CommitRequestDto {
  redirects: CommitEntryDto[];
}

export interface CommitResponseDto {
  createdRedirectCount: number;
  skippedDocumentCount: number;
}

export async function prepareSuggestions(
  request: PrepareRequestDto,
): Promise<PrepareResponseDto> {
  const { data, error } = await umbHttpClient.post<PrepareResponseDto>({
    url: `${BASE}/prepare`,
    body: request,
    security: SECURITY,
  });
  if (error || !data) {
    throw error ?? new Error("Failed to prepare redirect suggestions");
  }
  return data;
}

export async function commitRedirects(
  request: CommitRequestDto,
): Promise<CommitResponseDto> {
  const { data, error } = await umbHttpClient.post<CommitResponseDto>({
    url: `${BASE}/commit`,
    body: request,
    security: SECURITY,
  });
  if (error || !data) {
    throw error ?? new Error("Failed to commit redirects");
  }
  return data;
}
