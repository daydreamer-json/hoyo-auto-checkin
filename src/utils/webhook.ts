import ky from 'ky';
import { DateTime } from 'luxon';
import configAuth from './configAuth';
import logger from './logger';
import signUtils, { type SignRspObjType } from './sign';

async function sendDiscordWebhook(context: Record<string, any>) {
  logger.info('Sending Discord webhook ...');
  for (const webhookUrl of configAuth.discordWebhookList) {
    const rsp = await ky.post(webhookUrl, {
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
                return userRsp.json.message.replaceAll('\n', ' ');
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

export default {
  bulidWebhookContext,
  sendDiscordWebhook,
};
