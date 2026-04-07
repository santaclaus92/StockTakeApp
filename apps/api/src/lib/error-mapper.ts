interface MappedError {
  statusCode: number;
  message: string;
  details?: unknown;
}

interface ErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function asErrorLike(value: unknown): ErrorLike {
  if (value && typeof value === "object") {
    return value as ErrorLike;
  }
  return {};
}

export function mapUnexpectedError(error: unknown): MappedError {
  const errorLike = asErrorLike(error);
  const code = typeof errorLike.code === "string" ? errorLike.code : "";
  const message = typeof errorLike.message === "string" ? errorLike.message : "Unexpected server error";

  if (code === "23505") {
    return {
      statusCode: 409,
      message: "Duplicate record detected.",
      details: errorLike.details
    };
  }

  if (code === "23503") {
    return {
      statusCode: 409,
      message: "Related record not found.",
      details: errorLike.details
    };
  }

  if (code === "23502" || code === "22P02") {
    return {
      statusCode: 400,
      message: "Invalid request data.",
      details: errorLike.details
    };
  }

  if (code === "42P01" || code === "PGRST200") {
    return {
      statusCode: 500,
      message: "Database schema is not ready for this operation.",
      details: errorLike.details
    };
  }

  if (code === "P0001") {
    return {
      statusCode: 409,
      message,
      details: errorLike.details
    };
  }

  if (message.toLowerCase().includes("fetch failed") || message.toLowerCase().includes("network")) {
    return {
      statusCode: 503,
      message: "Backend dependency unavailable. Please retry.",
      details: errorLike.details
    };
  }

  return {
    statusCode: 500,
    message,
    details: errorLike.details
  };
}
