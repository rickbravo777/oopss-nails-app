export async function uploadChatPhoto(
  sessionToken: string,
  file: File,
  purpose: "nail_reference" | "hair_desde_evaluation" = "nail_reference",
): Promise<{ id: string; filePath: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);

  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    headers: { "X-Session-Token": sessionToken },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "No se pudo subir la foto");
  }
  return res.json();
}
