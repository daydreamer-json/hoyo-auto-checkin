import { JSDOM } from 'jsdom';
import ky from 'ky';
import PQueue from 'p-queue';
import * as TypesGameEntry from '../types/GameEntry.js';
import appConfig from './config.js';
import logger from './logger.js';
import omitDeep from './omitDeep.js';

async function getAvailableCodesOfficial(game: TypesGameEntry.RedeemGameEntry): Promise<string[]> {
  logger.debug('Searching codes from HoYoLAB API ...');
  const apiRsp: any = await ky
    .get('https://' + appConfig.network.redeemSearchApi[game].url, {
      headers: {
        'User-Agent': appConfig.network.userAgent.chromeWindows,
        'x-rpc-client_type': '4',
      },
      searchParams: { ...appConfig.network.redeemSearchApi[game].qs },
      timeout: appConfig.network.timeout,
      retry: { limit: appConfig.network.retryCount },
    })
    .json();
  return [
    ...new Set(
      apiRsp.data.modules
        .filter((e: any) => e.module_type === 7)
        .map((e: any) => e.exchange_group.bonuses.map((f: any) => f.exchange_code))
        .flat(),
    ),
  ] as string[];
}

async function getAvailableCodesCommunity(game: TypesGameEntry.RedeemGameEntry): Promise<string[]> {
  logger.debug('Searching codes from HoYoLAB community ...');
  const apiSearchRsp: any = await ky
    .get('https://' + appConfig.network.hoyolabCommunityApi.searchPost.url, {
      headers: {
        'User-Agent': appConfig.network.userAgent.chromeWindows,
        'x-rpc-client_type': '4',
        'x-rpc-language': 'ja-jp',
      },
      searchParams: {
        author_type: 0,
        game_id: (() => {
          if (game === 'nap') return 8;
          return 2;
        })(),
        is_all_game: false,
        keyword: '交換コード',
        order_type: 0,
        page_num: 1,
        page_size: 50,
        scene: 'SCENE_GENERAL',
      },
      timeout: appConfig.network.timeout,
      retry: { limit: appConfig.network.retryCount },
    })
    .json();
  if (!(apiSearchRsp.retcode === 0 && apiSearchRsp.message === 'OK')) throw new Error('HoYoLAB Community API error');
  const postIdList: string[] = apiSearchRsp.data.list.map((e: any) => e.post.post_id);
  const postStructDataArray = await (async () => {
    const tmpArr: Record<string, any>[][] = [];
    const queue = new PQueue({ concurrency: appConfig.threadCount.network });
    for (const postId of postIdList) {
      queue.add(async () => {
        const apiPostRsp: any = await ky
          .get('https://' + appConfig.network.hoyolabCommunityApi.getPostFull.url, {
            headers: {
              'User-Agent': appConfig.network.userAgent.chromeWindows,
              'x-rpc-client_type': '4',
              'x-rpc-language': 'ja-jp',
            },
            searchParams: { post_id: postId },
            timeout: appConfig.network.timeout,
            retry: { limit: appConfig.network.retryCount },
          })
          .json();
        if (!(apiPostRsp.retcode === 0 && apiPostRsp.message === 'OK')) throw new Error('HoYoLAB Community API error');
        tmpArr.push(JSON.parse(apiPostRsp.data.post.post.structured_content));
      });
    }
    await queue.onIdle();
    return tmpArr;
  })();
  // console.log(
  //   [
  //     ...new Set(
  //       postStructDataArray
  //         .map((e) => e.filter((f) => f['attributes'] && f['attributes']['link']).map((f) => f['attributes']['link']))
  //         .flat(),
  //     ),
  //   ]
  //     .toSorted()
  //     .join('\n'),
  // );
  const redeemLinkRegex = (() => {
    if (game === 'nap')
      return /^https?:\/\/zenless\.hoyoverse\.com\/redemption(?:\/m)?(?:\/ja)?(?:\/gift)?\?code=([^&]+)$/;
    return /^https?:\/\/genshin\.hoyoverse\.com(?:\/m)?(?:\/ja)?(?:\/gift)?\?code=([^&]+)$/;
  })();
  return [
    ...new Set(
      postStructDataArray
        .map((e) =>
          e
            .filter(
              (f) =>
                f['attributes'] &&
                f['attributes']['link'] &&
                redeemLinkRegex.exec(f['attributes']['link']) !== null &&
                redeemLinkRegex.exec(f['attributes']['link'])![1],
            )
            .map((f) => redeemLinkRegex.exec(f['attributes']['link'])![1]),
        )
        .flat(),
    ),
  ].toSorted() as string[];
}

