import { articleWebhooks } from '~/server/webhooks/article.webhooks';
import { modelWebhooks } from '~/server/webhooks/model.webooks';
import { moderatorWebhooks } from '~/server/webhooks/moderator.webhooks';

export const webhookProcessors = {
  ...modelWebhooks,
  ...moderatorWebhooks,
  ...articleWebhooks,
};

export function getWebhookTypes() {
  const webhookTypes: Record<string, string> = {};
  for (const [type, { displayName }] of Object.entries(webhookProcessors)) {
    webhookTypes[type] = displayName;
  }
  return webhookTypes;
}
