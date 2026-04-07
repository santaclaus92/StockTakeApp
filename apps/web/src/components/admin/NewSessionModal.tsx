import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { NewSessionInput } from "../../types/domain";
import type { Session } from "../../types/domain";

const schema = z.object({
  name: z.string().min(3, "Session name must be at least 3 characters."),
  type: z.enum(["Year End", "Cycle Count"], { message: "Session type is required." }),
  country: z.enum(["Malaysia", "Singapore"], { message: "Country is required." }),
  entity: z.enum(["BMS", "BMSD", "BMSG"], { message: "Entity is required." }),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
  isRecount: z.boolean().default(false),
  parentSessionId: z.string().optional()
}).superRefine((value, context) => {
  if (value.isRecount && !value.parentSessionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Parent session is required for recount sessions.",
      path: ["parentSessionId"]
    });
  }
});

type SessionFormValues = z.infer<typeof schema>;

interface NewSessionModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (input: NewSessionInput) => Promise<void>;
  existingSessions?: Session[];
  mode?: "create" | "edit";
  initialSession?: Session | null;
}

function entityOptions(country: "Malaysia" | "Singapore"): Session["entity"][] {
  return country === "Malaysia" ? ["BMS", "BMSD"] : ["BMSG"];
}

export function NewSessionModal({
  open,
  loading,
  onClose,
  onCreate,
  existingSessions = [],
  mode = "create",
  initialSession = null
}: NewSessionModalProps) {
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<SessionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "Year End",
      country: "Malaysia",
      entity: "BMS",
      startDate: "",
      endDate: "",
      isRecount: false,
      parentSessionId: ""
    }
  });

  const country = watch("country");
  const isRecount = watch("isRecount");
  const selectedEntity = watch("entity");
  const allowedEntities = entityOptions(country);
  const parentCandidates = existingSessions.filter((session) => session.id !== initialSession?.id && session.status !== "Closed");

  useEffect(() => {
    if (!allowedEntities.includes(selectedEntity)) {
      setValue("entity", allowedEntities[0], { shouldValidate: true });
    }
  }, [allowedEntities, selectedEntity, setValue]);

  useEffect(() => {
    if (!open) return;
    reset({
      name: initialSession?.name ?? "",
      type: initialSession?.type ?? "Year End",
      country: initialSession?.country ?? "Malaysia",
      entity: initialSession?.entity ?? "BMS",
      startDate: initialSession?.startDate ?? "",
      endDate: initialSession?.endDate ?? "",
      isRecount: initialSession?.isRecount ?? false,
      parentSessionId: initialSession?.parentId ?? ""
    });
  }, [initialSession, open, reset]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form
        className="modal"
        onSubmit={handleSubmit(async (values) => {
          await onCreate({
            name: values.name,
            type: values.type,
            country: values.country,
            entity: values.entity,
            startDate: values.startDate,
            endDate: values.endDate,
            isRecount: values.isRecount,
            parentId: values.isRecount ? values.parentSessionId ?? null : null
          });
          reset();
          onClose();
        })}
      >
        <header className="legacy-modal-header">
          <div>
            <h2>{mode === "edit" ? "Edit session" : "New session"}</h2>
            <p>
              {mode === "edit"
                ? "Update the session details and save the changes."
                : "Fill in the details to create a new stocktake session."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="ghost-btn">
            X
          </button>
        </header>

        <label>
          Session Name
          <input {...register("name")} placeholder="Year End 2026 Malaysia" />
          {errors.name ? <span className="error">{errors.name.message}</span> : null}
        </label>

        <label>
          Session Type
          <select {...register("type")}>
            <option value="Year End">Year End</option>
            <option value="Cycle Count">Cycle Count</option>
          </select>
          {errors.type ? <span className="error">{errors.type.message}</span> : null}
        </label>

        <label>
          Country
          <select {...register("country")}>
            <option value="Malaysia">Malaysia</option>
            <option value="Singapore">Singapore</option>
          </select>
          {errors.country ? <span className="error">{errors.country.message}</span> : null}
        </label>

        <label>
          Entity
          <select {...register("entity")}>
            {allowedEntities.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
          {errors.entity ? <span className="error">{errors.entity.message}</span> : null}
        </label>

        <label>
          Start Date
          <input type="date" {...register("startDate")} />
          {errors.startDate ? <span className="error">{errors.startDate.message}</span> : null}
        </label>

        <label>
          End Date
          <input type="date" {...register("endDate")} />
          {errors.endDate ? <span className="error">{errors.endDate.message}</span> : null}
        </label>

        <label className="inline-checkbox">
          <input type="checkbox" {...register("isRecount")} />
          This is a recount session
        </label>

        {isRecount ? (
          <label>
            Parent Session
            <select {...register("parentSessionId")}>
              <option value="">Select parent session...</option>
              {parentCandidates.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.id} - {session.name}
                </option>
              ))}
            </select>
            {errors.parentSessionId ? <span className="error">{errors.parentSessionId.message}</span> : null}
          </label>
        ) : null}

        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? (mode === "edit" ? "Saving..." : "Creating...") : mode === "edit" ? "Save Changes" : "Create Session"}
          </button>
        </footer>
      </form>
    </div>
  );
}