async function getAvailableCodesHk4e() {
  logger.info('Searching for available redeem codes: hk4e ...');
  const official: string[] = await getAvailableCodesOfficial('hk4e');
  const community: string[] = await getAvailableCodesCommunity('hk4e');
  const fandom: string[] = await (async () => {
    logger.debug('Searching codes from Fandom Wiki ...');
    const apiRsp: any = await ky
      .get('https://genshin-impact.fandom.com/api.php', {
        headers: {
          'User-Agent': appConfig.network.userAgent.chromeWindows,
        },
        searchParams: { action: 'parse', format: 'json', page: 'Promotional Code' },
        timeout: appConfig.network.timeout,
        retry: { limit: appConfig.network.retryCount },
      })
      .json();
    const textRsp: string = apiRsp.parse.text['*'];
    logger.trace('Parsing HTML to generate a DOM tree ...');
    const dom = new JSDOM(textRsp);
    const document = dom.window.document;
    const result: string[] = [];
    [...[...document.getElementsByClassName('wikitable')][0]!.querySelectorAll('tbody tr')].forEach((tr, rowIndex) => {
      if (rowIndex === 0) return;
      if ([...tr.querySelectorAll('td')][1]!.textContent.trim() === 'China') return;
      result.push(
        ...[...[...tr.querySelectorAll('td')][0]!.querySelectorAll('a b code')].map((e) => e.textContent.trim()),
      );
    });
    return result;
  })();
  const gamewith: string[] = await (async () => {
    logger.debug('Searching codes from GameWith ...');
    const textRsp: any = await ky
      .get('https://gamewith.jp/genshin/article/show/231856', {
        headers: {
          'User-Agent': appConfig.network.userAgent.chromeWindows,
        },
        timeout: appConfig.network.timeout,
        retry: { limit: appConfig.network.retryCount },
      })
      .text();
    logger.trace('Parsing HTML to generate a DOM tree ...');
    const dom = new JSDOM(textRsp);
    const document = dom.window.document;
    const result: string[] = [];
    [...document.getElementsByClassName('genshin_table_table')].forEach((table, _tableIndex) => {
      [...table.querySelectorAll('tr')].forEach((tr, rowIndex) => {
        if (rowIndex === 0) return;
        result.push(tr.querySelector('div .w-clipboard-copy-ui')!.textContent);
      });
    });
    return result;
  })();
  return [...new Set([...official, ...community, ...fandom, ...gamewith])]
    .toSorted()
    .filter((e) => preCheckIsCodeNotExpired(e));
}

async function getAvailableCodesNap() {
  logger.info('Searching for available redeem codes: nap ...');
  const official = await getAvailableCodesOfficial('nap');
  const community: string[] = await getAvailableCodesCommunity('nap');
  const fandom: Record<'valid' | 'expired', string[]> = await (async () => {
    logger.debug('Searching codes from Fandom Wiki ...');
    const apiRsp: any = await ky
      .get('https://zenless-zone-zero.fandom.com/api.php', {
        headers: {
          'User-Agent': appConfig.network.userAgent.chromeWindows,
        },
        searchParams: { action: 'parse', format: 'json', page: 'Redemption Code' },
        timeout: appConfig.network.timeout,
        retry: { limit: appConfig.network.retryCount },
      })
      .json();
    const textRsp: string = apiRsp.parse.text['*'];
    logger.trace('Parsing HTML to generate a DOM tree ...');
    const dom = new JSDOM(textRsp);
    const document = dom.window.document;
    const result: string[] = [];
    const resultExpired: string[] = [];
    [...[...document.getElementsByClassName('wikitable')][0]!.querySelectorAll('tbody tr')].forEach((tr, rowIndex) => {
      if (rowIndex === 0) return;
      if ([...tr.querySelectorAll('td')][3]!.textContent.trim().includes('Expired')) {
        resultExpired.push([...tr.querySelectorAll('td')][0]!.querySelector('code')!.textContent);
        return;
      }
      result.push([...tr.querySelectorAll('td')][0]!.querySelector('code')!.textContent);
    });
    return { valid: result, expired: resultExpired };
  })();
  const gamewith: Record<'valid' | 'expired', string[]> = await (async () => {
    logger.debug('Searching codes from GameWith ...');
    const textRsp: any = await ky
      .get('https://gamewith.jp/zenless/452252', {
        headers: {
          'User-Agent': appConfig.network.userAgent.chromeWindows,
        },
        timeout: appConfig.network.timeout,
        retry: { limit: appConfig.network.retryCount },
      })
      .text();
    logger.trace('Parsing HTML to generate a DOM tree ...');
    const dom = new JSDOM(textRsp);
    const document = dom.window.document;
    const result: string[] = [];
    const resultExpired: string[] = [];
    [...document.querySelectorAll('table')]
      .filter((e) => e.querySelector('div .w-clipboard-copy-ui'))
      .forEach((table, tableIndex, tableArray) => {
        [...table.querySelectorAll('tr')].forEach((tr, rowIndex) => {
          if (rowIndex === 0) return;
          if (tableIndex === tableArray.length - 1) {
            resultExpired.push(tr.querySelector('div .w-clipboard-copy-ui')!.textContent);
          } else {
            result.push(tr.querySelector('div .w-clipboard-copy-ui')!.textContent);
          }
        });
      });
    return { valid: result, expired: resultExpired };
  })();
  return [
    ...new Set([
      ...official,
      ...community.filter((e) => !fandom.expired.includes(e) && !gamewith.expired.includes(e)),
      ...fandom.valid,
      ...gamewith.valid,
    ]),
  ]
    .toSorted()
    .filter((e) => preCheckIsCodeNotExpired(e));
}

