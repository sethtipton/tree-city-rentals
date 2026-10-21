import { supabase } from "./supabase";
import { getAttachmentKind } from "./media";

const MAINTENANCE_BUCKET = "maintenance-attachments";

export const REQUEST_STATUS_LABELS = {
  received: "Received",
  submitted: "Received",
  "under-review": "Under review",
  "work-planned": "Work planned",
  "work-created": "Work planned",
  "in-progress": "Work in progress",
  resolved: "Resolved",
};

export async function loadTenantUnits() {
  const { data, error } = await supabase.rpc("get_my_tenant_units");
  if (error) throw error;
  return data || [];
}

export async function loadMaintenanceRequests({ workspaceId, tenant = false }) {
  let query = supabase
    .from("maintenance_requests")
    .select("id,workspace_id,property_id,unit_id,tenant_membership_id,parent_request_id,source_type,title,original_description,status,tenant_status,processing_status,processing_error,created_at,updated_at,resolved_at")
    .order("updated_at", { ascending: false });
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((request) => tenant ? toTenantRequest(request) : request);
}

export async function loadMaintenanceRequestById(requestId) {
  const { data, error } = await supabase.from("maintenance_requests").select("*").eq("id", requestId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadAdminMaintenanceDetail(requestId) {
  const [requestResult, entriesResult, attachmentsResult, analysesResult, requestItemsResult, eventsResult] = await Promise.all([
    supabase.from("maintenance_requests").select("*").eq("id", requestId).single(),
    supabase.from("maintenance_request_entries").select("*").eq("maintenance_request_id", requestId).order("created_at", { ascending: true }),
    supabase.from("maintenance_attachments").select("*").eq("maintenance_request_id", requestId).order("created_at", { ascending: true }),
    supabase.from("maintenance_analyses").select("*").eq("maintenance_request_id", requestId).order("sequence_number", { ascending: false }),
    supabase.from("items").select("id,title,note,kind,material_type,status,maintenance_analysis_id,created_at,updated_at,completed_at").eq("maintenance_request_id", requestId).order("created_at", { ascending: true }),
    supabase.from("maintenance_request_events").select("*").eq("maintenance_request_id", requestId).order("created_at", { ascending: false }),
  ]);
  for (const result of [requestResult, entriesResult, attachmentsResult, analysesResult, requestItemsResult, eventsResult]) {
    if (result.error) throw result.error;
  }
  const analysisIds = (analysesResult.data || []).map((analysis) => analysis.id);
  const directItemsResult = analysisIds.length
    ? await supabase
      .from("items")
      .select("id,title,note,kind,material_type,status,maintenance_analysis_id,created_at,updated_at,completed_at")
      .in("maintenance_analysis_id", analysisIds)
      .is("maintenance_request_id", null)
      .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (directItemsResult.error) throw directItemsResult.error;
  const photoAttachments = (attachmentsResult.data || []).filter((attachment) => attachment.kind === "photo");
  const attachmentIds = photoAttachments.map((attachment) => attachment.id);
  const [childRequestsResult, attachmentLinksResult] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id,title")
      .eq("parent_request_id", requestId)
      .order("created_at", { ascending: true }),
    attachmentIds.length
      ? supabase
        .from("maintenance_attachment_case_links")
        .select("id,attachment_id,maintenance_request_id")
        .in("attachment_id", attachmentIds)
      : supabase
        .from("maintenance_attachment_case_links")
        .select("id,attachment_id,maintenance_request_id")
        .eq("maintenance_request_id", requestId),
  ]);
  if (childRequestsResult.error) throw childRequestsResult.error;
  if (attachmentLinksResult.error) throw attachmentLinksResult.error;
  const linkedAttachmentIds = [...new Set((attachmentLinksResult.data || []).map((link) => link.attachment_id))];
  const linkedAttachmentsResult = linkedAttachmentIds.length
    ? await supabase
      .from("maintenance_attachments")
      .select("*")
      .in("id", linkedAttachmentIds)
    : { data: [], error: null };
  if (linkedAttachmentsResult.error) throw linkedAttachmentsResult.error;
  return {
    request: requestResult.data,
    entries: entriesResult.data || [],
    attachments: attachmentsResult.data || [],
    attachmentLinks: attachmentLinksResult.data || [],
    childRequests: childRequestsResult.data || [],
    linkedAttachments: linkedAttachmentsResult.data || [],
    analyses: analysesResult.data || [],
    items: [...(requestItemsResult.data || []), ...(directItemsResult.data || [])],
    events: eventsResult.data || [],
  };
}

