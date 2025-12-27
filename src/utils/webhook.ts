import ky from 'ky';
import { DateTime } from 'luxon';
import * as TypesGameEntry from '../types/GameEntry.js';
import configAuth from './configAuth.js';
import logger from './logger.js';
import mathUtils from './math.js';
import redeemUtils from './redeem.js';
import { type SignRspObjType } from './sign.js';

async function sendDiscordWebhook(context: Record<string, any>) {
  logger.info('Sending Discord webhook ...');
  for (const webhookUrl of configAuth.discordWebhookList) {
    await ky.post(webhookUrl, {
      json: { embeds: [context] },
    });
  }
}

function bulidWebhookContext(
  signAllRsp: {
    auth: (typeof configAuth.userList)[number];
    response: SignRspObjType[];
  }[],
  timer: Record<'start' | 'end', number>,
) {
  const errorLevelToPretty = (errorLevel: number, type: 'emojiText' | 'emoji' | 'colorHex'): string => {
    const def: Record<number, Record<'emojiText' | 'emoji' | 'colorHex', string>> = {
      0: {
        emojiText: '✅ Everything is OK',
        emoji: '✅',
        colorHex: '00ff00',
      },
      1: {
        emojiText: '⚠️ Warning',
        emoji: '⚠️',
        colorHex: 'ffff00',
      },
      2: {
        emojiText: '⛔ An error occurred',
        emoji: '⛔',
        colorHex: 'ff0000',
      },
    };
    if (errorLevel <= 2) {
      return def[errorLevel]?.[type]!;
    } else {
      return def[2]?.[type]!;
    }
  };
  return {
    author: {
      name: 'HoYoLAB Auto Check-in',
    },
    title: (() => {
      const maxErrorLevel = Math.max(...signAllRsp.flatMap((e) => e.response).map((e) => e.errorLevel));
      return errorLevelToPretty(maxErrorLevel, 'emojiText');
    })(),
    description: `Processed in: **${Math.ceil(timer.end - timer.start)} ms**`,
    fields: signAllRsp.map((user) => ({
      name: user.auth.displayUserName,
      value:
        '```\n' +
        user.response
          .map(
            (userRsp) =>
              (userRsp.gameEntry + ':').padEnd(6, ' ') +
              ' ' +
              errorLevelToPretty(userRsp.errorLevel, 'emoji') +
              ' ' +
              (() => {
                if (userRsp.isChecked) return 'Already claimed';
                if (userRsp.isOK) return 'OK';
                return userRsp.json['message'].replaceAll('\n', ' ');
              })(),
          )
          .join('\n') +
        '\n```',
      inline: false,
    })),
    color: (() => {
      const maxErrorLevel = Math.max(...signAllRsp.flatMap((e) => e.response).map((e) => e.errorLevel));
      return parseInt(errorLevelToPretty(maxErrorLevel, 'colorHex'), 16);
    })(),
    timestamp: DateTime.now().toISO(),
  };
}

function buildWebhookContextRedeemer(
  redeemRetArr: {
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
  }[],
) {
  return {
    author: {
      name: 'HoYoLAB Auto Redemption',
    },
    title: 'Redemption Result',
    // description: `Processed in: **${Math.ceil(timer.end - timer.start)} ms**`,
    description: (() => {
      const codesOk = [...new Set(redeemRetArr.filter((e) => e.result.resultType === 'ok').map((e) => e.code))];
      const codesExpired = [
        ...new Set(redeemRetArr.filter((e) => e.result.resultType === 'expired').map((e) => e.code)),
      ];
      const codesReachedUsageLimit = [
        ...new Set(redeemRetArr.filter((e) => e.result.resultType === 'reachedUsageLimit').map((e) => e.code)),
      ];
      const codesNotEnoughLv = redeemRetArr.filter((e) => e.result.resultType === 'notEnoughLv');
      const codesUnknown = redeemRetArr.filter((e) => e.result.resultType === 'unknown');
      // return `Found **${codesOk.length}** valid codes\nFound **${codesExpired.length}** expired codes`;
      return [
        `**${codesOk.length}** codes success`,
        `**${codesExpired.length}** codes expired`,
        `**${codesReachedUsageLimit.length}** codes reached limit`,
        `**${codesNotEnoughLv.length}** accounts not enough lv`,
        `**${codesUnknown.length}** unknown error occured`,
      ].join('\n');
    })(),
    fields: (() => {
      const outArr: { name: string; value: string; inline: boolean }[] = [];
      configAuth.userList.forEach((authUserEntry) => {
        let isValueExist: boolean = false;
        const valueTmp = (() => {
          const outValueTextArr: string[] = [];
          const outValueTextSubArr: [string, string, string][] = [];
          const filteredRetArr = redeemRetArr.filter(
            (e) => e.hoyolabUid === authUserEntry.hoyolabUid && e.result.resultType === 'ok',
          );
          for (const gameName of [...new Set(filteredRetArr.map((e) => e.game))]) {
            for (const regionName of [
              ...new Set(filteredRetArr.filter((e) => e.game === gameName).map((e) => e.account.region)),
            ]) {
              const subFilteredRetArr = filteredRetArr.filter(
                (e) => e.game === gameName && e.account.region === regionName,
              );
              const okCodes = [...new Set(subFilteredRetArr.map((e) => e.code))];
              if (okCodes.length === 0) continue;
              outValueTextSubArr.push([`${gameName}, `, `${regionName}: `, `${okCodes.length} codes`]);
              isValueExist = true;
            }
          }
          outValueTextArr.push(
            ...outValueTextSubArr.map((e) =>
              [
                e[0].padEnd(mathUtils.arrayMax(outValueTextSubArr.map((f) => f[0].length))),
                e[1].padEnd(mathUtils.arrayMax(outValueTextSubArr.map((f) => f[1].length))),
                e[2].padEnd(mathUtils.arrayMax(outValueTextSubArr.map((f) => f[2].length))),
              ].join(''),
            ),
          );
          return ['```', ...outValueTextArr, '```'].join('\n');
        })();
        if (isValueExist) outArr.push({ name: authUserEntry.displayUserName, value: valueTmp, inline: false });
      });
      return outArr;
    })(),
    color: 0xa0a0a0,
    timestamp: DateTime.now().toISO(),
  };
}

export default {
  bulidWebhookContext,
  sendDiscordWebhook,
  buildWebhookContextRedeemer,
};
