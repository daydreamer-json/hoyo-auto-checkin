import ky from 'ky';
import appConfig from './config';
import configAuth from './configAuth';
import logger from './logger';
import * as TypesGameEntry from '../types/GameEntry';

type SignRspObjType = {
  gameEntry: TypesGameEntry.GameEntry;
  isOK: boolean;
  isChecked: boolean;
  isUnknown: boolean;
  isCaptchaProtected: boolean;
  errorLevel: number;
  json: Record<string, any>;
};

async function signSingleUser(userObject: (typeof configAuth.userList)[number]): Promise<{
  auth: (typeof configAuth.userList)[number];
  response: SignRspObjType[];
}> {
  const signRspArray: SignRspObjType[] = [];
  for (const gameEntry of TypesGameEntry.gameEntryArray) {
    if (userObject.enableService[gameEntry]) {
      logger.debug(`Processing: uid=${userObject.hoyolabUid}, ${gameEntry} ...`);
      const apiRsp: Record<string, any> = await ky('https://' + appConfig.network.signApi[gameEntry].url, {
        method: 'post',
        searchParams: new URLSearchParams({
          lang: userObject.hoyolabLang,
          act_id: appConfig.network.signApi[gameEntry].qs.act_id,
        }),
        headers: {
          Cookie: (() => {
            switch (userObject.hoyolabCookieVersion) {
              case 1:
                return `ltuid=${userObject.hoyolabUid}; ltoken=${userObject.hoyolabCookie.ltoken}; ltuid_v2=${userObject.hoyolabUid}; ltoken_v2=${userObject.hoyolabCookie.ltoken};`;
              case 2:
                return `ltuid_v2=${userObject.hoyolabUid}; ltoken_v2=${userObject.hoyolabCookie.ltoken};`;
              default:
                return '';
            }
          })(),
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          Referer: 'https://act.hoyolab.com/',
          Origin: 'https://act.hoyolab.com',
          'User-Agent': appConfig.network.userAgent.chromeWindows,
          'x-rpc-app_version': '2.34.1',
          'x-rpc-client_type': '4',
          'x-rpc-signgame': gameEntry.replace('nap', 'zzz'),
        },
      }).json();
      const retObj: SignRspObjType = (() => {
        const checkedRegex = /(済|もう受領したよ)/;
        let isCaptchaProtected: boolean = apiRsp.data?.gt_result?.is_risk ?? false;
        let errorLevel: number = 0;
        if (isCaptchaProtected === true) {
          errorLevel = 2;
        } else if (apiRsp.message != 'OK') {
          errorLevel = 1;
        }
        if (userObject.hoyolabLang === 'ja-jp' && checkedRegex.test(apiRsp.message as string)) {
          errorLevel = 0;
        }
        return {
          gameEntry,
          isOK:
            apiRsp.message === 'OK' ||
            (userObject.hoyolabLang === 'ja-jp' && checkedRegex.test(apiRsp.message as string)),
          isChecked: userObject.hoyolabLang === 'ja-jp' && checkedRegex.test(apiRsp.message as string),
          isUnknown:
            (userObject.hoyolabLang === 'ja-jp' && checkedRegex.test(apiRsp.message as string)) === false &&
            apiRsp.message != 'OK',
          isCaptchaProtected,
          errorLevel,
          json: apiRsp,
        };
      })();
      signRspArray.push(retObj);
    }
  }
  return { auth: userObject, response: signRspArray };
}

async function signAllUser() {
  logger.info('Auto claiming ...');
  const signRspUserArray = [];
  for (const userObject of configAuth.userList) {
    signRspUserArray.push(await signSingleUser(userObject));
  }
  return signRspUserArray;
}

export default {
  signSingleUser,
  signAllUser,
};
export type { SignRspObjType };