export async function setMaintenanceAttachmentCaseLinks({ attachmentId, maintenanceRequestIds }) {
  const { error: deleteError } = await supabase
    .from("maintenance_attachment_case_links")
    .delete()
    .eq("attachment_id", attachmentId);
  if (deleteError) throw deleteError;
  if (maintenanceRequestIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("maintenance_attachment_case_links")
    .insert(maintenanceRequestIds.map((maintenanceRequestId) => ({
      attachment_id: attachmentId,
      maintenance_request_id: maintenanceRequestId,
    })));
  if (insertError) throw insertError;
}

export async function loadTenantMaintenanceDetail(requestId) {
  const [requestResult, entriesResult, attachmentsResult] = await Promise.all([
    supabase.from("maintenance_requests").select("id,workspace_id,property_id,unit_id,source_type,title,original_description,tenant_status,created_at,updated_at,resolved_at").eq("id", requestId).single(),
    supabase.from("maintenance_request_entries").select("id,entry_type,content,transcript,created_at").eq("maintenance_request_id", requestId).eq("visibility", "tenant").order("created_at", { ascending: true }),
    supabase.from("maintenance_attachments").select("id,entry_id,kind,file_name,mime_type,storage_path,created_at").eq("maintenance_request_id", requestId).eq("visibility", "tenant").order("created_at", { ascending: true }),
  ]);
  for (const result of [requestResult, entriesResult, attachmentsResult]) {
    if (result.error) throw result.error;
  }
  return {
    request: toTenantRequest(requestResult.data),
    entries: entriesResult.data || [],
    attachments: attachmentsResult.data || [],
  };
}

export async function submitMaintenanceRequest({
  workspaceId,
  propertyId,
  unitId,
  tenantMembershipId = null,
  user,
  description = "",
  audioFile = null,
  photoFiles = [],
  sourceType,
  title,
  visibility,
  submission = {},
}) {
  const isTenant = Boolean(tenantMembershipId);
  const requestSource = sourceType || (isTenant
    ? audioFile ? "tenant-audio" : "tenant-text"
    : audioFile ? "admin-audio" : "admin-text");
  const requestTitle = title?.trim() || getRequestTitle(description, audioFile, isTenant);
  submission.id ||= crypto.randomUUID();
  const request = submission.request || await insertRecoverable("maintenance_requests", {
    id: submission.id,
    workspace_id: workspaceId,
    property_id: propertyId,
    unit_id: unitId || null,
    tenant_membership_id: tenantMembershipId,
    source_type: requestSource,
    submitter_id: user.id,
    submitter_email: user.email || null,
    title: requestTitle,
    original_description: description.trim(),
  });
  submission.request = request;
  submission.steps ||= new Map();

  try {
    await saveMaintenanceSources({ request, user, description, audioFile, photoFiles, visibility,
      authorType: isTenant ? "tenant" : "admin", entryType: "description", submission });
    await processMaintenanceRequest(request.id);
    return request;
  } catch (sourceError) {
    // The request is intentionally retained for safe retry if a later source or
    // AI call fails after the permanent case has been created.
    throw new Error(`Request saved, but additional processing failed: ${sourceError.message}`);
  }
}

export async function inspectPublicMaintenanceCapability(token) {
  const { data, error } = await supabase.functions.invoke("submit-maintenance-request", {
    body: { action: "inspect", token },
  });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail || "This maintenance link is unavailable.");
  }
  if (!data?.propertyName || !data?.unitName) throw new Error("This maintenance link is unavailable.");
  return data;
}

export async function submitPublicMaintenanceRequest({
  token,
  submissionId,
  website = "",
  description = "",
  contactName = "",
  contactEmail = "",
  contactPhone = "",
  photoFiles = [],
  audioFile = null,
}) {
  const form = new FormData();
  form.set("action", "submit");
  form.set("token", token);
  form.set("submissionId", submissionId);
  form.set("description", description);
  form.set("contactName", contactName);
  form.set("contactEmail", contactEmail);
  form.set("contactPhone", contactPhone);
  form.set("website", website);
  photoFiles.forEach((file) => form.append("photos", file, file.name));
  if (audioFile) form.append("audio", audioFile, audioFile.name);

  const { data, error } = await supabase.functions.invoke("submit-maintenance-request", { body: form });
  if (error) {
    const detail = await readFunctionError(error);
    const submissionError = new Error(detail || "We couldn’t send that request. Please try again.");
    submissionError.status = error.context?.status;
    throw submissionError;
  }
  if (!data?.received) throw new Error("We couldn’t send that request. Please try again.");
  return data;
}