function preCheckIsCodeNotExpired(code: string) {
  for (const knownCodeEntry of appConfig.redemption.knownExpiredCodes) {
    if (code.includes(knownCodeEntry)) return false;
  }
  return true;
}

async function getAllGameServers() {
  const retObj: {
    game: TypesGameEntry.GameEntry;
    game_biz: string;
    server: { name: string; region: string }[];
  }[] = [];
  logger.info('Fetching game server list ...');
  for (const gameName of TypesGameEntry.gameEntryArray) {
    logger.debug('Fetching game server list: ' + gameName + ' ...');
    const serverList = await (async () => {
      const apiRegionRsp: any = await ky
        .get('https://' + appConfig.network.accountApi.getServer.url, {
          headers: { 'User-Agent': appConfig.network.userAgent.chromeWindows },
          searchParams: { game_biz: gameName + '_global' },
          timeout: appConfig.network.timeout,
          retry: { limit: appConfig.network.retryCount },
        })
        .json();
      return apiRegionRsp.data.list as { name: string; region: string }[];
    })();
    retObj.push({
      game: gameName,
      game_biz: gameName + '_global',
      server: serverList,
    });
  }
  return retObj;
}

async function getAllGameAccounts(
  gameServers: {
    game: TypesGameEntry.GameEntry;
    game_biz: string;
    server: { name: string; region: string }[];
  }[],
  hoyolabUid: number,
  ltoken: string,
) {
  logger.info('Fetching game data for account: ' + hoyolabUid + ' ...');

  const retObj: {
    game: TypesGameEntry.GameEntry;
    game_biz: string;
    account: { region: string; game_uid: string; nickname: string; level: number }[];
  }[] = [];
  for (const gameServersEntry of gameServers) {
    logger.trace(`Fetching game data for account: ${hoyolabUid}, ${gameServersEntry.game_biz} ...`);
    retObj.push({
      game: gameServersEntry.game,
      game_biz: gameServersEntry.game_biz,
      account: await (async () => {
        const tmpArr: { region: string; game_uid: string; nickname: string; level: number }[] = [];
        for (const serverListEntry of gameServersEntry.server) {
          // logger.trace(
          //   `Fetching game data for account: ${hoyolabUid}, ${gameServersEntry.game_biz}, ${serverListEntry.region} ...`,
          // );
          const apiGameDataRsp: any = await ky
            .get('https://' + appConfig.network.accountApi.getGameData.url, {
              headers: {
                'User-Agent': appConfig.network.userAgent.chromeWindows,
                Cookie: `ltuid_v2=${hoyolabUid}; ltoken_v2=${ltoken};`,
              },
              searchParams: { game_biz: gameServersEntry.game_biz, region: serverListEntry.region },
              timeout: appConfig.network.timeout,
              retry: { limit: appConfig.network.retryCount },
            })
            .json();
          if (apiGameDataRsp.data.list.length === 0) continue;
          tmpArr.push({
            region: serverListEntry.region,
            ...omitDeep(apiGameDataRsp.data.list[0], [
              ['game_biz'],
              ['region'],
              ['is_chosen'],
              ['region_name'],
              ['is_official'],
              ['unmask'],
            ]),
          });
        }
        return tmpArr;
      })(),
    });
  }
  return retObj;
}

async function doRedeemCode(
  game: TypesGameEntry.RedeemGameEntry,
  region: string,
  code: string,
  hoyolabUid: number,
  ltoken: string,
  gameUid: string,
  hoyolabLang: string = 'ja-jp',
) {
  const apiRsp: any = await ky
    .get('https://' + appConfig.network.redeemApi[game].url, {
      headers: {
        'User-Agent': appConfig.network.userAgent.chromeWindows,
        Cookie: `ltuid_v2=${hoyolabUid}; ltoken_v2=${ltoken};`,
      },
      searchParams: {
        ...appConfig.network.redeemApi[game].qs,
        region,
        cdkey: code,
        lang: hoyolabLang.slice(0, 2),
        sLangKey: hoyolabLang,
        uid: gameUid,
      },
      timeout: appConfig.network.timeout,
      retry: { limit: appConfig.network.retryCount },
    })
    .json();
  const retObj: {
    isSuccess: boolean;
    resultType: 'ok' | 'used' | 'expired' | 'unknown';
    response: any;
  } = {
    isSuccess: Boolean(apiRsp.retcode === 0 || apiRsp.message === 'OK'),
    resultType: (() => {
      if (apiRsp.retcode === 0 || apiRsp.message === 'OK') return 'ok';
      if (apiRsp.retcode === -2017) return 'used';
      if (apiRsp.retcode === -2001) return 'expired';
      return 'unknown';
    })(),
    response: apiRsp,
  };
  logger.trace(
    `${hoyolabUid}, ${game}, ${region}, ${code}, ${retObj.resultType}${retObj.resultType === 'unknown' ? `, ${apiRsp.message}` : ''}`,
  );
  return retObj;
}

export default {
  getAvailableCodesHk4e,
  getAvailableCodesNap,
  getAllGameAccounts,
  getAllGameServers,
  doRedeemCode,
};
