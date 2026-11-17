"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, uploadImage } from "@/lib/upload-image";
import type { UploadVia } from "@/server/storage";
import { Avatar, type AvatarPerson } from "./avatar";
import { Button } from "./button";
import { noteId } from "./field";

export type AvatarUploadError = "type" | "too_large" | "unavailable" | "failed";

/**
 * "Poza de profil": the picture as the profile will show it, a button to
 * upload one (cropped square on the server, `uploadImage`) and one to remove
 * it. Nothing is saved until the form is.
 */
export function AvatarPicker({
  uploadVia,
  id,
  person,
  onChange,
  error,
  onError,
}: {
  uploadVia: UploadVia;
  id: string;
  /** The person as they'll appear, `avatarUrl` being the form's value. */
  person: AvatarPerson;
  onChange: (url: string | null) => void;
  error: string | null;
  /** Null clears it. */
  onError: (error: AvatarUploadError | null) => void;
}) {
  const t = useTranslations("profile.form.avatar");
  const input = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onError(null);
    setAnnouncement("");
    if (!IMAGE_TYPES.includes(file.type)) return onError("type");
    if (file.size > IMAGE_MAX_BYTES) return onError("too_large");
    setPending(true);
    const answer = await uploadImage(file, "avatar", uploadVia);
    setPending(false);
    if (!answer.ok) {
      return onError(answer.reason === "signed_out" ? "failed" : answer.reason);
    }
    onChange(answer.url);
    setAnnouncement(t("uploaded"));
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={noteId(id)}
      className="flex flex-col gap-2"
    >
      <span id={`${id}-label`} className="text-[15px] font-bold leading-[22px]">
        {t("label")}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar person={person} size={72} />
        <div className="flex flex-wrap gap-2">
          <Button
            ref={uploadButton}
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            aria-invalid={error ? true : undefined}
            onClick={() => input.current?.click()}
          >
            {pending
              ? t("uploading")
              : person.avatarUrl
                ? t("replace")
                : t("upload")}
          </Button>
          {person.avatarUrl && !pending && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onError(null);
                onChange(null);
                setAnnouncement(t("removed"));
                // The button goes away: keep the focus in the group.
                uploadButton.current?.focus();
              }}
            >
              {t("remove")}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div aria-live="polite">
        {error ? (
          <span
            id={noteId(id)}
            className="flex items-start gap-1.5 text-sm font-semibold text-warning-ink"
          >
            <CircleAlert
              size={18}
              strokeWidth={2.2}
              aria-hidden
              className="shrink-0"
            />
            {error}
          </span>
        ) : (
          <span id={noteId(id)} className="block text-sm text-muted">
            {announcement || t("hint")}
          </span>
        )}
      </div>
    </div>
  );
}