export async function addMaintenanceInformation({ request, user, content = "", audioFile = null, photoFiles = [], visibility, submission = {} }) {
  submission.steps ||= new Map();
  await saveMaintenanceSources({ request, user, description: content, audioFile, photoFiles, visibility,
    authorType: visibility === "tenant" ? "tenant" : "admin", entryType: "note", submission });
  await processMaintenanceRequest(request.id);
}

async function saveMaintenanceSources({ request, user, description, audioFile, photoFiles, visibility, authorType, entryType, submission }) {
  async function step(key, save) {
    if (!submission.steps.has(key)) submission.steps.set(key, {});
    const progress = submission.steps.get(key);
    if (!progress.done) { await save(progress); progress.done = true; }
  }
  if (description.trim()) await step("description", async (progress) => {
    progress.id ||= crypto.randomUUID();
    await addMaintenanceEntry({ requestId: request.id, user, authorType, entryType, visibility, content: description.trim(), id: progress.id });
  });
  if (audioFile) await step("audio", progress => addMaintenanceMedia({ request, user, file: audioFile, authorType, entryType: "audio", visibility, progress }));
  for (const [index, file] of photoFiles.entries()) {
    await step(`photo:${index}`, progress => addMaintenanceMedia({ request, user, file, authorType, entryType: "photo", visibility, progress }));
  }
}

// Deterministic IDs let retries recover an insert whose response was lost.
async function insertRecoverable(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (!error) return data;
  const existing = await supabase.from(table).select("*").eq("id", row.id).maybeSingle();
  if (!existing.error && existing.data) return existing.data;
  throw error;
}

export async function addMaintenanceEntry({ requestId, user, authorType, entryType, visibility, content = "", id = crypto.randomUUID() }) {
  return insertRecoverable("maintenance_request_entries", {
    id,
    maintenance_request_id: requestId,
    author_type: authorType,
    author_id: user.id,
    author_email: user.email || null,
    entry_type: entryType,
    visibility,
    content,
  });
}

export async function addMaintenanceMedia({ request, user, file, authorType, entryType, visibility, progress = {} }) {
  progress.entryId ||= crypto.randomUUID();
  progress.attachmentId ||= crypto.randomUUID();
  const entry = await addMaintenanceEntry({
    id: progress.entryId,
    requestId: request.id,
    user,
    authorType,
    entryType,
    visibility,
  });
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const path = `${request.workspace_id}/${request.id}/${entry.id}/${progress.attachmentId}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(MAINTENANCE_BUCKET)
    .upload(path, file, { upsert: false });
  if (uploadError && String(uploadError.statusCode) !== "409") throw uploadError;

  return insertRecoverable("maintenance_attachments", {
    id: progress.attachmentId,
    maintenance_request_id: request.id,
    entry_id: entry.id,
    visibility,
    kind: getAttachmentKind(file, entryType === "audio" ? "audio" : "file"),
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    storage_path: path,
  });
}

export async function getMaintenanceAttachmentUrl(path) {
  const { data, error } = await supabase.storage
    .from(MAINTENANCE_BUCKET)
    .createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function processMaintenanceRequest(maintenanceRequestId, { forceRetry = false } = {}) {
  const { data, error } = await supabase.functions.invoke("process-maintenance-request", {
    body: { maintenanceRequestId, forceRetry },
  });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail || error.message || "Maintenance processing failed.");
  }
  return data;
}

export async function approveMaintenanceItem(itemId) {
  const { error } = await supabase
    .from("items")
    .update({ status: "approved", completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw error;
}

export async function rejectMaintenanceItem(itemId) {
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function resolveMaintenanceRequest(requestId) {
  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      status: "resolved",
      tenant_status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw error;
}

export async function reopenMaintenanceRequest(requestId) {
  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      status: "under-review",
      tenant_status: "received",
      resolved_at: null,
    })
    .eq("id", requestId);
  if (error) throw error;
}

function toTenantRequest(request) {
  if (!request) return request;
  return {
    id: request.id,
    workspace_id: request.workspace_id,
    property_id: request.property_id,
    unit_id: request.unit_id,
    source_type: request.source_type,
    title: request.title,
    original_description: request.original_description,
    status: request.tenant_status || "received",
    created_at: request.created_at,
    updated_at: request.updated_at,
    resolved_at: request.resolved_at,
  };
}

function getRequestTitle(description, audioFile, isTenant) {
  const firstSentence = description.trim().split(/[.!?\n]/)[0].trim();
  if (firstSentence) return firstSentence.slice(0, 140);
  if (audioFile) return isTenant ? "Voice maintenance request" : "Admin voice intake";
  return "Maintenance request";
}

async function readFunctionError(error) {
  try {
    const body = await error.context?.json();
    return body?.error || body?.message;
  } catch {
    return null;
  }
}
