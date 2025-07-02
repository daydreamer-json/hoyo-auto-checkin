import signUtils from '../utils/sign';
import webhookUtils from '../utils/webhook';
import logger from '../utils/logger';

async function mainCmdHandler() {
  const timer: Record<'start' | 'end', number> = {
    start: 0,
    end: 0,
  };
  timer.start = performance.now();
  const rsp = await signUtils.signAllUser();
  timer.end = performance.now();
  const webhookContext = webhookUtils.bulidWebhookContext(rsp, timer);
  await webhookUtils.sendDiscordWebhook(webhookContext);
  logger.info('Completed');
}

export default mainCmdHandler;
