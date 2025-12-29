import CliTable3 from 'cli-table3';
import PQueue from 'p-queue';
import * as TypesGameEntry from '../types/GameEntry.js';
import appConfig from '../utils/config.js';
import configAuth from '../utils/configAuth.js';
import configWriterUtils from '../utils/configWriter.js';
import logger from '../utils/logger.js';
import redeemUtils from '../utils/redeem.js';
import webhookUtils from '../utils/webhook.js';

async function mainCmdHandler() {
  const detectedRedeemCodes: Record<TypesGameEntry.RedeemGameEntry, string[]> = {
    hk4e: await redeemUtils.getAvailableCodesHk4e(),
    hkrpg: await redeemUtils.getAvailableCodesHkrpg(),
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
    const queue = new PQueue({ concurrency: appConfig.threadCount.network });
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
  (() => {
    const table = new CliTable3({
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' ',
      },
      style: { 'padding-left': 0, 'padding-right': 0 },
    });
    table.push(
      ...[
        ['HoYoLAB', 'Game', 'Server', 'UID', 'Lv'],
        ...gameDataRspArray
          .map((a) =>
            a.data.map((b) =>
              b.account.map((c) => [
                a.hoyolabUid,
                b.game_biz,
                c.region,
                { hAlign: 'right' as const, content: c.game_uid },
                { hAlign: 'right' as const, content: c.level },
              ]),
            ),
          )
          .flat(2),
      ],
    );
    console.log(table.toString());
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
    const queue = new PQueue({ concurrency: appConfig.threadCount.network });
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
              if (
                configAuth.knownUsedCodes[authUserEntry.hoyolabUid]?.[gameName]?.[gameAccEntry.region]?.includes(
                  codeEntry,
                ) ||
                redeemResultArray.find(
                  (e) =>
                    e.code === codeEntry &&
                    ['expired', 'reachedUsageLimit', 'usedByOthers'].includes(e.result.resultType),
                )
              ) {
                continue;
              }
              const result = await redeemUtils.doRedeemCode(
                gameName,
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
  await (async () => {
    const codesOk = [...new Set(redeemResultArray.filter((e) => e.result.resultType === 'ok').map((e) => e.code))];
    const codesExpired = [
      ...new Set(
        redeemResultArray
          .filter((e) => ['expired', 'reachedUsageLimit', 'usedByOthers'].includes(e.result.resultType))
          .map((e) => e.code),
      ),
    ];
    const codesUnknown = redeemResultArray.filter((e) => e.result.resultType === 'unknown');
    if (codesOk.length + codesExpired.length + codesUnknown.length > 0) {
      await webhookUtils.sendDiscordWebhook(webhookUtils.buildWebhookContextRedeemer(redeemResultArray));
    }
    if (codesExpired.length > 0) {
      logger.info('New expired codes detected. Writing to config.yaml ...');
      await configWriterUtils.addKnownExpiredCodes(codesExpired);
    }
  })();
}

export default mainCmdHandler;
