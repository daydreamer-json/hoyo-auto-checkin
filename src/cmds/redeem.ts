import PQueue from 'p-queue';
import * as TypesGameEntry from '../types/GameEntry.js';
import configAuth from '../utils/configAuth.js';
import logger from '../utils/logger.js';
import redeemUtils from '../utils/redeem.js';
import webhookUtils from '../utils/webhook.js';

async function mainCmdHandler() {
  const detectedRedeemCodes: Record<TypesGameEntry.RedeemGameEntry, string[]> = {
    hk4e: await redeemUtils.getAvailableCodesHk4e(),
    nap: await redeemUtils.getAvailableCodesNap(),
  };
  console.log(detectedRedeemCodes);
  // =======================================
  const gameServersRsp = await redeemUtils.getAllGameServers();
  const gameDataRspArray = await (async () => {
    const tmpArr: {
      hoyolabUid: number;
      data: Awaited<ReturnType<typeof redeemUtils.getAllGameAccounts>>;
    }[] = [];
    const queue = new PQueue({ concurrency: 8 });
    for (const authUserEntry of configAuth.userList) {
      queue.add(async () => {
        const gameDataRsp = await redeemUtils.getAllGameAccounts(
          gameServersRsp,
          authUserEntry.hoyolabUid,
          authUserEntry.hoyolabCookie.ltoken,
        );
        tmpArr.push({
          hoyolabUid: authUserEntry.hoyolabUid,
          data: gameDataRsp,
        });
      });
    }
    await queue.onIdle();
    return tmpArr;
  })();
  // console.dir(gameDataRspArray, { depth: null });
  // =======================================
  const redeemResultArray: {
    hoyolabUid: number;
    game: TypesGameEntry.RedeemGameEntry;
    game_biz: string;
    account: {
      region: string;
      game_uid: string;
      nickname: string;
      level: number;
    };
    code: string;
    result: Awaited<ReturnType<typeof redeemUtils.doRedeemCode>>;
  }[] = [];
  await (async () => {
    logger.info('Attempting automatic redemption ...');
    const queue = new PQueue({ concurrency: 8 });
    for (const authUserEntry of configAuth.userList) {
      const gameDataRsp = gameDataRspArray
        .find((e) => e.hoyolabUid === authUserEntry.hoyolabUid)!
        .data.filter((e) => TypesGameEntry.redeemGameEntryArray.includes(e.game as TypesGameEntry.RedeemGameEntry));
      for (const gameDataRspEntry of gameDataRsp) {
        const gameName = gameDataRspEntry.game as TypesGameEntry.RedeemGameEntry;
        for (const gameAccEntry of gameDataRspEntry.account) {
          queue.add(async () => {
            const redeemCodeArray = detectedRedeemCodes[gameName];
            for (const [codeEntryIndex, codeEntry] of Object.entries(redeemCodeArray)) {
              const result = await redeemUtils.doRedeemCode(
                gameDataRspEntry.game as TypesGameEntry.RedeemGameEntry,
                gameAccEntry.region,
                codeEntry,
                authUserEntry.hoyolabUid,
                authUserEntry.hoyolabCookie.ltoken,
                gameAccEntry.game_uid,
              );
              redeemResultArray.push({
                hoyolabUid: authUserEntry.hoyolabUid,
                game: gameName,
                game_biz: gameDataRspEntry.game_biz,
                account: gameAccEntry,
                code: codeEntry,
                result,
              });
              parseInt(codeEntryIndex) < redeemCodeArray.length - 1
                ? await new Promise((resolve) => setTimeout(resolve, 5200))
                : undefined;
            }
          });
        }
      }
    }
    await queue.onIdle();
  })();
  await webhookUtils.sendDiscordWebhook(webhookUtils.buildWebhookContextRedeemer(redeemResultArray));
}

export default mainCmdHandler;
