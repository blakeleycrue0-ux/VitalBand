export function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Never echo raw error objects/stack traces to the client — log server-side
// for debugging and return a single friendly, generic message instead.
export function safeError(context, err, statusCode = 500, message = 'Something went wrong. Please try again shortly.') {
  console.error(`[${context}]`, err);
  return json(statusCode, { message });
}
