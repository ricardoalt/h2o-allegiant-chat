export type LambdaFunctionUrlEvent = {
  version?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    domainName?: string;
    http?: {
      method?: string;
      path?: string;
      protocol?: string;
      sourceIp?: string;
      userAgent?: string;
    };
    requestId?: string;
  };
  body?: string | null;
  isBase64Encoded?: boolean;
};

export type LambdaResponseStream = NodeJS.WritableStream & {
  setContentType?: (contentType: string) => void;
};

type ResponseStreamMetadata = {
  statusCode?: number;
  headers?: Record<string, string>;
};

type PipeOptions = {
  decorateResponseStream?: (
    responseStream: LambdaResponseStream,
    metadata: ResponseStreamMetadata,
  ) => LambdaResponseStream;
};

const DEFAULT_ALLOWED_HEADERS = ["authorization", "content-type", "x-request-id"];
const DEFAULT_ALLOWED_METHODS = ["POST", "OPTIONS"];
const DEFAULT_EXPOSED_HEADERS = ["x-error-code", "x-request-id"];

const normalizeHeaders = (headers: LambdaFunctionUrlEvent["headers"]): Headers => {
  const next = new Headers();

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      next.set(name, value);
    }
  }

  return next;
};

const bodyBytes = (event: LambdaFunctionUrlEvent): Buffer => {
  if (!event.body) {
    return Buffer.from("");
  }

  return event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
};

const validateJsonBody = (headers: Headers, bytes: Buffer): void => {
  const contentType = headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") || bytes.length === 0) {
    return;
  }

  try {
    JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Malformed JSON request body.");
  }
};

export const createLambdaRequest = (event: LambdaFunctionUrlEvent): Request => {
  const method = event.requestContext?.http?.method ?? "GET";
  const headers = normalizeHeaders(event.headers);
  const bytes = bodyBytes(event);
  validateJsonBody(headers, bytes);

  const host = headers.get("host") ?? event.requestContext?.domainName;
  if (!host) {
    throw new Error("Missing Function URL host.");
  }

  const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `https://${host}${path}${query}`;

  return new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : new Uint8Array(bytes),
  });
};

export const rejectUnsupportedMethod = (_method: string): Response =>
  new Response("Method not allowed.", {
    status: 405,
    headers: {
      allow: DEFAULT_ALLOWED_METHODS.join(", "),
      "content-type": "text/plain; charset=utf-8",
    },
  });

export const isAllowedCorsOrigin = ({
  origin,
  allowedOrigins,
}: {
  origin?: string;
  allowedOrigins: string[];
}): boolean => origin === undefined || allowedOrigins.includes(origin);

export const corsResponseHeaders = (origin: string): Record<string, string> => ({
  "access-control-allow-origin": origin,
  "access-control-expose-headers": DEFAULT_EXPOSED_HEADERS.join(", "),
  vary: "origin",
});

export const buildCorsPreflightResponse = ({
  origin,
  allowedOrigins,
}: {
  origin?: string;
  allowedOrigins: string[];
}): Response => {
  const isAllowed = origin !== undefined && allowedOrigins.includes(origin);
  if (!isAllowed) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-headers": DEFAULT_ALLOWED_HEADERS.join(", "),
      "access-control-allow-methods": DEFAULT_ALLOWED_METHODS.join(", "),
      "access-control-max-age": "600",
      ...corsResponseHeaders(origin),
    },
  });
};

const responseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (!headers["cache-control"]) {
    headers["cache-control"] = "no-cache, no-transform";
  }

  return headers;
};

export const pipeResponseToStream = async (
  response: Response,
  responseStream: LambdaResponseStream,
  options: PipeOptions = {},
): Promise<void> => {
  const headers = responseHeaders(response);
  const stream = options.decorateResponseStream
    ? options.decorateResponseStream(responseStream, { statusCode: response.status, headers })
    : responseStream;

  if (!options.decorateResponseStream && headers["content-type"]) {
    stream.setContentType?.(headers["content-type"]);
  }

  try {
    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 0) {
        stream.write(Buffer.from(bytes));
      }
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      if (value) {
        stream.write(Buffer.from(value));
      }
    }
  } finally {
    stream.end();
  }
};
