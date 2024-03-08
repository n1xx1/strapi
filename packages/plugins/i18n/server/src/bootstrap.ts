import type { Strapi } from '@strapi/strapi';

import { getService } from './utils';

const registerModelsHooks = () => {
  const i18nModelUIDs = Object.values(strapi.contentTypes)
    .filter((contentType) => getService('content-types').isLocalizedContentType(contentType))
    .map((contentType) => contentType.uid);

  strapi.documents.use(async (context, next) => {
    // @ts-expect-error ContentType is not typed correctly on the context
    const schema = context.contentType;

    // TODO find all th actions we need the middleware for
    if (!['create', 'update', 'createEntry'].includes(context.action)) {
      return next(context);
    }

    if (!i18nModelUIDs.includes(schema.uid)) {
      return next(context);
    }

    // Collect the result of the document service action and sync non localized
    // attributes based on the response
    const result = (await next(context)) as any;
    await getService('localizations').syncNonLocalizedAttributes(result, schema);

    return result;
  });
};

export default async ({ strapi }: { strapi: Strapi }) => {
  const { sendDidInitializeEvent } = getService('metrics');
  const { decorator } = getService('entity-service-decorator');
  const { initDefaultLocale } = getService('locales');
  const { sectionsBuilder, actions, engine } = getService('permissions');

  // TODO: v5 handled in the document service or via document service middlewares
  // Entity Service
  (strapi.entityService as any).decorate(decorator);

  // Data
  await initDefaultLocale();

  // Sections Builder
  sectionsBuilder.registerLocalesPropertyHandler();

  // Actions
  await actions.registerI18nActions();
  actions.registerI18nActionsHooks();
  actions.updateActionsProperties();

  // Engine/Permissions
  engine.registerI18nPermissionsHandlers();

  // Hooks & Models
  registerModelsHooks();

  sendDidInitializeEvent();
};
