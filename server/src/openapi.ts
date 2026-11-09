import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import {
  ACTIONS,
  ACTION_PATHS,
  actionResultSchema,
  apiErrorSchema,
  snapshotSchema,
  type Action,
} from '@staffing/shared';
import { z } from 'zod';

const API_TITLE = 'Live Staffing Dashboard API';
const API_VERSION = '1.0.0';

const ACTION_SUMMARY: Record<Action, string> = {
  invite: 'Invite a worker (manager)',
  accept: 'Accept an invitation (worker)',
  decline: 'Decline an invitation (worker)',
  cancel: 'Cancel an accepted assignment (worker)',
  check_in: 'Check in (worker)',
  check_out: 'Check out (worker)',
};

const ERROR_FORMAT_NOTE = [
  'Every error uses the ApiError format. Codes: VALIDATION_ERROR (400), NOT_FOUND (404),',
  'INVALID_TRANSITION (409, with `current`), SHIFT_FULL (409, with `current`, `filled`, `required`),',
  'RATE_LIMITED (429), UNAVAILABLE (503), INTERNAL (500).',
].join(' ');

// An `id` makes the generator emit a reusable component and reference it by name.
const Snapshot = snapshotSchema.meta({ id: 'Snapshot' });
const ActionResult = z
  .object({ ...actionResultSchema.shape, snapshot: Snapshot })
  .meta({ id: 'ActionResult' });
const ApiError = apiErrorSchema.meta({ id: 'ApiError' });

const healthSchema = z.object({ status: z.enum(['ok', 'degraded']), db: z.enum(['ok', 'down']) });

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

const errorResponse = (description: string) => ({ description, ...json(ApiError) });

const ERROR_RESPONSES = {
  400: errorResponse('VALIDATION_ERROR: the assignment id is not a positive whole number.'),
  404: errorResponse('NOT_FOUND: no such assignment or endpoint.'),
  409: errorResponse('INVALID_TRANSITION, or SHIFT_FULL when an accept finds no free place.'),
  429: errorResponse('RATE_LIMITED: too many actions in a minute.'),
  500: errorResponse('INTERNAL: nothing was saved. No stack trace is ever returned.'),
} satisfies RouteConfig['responses'];

function actionRoute(action: Action): RouteConfig {
  return {
    method: 'post',
    path: `/api/assignments/{id}/${ACTION_PATHS[action]}`,
    operationId: action,
    summary: ACTION_SUMMARY[action],
    description:
      'The request body is ignored. `changed: false` means the assignment was already in the target state.',
    tags: ['Assignments'],
    request: {
      params: z.object({ id: z.number().int().positive().meta({ description: 'Assignment id' }) }),
    },
    responses: {
      200: { description: 'The action result and the new snapshot.', ...json(ActionResult) },
      ...ERROR_RESPONSES,
    },
  };
}

const demoRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: '/api/demo/burst',
    summary: 'Fire 10 identical actions at once (demo mode only)',
    description:
      'Optional endpoint, available only when DEMO_MODE=true. Sends 10 parallel identical actions ' +
      'through the normal service path. `changed` is how many actually changed the assignment (expected 1).',
    tags: ['Demo'],
    request: {
      query: z.object({
        assignmentId: z.number().int().positive().meta({ description: 'Assignment id' }),
        action: z
          .enum(Object.values(ACTION_PATHS) as [string, ...string[]])
          .optional()
          .meta({ description: 'Action path segment. Defaults to check-in.' }),
      }),
    },
    responses: {
      200: {
        description: 'How many were sent and how many changed.',
        ...json(z.object({ sent: z.number(), changed: z.number() })),
      },
      400: errorResponse('VALIDATION_ERROR: bad assignmentId or action.'),
      404: errorResponse('NOT_FOUND: no such assignment.'),
      409: errorResponse('INVALID_TRANSITION: the action is not allowed from the current state.'),
      500: ERROR_RESPONSES[500],
    },
  },
  {
    method: 'post',
    path: '/api/demo/outage',
    summary: 'Simulate a live-update outage (demo mode only)',
    description:
      'Optional endpoint, available only when DEMO_MODE=true. Closes every live stream and answers 503 on ' +
      '`/api/events` for the given number of seconds, then recovers by itself.',
    tags: ['Demo'],
    request: {
      query: z.object({
        seconds: z.number().int().min(1).max(30).meta({ description: 'Outage length, 1 to 30' }),
      }),
    },
    responses: {
      202: { description: 'The outage has started.', ...json(z.object({ seconds: z.number() })) },
      400: errorResponse('VALIDATION_ERROR: seconds is outside 1 to 30.'),
      500: ERROR_RESPONSES[500],
    },
  },
];

/** Builds the OpenAPI 3.1 document from the shared zod schemas, so docs and validation cannot drift. */
export function buildOpenApiDocument({ demoMode = false }: { demoMode?: boolean } = {}) {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: 'get',
    path: '/api/state',
    summary: 'Current snapshot of the shift',
    tags: ['State'],
    responses: {
      200: { description: 'The full snapshot.', ...json(Snapshot) },
      500: ERROR_RESPONSES[500],
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/events',
    summary: 'Live updates (server-sent events)',
    description:
      'Sends a `snapshot` event with the full snapshot on connect and after every change.',
    tags: ['State'],
    responses: {
      200: {
        description: 'An event stream.',
        content: { 'text/event-stream': { schema: { type: 'string' } } },
      },
      503: errorResponse('UNAVAILABLE: the client limit is reached or an outage is simulated.'),
    },
  });
  ACTIONS.forEach((action) => registry.registerPath(actionRoute(action)));
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    summary: 'Health check',
    tags: ['Ops'],
    responses: {
      200: { description: 'The database is reachable.', ...json(healthSchema) },
      503: { description: 'The database is down.', ...json(healthSchema) },
    },
  });

  if (demoMode) demoRoutes.forEach((route) => registry.registerPath(route));

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: API_TITLE, version: API_VERSION, description: ERROR_FORMAT_NOTE },
  });
}

type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A static page with no script and no style, so it works under `default-src 'self'`. */
export function renderDocsPage(doc: OpenApiDocument): string {
  const operations = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item as Record<string, { summary?: string; responses: object }>).map(
      ([method, op]) =>
        `<li><code>${method.toUpperCase()} ${escapeHtml(path)}</code> ${escapeHtml(op.summary ?? '')} ` +
        `(responses: ${Object.keys(op.responses).join(', ')})</li>`,
    ),
  );
  const schemas = Object.keys(doc.components?.schemas ?? {}).map(
    (name) => `<li><code>${escapeHtml(name)}</code></li>`,
  );

  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${API_TITLE}</title></head><body>`,
    `<h1>${API_TITLE}</h1>`,
    '<p>The full contract is in <a href="/api/openapi.json">openapi.json</a> (OpenAPI 3.1).</p>',
    `<h2>Endpoints</h2><ul>${operations.join('')}</ul>`,
    `<h2>Schemas</h2><ul>${schemas.join('')}</ul>`,
    '</body></html>',
  ].join('\n');
}
