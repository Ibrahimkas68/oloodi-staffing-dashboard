import { Router } from 'express';
import { buildOpenApiDocument, renderDocsPage } from '../openapi.js';

export function docsRoutes(demoMode: boolean): Router {
  const router = Router();
  // The document only depends on code, so build it once.
  const document = buildOpenApiDocument({ demoMode });
  const page = renderDocsPage(document);

  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });

  router.get('/docs', (_req, res) => {
    res.type('html').send(page);
  });

  return router;
}
