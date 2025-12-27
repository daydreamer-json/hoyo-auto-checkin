import logger from '../utils/logger.js';
import signUtils from '../utils/sign.js';
import webhookUtils from '../utils/webhook.js';

async function mainCmdHandler() {
  const timer: Record<'start' | 'end', number> = {
    start: 0,
    end: 0,
  };
  timer.start = performance.now();
  const rsp = await signUtils.signAllUser();
  timer.end = performance.now();
  if (
    rsp
      .map((e) => e.response)
      .flat()
      .filter((e) => e.isChecked === false).length > 0
  ) {
    const webhookContext = webhookUtils.bulidWebhookContext(rsp, timer);
    await webhookUtils.sendDiscordWebhook(webhookContext);
  }
  logger.info('Completed');
}

export default mainCmdHandler;
